import { App, Editor, MarkdownView, Notice, TFile, WorkspaceLeaf } from "obsidian";
import { SIDECAR_VIEW_TYPE, SidecarView, SidecarViewController } from "./SidecarView";
import {
  DEFAULT_SETTINGS,
  CalloutType,
  ExcerptEntry,
  ExportFormat,
  SidecarPluginData,
  SidecarSettings,
  WorkbenchData,
  createEmptyWorkbench,
} from "./settings";

type EditorWithDom = Editor & {
  cm?: { dom: HTMLElement };
  cm6?: { dom: HTMLElement };
  containerEl?: HTMLElement;
};

type DataWriter = (data: SidecarPluginData) => Promise<void>;

export class DualLinkManager implements SidecarViewController {
  private app: App;
  private data: SidecarPluginData;
  private writeData: DataWriter;
  private isActiveFlag = false;
  private isActivatingFlag = false;

  private sourceFile: TFile | null = null;
  private rightLeaf: WorkspaceLeaf | null = null;
  private view: SidecarView | null = null;
  private leftEditor: Editor | null = null;
  private pendingQuotes = new Set<string>();
  private saveTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  private syncTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  private excerptMode = true;

  private onBoundMouseUp = () => this.syncSelection();
  private onBoundKeyUp = () => this.syncSelection();

  constructor(app: App, data: SidecarPluginData, writeData: DataWriter) {
    this.app = app;
    this.data = data;
    this.writeData = writeData;
  }

  isActive(): boolean {
    return this.isActiveFlag;
  }

  isActivating(): boolean {
    return this.isActivatingFlag;
  }

  getSettings(): SidecarSettings {
    return this.data.settings;
  }

  async updateSettings(patch: Partial<SidecarSettings>): Promise<void> {
    this.data.settings = {
      ...this.data.settings,
      ...patch,
    };
    await this.saveNow();
    if (this.sourceFile && this.data.settings.autoSaveSummaryFile) {
      await this.syncSummaryFile();
    }
  }

  async toggle(): Promise<void> {
    if (this.isActiveFlag) {
      this.deactivate();
    } else {
      await this.activate();
    }
  }

  async activateForCurrentFile(): Promise<void> {
    if (this.isActiveFlag || this.isActivatingFlag) return;
    await this.activate();
  }

  getWorkbenchTitle(): string {
    return this.sourceFile ? `${this.sourceFile.basename} Notes` : "Sidecar Notes";
  }

  isExcerptMode(): boolean {
    return this.excerptMode;
  }

  setExcerptMode(enabled: boolean): void {
    this.excerptMode = enabled;
    this.view?.updateExcerptMode(enabled);
  }

  addNoteEntry(): void {
    const workbench = this.getCurrentWorkbench();
    if (!workbench) {
      new Notice("Open a source note before adding a note.");
      return;
    }

    const entry = this.createEntry("", "note");
    entry.noteOpen = true;
    workbench.entries.push(entry);
    this.view?.addEntry(entry);
    this.queueSave();
  }

  updateEntry(id: string, patch: Partial<Pick<ExcerptEntry, "quote" | "note">>): void {
    const workbench = this.getCurrentWorkbench();
    const entry = workbench?.entries.find((item) => item.id === id);
    if (!entry) return;

    Object.assign(entry, patch);
    this.queueSave();
  }

  deleteNote(id: string): void {
    const workbench = this.getCurrentWorkbench();
    const entry = workbench?.entries.find((item) => item.id === id);
    if (!entry) return;

    entry.note = "";
    entry.noteOpen = false;
    this.queueSave();
  }

  deleteEntry(id: string): void {
    const workbench = this.getCurrentWorkbench();
    if (!workbench) return;

    workbench.entries = workbench.entries.filter((entry) => entry.id !== id);
    this.pendingQuotes.delete(id);
    this.view?.removeEntry(id);
    this.queueSave();
  }

  async exportMarkdown(): Promise<void> {
    if (!this.sourceFile) {
      new Notice("Open a source note before exporting.");
      return;
    }

    const workbench = this.getCurrentWorkbench();
    if (!workbench || workbench.entries.length === 0) {
      new Notice("There are no excerpts to export.");
      return;
    }

    const path = await this.syncSummaryFile();
    new Notice(`Synced sidecar notes to ${path}`);
  }

  deactivate(): void {
    this.unregisterListeners();
    this.flushQueuedSave();
    this.flushQueuedSync();
    this.isActiveFlag = false;
    this.sourceFile = null;
    this.rightLeaf = null;
    this.view = null;
    this.leftEditor = null;
    this.pendingQuotes.clear();
  }

  private async activate(): Promise<void> {
    if (this.isActivatingFlag) return;

    this.isActivatingFlag = true;
    try {
      const activeFile = this.app.workspace.getActiveFile();
      if (!activeFile) {
        new Notice("No active file to link.");
        return;
      }

      const leftEditor = this.getLeftEditor();
      if (!leftEditor) {
        new Notice("Could not get left editor.");
        return;
      }

      this.unregisterListeners();
      this.sourceFile = activeFile;
      this.leftEditor = leftEditor;
      this.excerptMode = true;

      const workbench = this.ensureWorkbench(activeFile);
      this.rightLeaf = await this.openWorkbenchLeaf();
      const view = this.rightLeaf.view;
      if (!(view instanceof SidecarView)) {
        new Notice("Could not open sidecar workbench.");
        return;
      }

      this.view = view;
      this.view.setController(this);
      this.view.setWorkbench(workbench, this.getWorkbenchTitle(), this.excerptMode);
      this.registerListeners();
      this.isActiveFlag = true;
      this.queueSummarySync();
      new Notice("Sidecar workbench activated.");
    } finally {
      this.isActivatingFlag = false;
    }
  }

  private getLeftEditor(): Editor | null {
    const activeEditor = this.app.workspace.activeEditor;
    if (activeEditor?.editor) return activeEditor.editor;

    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view?.editor) return view.editor;

    return null;
  }

  private getEditorDom(editor: Editor): HTMLElement | null {
    const editorWithDom = editor as EditorWithDom;
    if (editorWithDom.cm6) return editorWithDom.cm6.dom;
    if (editorWithDom.cm?.dom) return editorWithDom.cm.dom;
    return editorWithDom.containerEl ?? null;
  }

  private async openWorkbenchLeaf(): Promise<WorkspaceLeaf> {
    const existing = this.app.workspace.getLeavesOfType(SIDECAR_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf("split", "vertical");
    await leaf.setViewState({ type: SIDECAR_VIEW_TYPE, active: true });
    void this.app.workspace.revealLeaf(leaf);
    return leaf;
  }

  private registerListeners(): void {
    if (!this.leftEditor) return;
    const leftDom = this.getEditorDom(this.leftEditor);
    if (!leftDom) return;

    leftDom.addEventListener("mouseup", this.onBoundMouseUp);
    leftDom.addEventListener("keyup", this.onBoundKeyUp);
  }

  private unregisterListeners(): void {
    if (!this.leftEditor) return;
    const leftDom = this.getEditorDom(this.leftEditor);
    if (!leftDom) return;

    leftDom.removeEventListener("mouseup", this.onBoundMouseUp);
    leftDom.removeEventListener("keyup", this.onBoundKeyUp);
  }

  private syncSelection(): void {
    if (!this.leftEditor) return;
    if (!this.excerptMode) return;

    const selection = this.leftEditor.getSelection();
    const trimmed = selection.trim();
    if (!trimmed) return;

    const formatted = this.formatSelection(trimmed);
    if (formatted !== selection) {
      this.leftEditor.replaceSelection(formatted);
    }

    this.addExcerptFromSelection(trimmed);
  }

  private addExcerptFromSelection(quote: string): void {
    const workbench = this.getCurrentWorkbench();
    if (!workbench) return;

    const normalized = quote.trim();
    if (!normalized || this.pendingQuotes.has(normalized)) return;
    if (workbench.entries.some((entry) => entry.quote.trim() === normalized)) return;

    this.pendingQuotes.add(normalized);
    const entry = this.createEntry(normalized, "excerpt");
    workbench.entries.push(entry);
    this.view?.addEntry(entry);
    this.queueSave();
    this.pendingQuotes.delete(normalized);
  }

  private formatSelection(selection: string): string {
    const lines = selection
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) return selection;

    switch (this.data.settings.leftExcerptFormat) {
      case "bold":
        return lines.map((line) => `**${line}**`).join("\n");
      case "italic":
        return lines.map((line) => `*${line}*`).join("\n");
      case "none":
        return selection;
      case "highlight":
      default:
        return lines.map((line) => `==${line}==`).join("\n");
    }
  }

  private ensureWorkbench(sourceFile: TFile): WorkbenchData {
    const key = this.getWorkbenchKey(sourceFile);
    const existing = this.data.workbenches[key];
    if (existing) return existing;

    const created = createEmptyWorkbench();
    this.data.workbenches[key] = created;
    this.queueSave();
    return created;
  }

  private getCurrentWorkbench(): WorkbenchData | null {
    if (!this.sourceFile) return null;
    return this.data.workbenches[this.getWorkbenchKey(this.sourceFile)] ?? null;
  }

  private getWorkbenchKey(sourceFile: TFile): string {
    return sourceFile.path;
  }

  private createEntry(quote: string, kind: "excerpt" | "note"): ExcerptEntry {
    return {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      kind,
      quote,
      note: "",
      noteOpen: kind === "note",
    };
  }

  private queueSave(): void {
    if (this.saveTimer !== null) {
      globalThis.clearTimeout(this.saveTimer);
    }

    this.saveTimer = globalThis.setTimeout(() => {
      void this.saveNow();
    }, 300);
    this.queueSummarySync();
  }

  private flushQueuedSave(): void {
    if (this.saveTimer === null) return;
    globalThis.clearTimeout(this.saveTimer);
    this.saveTimer = null;
    void this.saveNow();
  }

  private async saveNow(): Promise<void> {
    if (this.saveTimer !== null) {
      globalThis.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.writeData(this.data);
  }

  private queueSummarySync(): void {
    if (!this.sourceFile || !this.data.settings.autoSaveSummaryFile) return;
    if (this.syncTimer !== null) {
      globalThis.clearTimeout(this.syncTimer);
    }

    this.syncTimer = globalThis.setTimeout(() => {
      void this.syncSummaryFile();
    }, 500);
  }

  private flushQueuedSync(): void {
    if (this.syncTimer === null) return;
    globalThis.clearTimeout(this.syncTimer);
    this.syncTimer = null;
    void this.syncSummaryFile();
  }

  private renderExport(workbench: WorkbenchData): string {
    const format = this.data.settings.exportFormat;
    const sections = workbench.entries.map((entry) => {
      if (entry.kind === "note") {
        return entry.note.trim();
      }

      const quote = this.renderQuoteMarkdown(entry.quote, format);
      const note = entry.note.trim();
      return note ? `${quote}\n\n${note}` : quote;
    });

    return `${sections.join("\n\n")}\n`;
  }

  private async syncSummaryFile(): Promise<string> {
    if (!this.sourceFile) {
      throw new Error("No source file is active.");
    }

    const workbench = this.getCurrentWorkbench();
    if (!workbench) {
      throw new Error("No sidecar workbench is active.");
    }

    if (this.syncTimer !== null) {
      globalThis.clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }

    const path = await this.ensureSummaryPath(workbench, this.sourceFile);
    const content = this.renderSummaryFile(workbench, this.sourceFile, path);
    await this.writeMarkdownFile(path, content);

    if (this.data.settings.addBidirectionalLinks) {
      await this.ensureSourceBacklink(this.sourceFile, path);
    }

    await this.saveNow();
    return path;
  }

  private renderSummaryFile(workbench: WorkbenchData, sourceFile: TFile, summaryPath: string): string {
    const body = this.renderExport(workbench).trim();
    const sourceLink = this.data.settings.addBidirectionalLinks
      ? `Source: ${this.wikilinkForFile(sourceFile.path, sourceFile.basename)}\n\n`
      : "";
    const title = `# ${summaryPath.replace(/\.md$/i, "").split("/").pop() ?? sourceFile.basename}`;
    return `${title}\n\n${sourceLink}${body ? `${body}\n` : ""}`;
  }

  private async ensureSummaryPath(workbench: WorkbenchData, sourceFile: TFile): Promise<string> {
    if (workbench.summaryPath) return workbench.summaryPath;

    const folder = this.normalizeFolder(this.data.settings.exportFolder);
    if (folder) {
      await this.ensureFolder(folder);
    }

    const filename = `${sourceFile.basename} Notes.md`;
    const path = folder ? `${folder}/${filename}` : filename;
    workbench.summaryPath = path;
    return path;
  }

  private async writeMarkdownFile(path: string, content: string): Promise<void> {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, content);
      return;
    }
    if (existing) {
      throw new Error(`Summary path is not a file: ${path}`);
    }

    await this.app.vault.create(path, content);
  }

  private renderQuoteMarkdown(quote: string, format: ExportFormat): string {
    const lines = quote.split("\n").filter((line) => line.trim().length > 0);
    if (format === "callout") {
      return [
        `> [!${this.data.settings.exportCalloutType}]`,
        ...lines.map((line) => `> ${line}`),
      ].join("\n");
    }
    return lines.map((line) => `> ${line}`).join("\n");
  }

  private normalizeFolder(folder: string): string {
    return folder.trim().replace(/^\/+|\/+$/g, "");
  }

  private async ensureFolder(folder: string): Promise<void> {
    const parts = folder.split("/").filter((part) => part.length > 0);
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(current);
      if (existing) continue;
      await this.app.vault.createFolder(current);
    }
  }

  private async ensureSourceBacklink(sourceFile: TFile, summaryPath: string): Promise<void> {
    const summaryLink = this.wikilinkForPath(summaryPath);
    await this.app.vault.process(sourceFile, (content) => {
      if (content.includes(summaryLink)) return content;
      const suffix = content.endsWith("\n") ? "" : "\n";
      return `${content}${suffix}\nSidecar notes: ${summaryLink}\n`;
    });
  }

  private wikilinkForFile(path: string, alias: string): string {
    return `[[${this.stripMdExtension(path)}|${alias}]]`;
  }

  private wikilinkForPath(path: string): string {
    const target = this.stripMdExtension(path);
    const alias = target.split("/").pop() ?? target;
    return `[[${target}|${alias}]]`;
  }

  private stripMdExtension(path: string): string {
    return path.replace(/\.md$/i, "");
  }
}

export function normalizePluginData(raw: unknown): SidecarPluginData {
  const data = raw as Partial<SidecarPluginData> | null;
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(data?.settings ?? {}),
  };
  if (!isCalloutType(settings.exportCalloutType)) {
    settings.exportCalloutType = DEFAULT_SETTINGS.exportCalloutType;
  }

  const workbenches = data?.workbenches ?? {};
  for (const workbench of Object.values(workbenches)) {
    for (const entry of workbench.entries) {
      entry.kind = entry.kind ?? (entry.quote.trim() ? "excerpt" : "note");
      entry.noteOpen = entry.noteOpen ?? entry.kind === "note";
    }
  }

  return {
    settings: {
      ...settings,
    },
    workbenches,
  };
}

function isCalloutType(value: unknown): value is CalloutType {
  return typeof value === "string" && [
    "quote",
    "note",
    "abstract",
    "info",
    "todo",
    "tip",
    "success",
    "question",
    "warning",
    "failure",
    "danger",
    "bug",
    "example",
  ].includes(value);
}
