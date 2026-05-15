/* global activeDocument */
import { App, Editor, MarkdownView, Notice, TFile, WorkspaceLeaf } from "obsidian";
import { SIDECAR_VIEW_TYPE, SidecarView, SidecarViewController } from "./SidecarView";
import {
  DEFAULT_SETTINGS,
  CalloutType,
  ExcerptEntry,
  ExportFormat,
  LeftExcerptFormat,
  SidecarPluginData,
  SidecarSettings,
  SourcePosition,
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
  private leftScrollEl: HTMLElement | null = null;
  private rightScrollEl: HTMLElement | null = null;
  private saveTimer: number | null = null;
  private syncTimer: number | null = null;
  private reconcileTimer: number | null = null;
  private excerptMode = true;
  private isClosingLeaf = false;
  private autoOpenSuspended = false;
  private lastCaptureKey: string | null = null;
  private lastCaptureAt = 0;
  private sourceMutationQueue: Promise<void> = Promise.resolve();
  private ignoreLeftScrollUntil = 0;
  private activeScrollSyncEntryId: string | null = null;

  private onBoundMouseUp = () => this.syncSelection();
  private onBoundKeyUp = () => this.syncSelection();
  private onBoundLeftScroll = () => this.syncWorkbenchToSourceScroll();

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

  private getTimerWindow(): Window {
    return activeDocument.defaultView as Window;
  }

  async updateSettings(patch: Partial<SidecarSettings>): Promise<void> {
    this.data.settings = {
      ...this.data.settings,
      ...patch,
    };
    this.view?.applySettings(this.data.settings);
    await this.saveNow();
    if (this.sourceFile && this.data.settings.autoSaveSummaryFile) {
      await this.syncSummaryFile();
    }
  }

  async toggle(): Promise<void> {
    if (this.isActiveFlag) {
      this.deactivate({ closeLeaf: true, suspendAutoOpen: true });
    } else {
      this.autoOpenSuspended = false;
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

  handleWorkbenchClosed(): void {
    if (this.isClosingLeaf) {
      this.isClosingLeaf = false;
      return;
    }
    this.deactivate({ suspendAutoOpen: true });
  }

  isAutoOpenSuspended(): boolean {
    return this.autoOpenSuspended;
  }

  addNoteEntry(): void {
    const workbench = this.getCurrentWorkbench();
    if (!workbench) {
      new Notice("Open a source note before adding a note.");
      return;
    }

    this.view?.commitPendingNoteEditors();
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

    if (typeof patch.quote === "string") {
      const nextQuote = patch.quote.trim();
      if (nextQuote) {
        entry.quote = nextQuote;
      }
    }

    if (typeof patch.note === "string") {
      entry.note = patch.note;
    }

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

  jumpToSourceEntry(id: string): void {
    const workbench = this.getCurrentWorkbench();
    const entry = workbench?.entries.find((item) => item.id === id);
    if (!entry || entry.kind !== "excerpt") return;
    if (!this.leftEditor) return;

    const sourceContent = this.leftEditor.getValue();
    const sourceQuote = entry.sourceQuote ?? entry.quote;
    const match = this.findSourceExcerptVariantForQuote(
      sourceContent,
      sourceQuote,
      entry.sourceFormat,
      entry.sourceStart
    );
    if (!match) {
      new Notice("Could not find this excerpt in the source note.");
      return;
    }

    entry.sourceFormat = match.format;
    const from = this.offsetToPosition(sourceContent, match.startOffset);
    const to = this.offsetToPosition(sourceContent, match.startOffset + match.text.length);
    entry.sourceStart = from;
    this.ignoreLeftScrollUntil = Date.now() + 180;
    this.leftEditor.scrollIntoView({ from, to }, true);
  }

  async deleteEntry(id: string): Promise<void> {
    const workbench = this.getCurrentWorkbench();
    if (!workbench) return;

    const entry = workbench.entries.find((item) => item.id === id);
    if (!entry) return;

    if (entry.kind === "excerpt") {
      const reverted = await this.revertExcerptMarkupInSource(entry);
      if (!reverted) {
        new Notice("Could not remove the source highlight for this excerpt.");
        return;
      }
    }

    workbench.entries = workbench.entries.filter((item) => item.id !== id);
    this.view?.removeEntry(id);
    this.queueSave();
  }

  handleSourceFileModified(file: TFile): void {
    if (!this.sourceFile || file.path !== this.sourceFile.path) return;

    if (this.reconcileTimer !== null) {
      this.getTimerWindow().clearTimeout(this.reconcileTimer);
    }

    this.reconcileTimer = this.getTimerWindow().setTimeout(() => {
      this.reconcileTimer = null;
      void this.reconcileWorkbenchWithSource();
    }, 250);
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

  deactivate(options: { closeLeaf?: boolean; suspendAutoOpen?: boolean } = {}): void {
    const leafToClose = options.closeLeaf ? this.rightLeaf : null;
    this.unregisterListeners();
    this.flushQueuedSave();
    this.flushQueuedSync();
    this.flushQueuedReconcile();
    this.isActiveFlag = false;
    this.sourceFile = null;
    this.rightLeaf = null;
    this.view = null;
    this.leftEditor = null;
    this.leftScrollEl = null;
    this.rightScrollEl = null;
    this.lastCaptureKey = null;
    this.lastCaptureAt = 0;
    this.activeScrollSyncEntryId = null;
    if (options.suspendAutoOpen) {
      this.autoOpenSuspended = true;
    }
    if (leafToClose) {
      this.isClosingLeaf = true;
      leafToClose.detach();
    }
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
      this.view.setWorkbench(
        workbench,
        this.getWorkbenchTitle(),
        this.excerptMode,
        this.data.settings
      );
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

  private getEditorScrollElement(editor: Editor): HTMLElement | null {
    const editorDom = this.getEditorDom(editor);
    if (!editorDom) return null;
    return editorDom.querySelector<HTMLElement>(".cm-scroller")
      ?? editorDom.querySelector<HTMLElement>(".CodeMirror-scroll")
      ?? this.findScrollContainer(editorDom);
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
    this.leftScrollEl = this.getEditorScrollElement(this.leftEditor);
    this.rightScrollEl = this.view?.getScrollContainer() ?? null;
    this.leftScrollEl?.addEventListener("scroll", this.onBoundLeftScroll, { passive: true });
  }

  private unregisterListeners(): void {
    const leftDom = this.leftEditor ? this.getEditorDom(this.leftEditor) : null;
    if (leftDom) {
      leftDom.removeEventListener("mouseup", this.onBoundMouseUp);
      leftDom.removeEventListener("keyup", this.onBoundKeyUp);
    }
    this.leftScrollEl?.removeEventListener("scroll", this.onBoundLeftScroll);
    this.leftScrollEl = null;
    this.rightScrollEl = null;
  }

  private syncSelection(): void {
    if (!this.leftEditor) return;
    if (!this.excerptMode) return;

    const selection = this.leftEditor.getSelection();
    const trimmed = selection.trim();
    if (!trimmed) return;

    const workbench = this.getCurrentWorkbench();
    if (!workbench) return;
    if (!this.shouldCaptureSelection(trimmed)) return;

    this.view?.commitPendingNoteEditors();
    const entry = this.createEntry(trimmed, "excerpt", this.leftEditor.getCursor("from"));
    workbench.entries.push(entry);
    this.view?.addEntry(entry);
    this.queueSave();
    this.markSelectionCaptured(trimmed);

    const formatted = this.formatSelection(trimmed);
    if (formatted !== selection) {
      this.leftEditor.replaceSelection(formatted);
    }
  }

  private formatSelection(selection: string): string {
    return this.applySourceFormat(selection, this.data.settings.leftExcerptFormat);
  }

  private shouldCaptureSelection(selection: string): boolean {
    if (!this.sourceFile) return false;

    const key = `${this.sourceFile.path}::${selection.trim()}`;
    return !(this.lastCaptureKey === key && Date.now() - this.lastCaptureAt < 250);
  }

  private markSelectionCaptured(selection: string): void {
    if (!this.sourceFile) return;

    this.lastCaptureKey = `${this.sourceFile.path}::${selection.trim()}`;
    this.lastCaptureAt = Date.now();
  }

  private applySourceFormat(selection: string, format: LeftExcerptFormat): string {
    const lines = selection
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) return selection;

    switch (format) {
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

  private createEntry(
    quote: string,
    kind: "excerpt" | "note",
    sourceStart?: SourcePosition
  ): ExcerptEntry {
    return {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      kind,
      quote,
      sourceQuote: kind === "excerpt" ? quote : undefined,
      sourceStart: kind === "excerpt" ? sourceStart : undefined,
      createdAt: Date.now(),
      note: "",
      noteOpen: kind === "note",
      sourceFormat: kind === "excerpt" ? this.data.settings.leftExcerptFormat : undefined,
    };
  }

  private queueSave(): void {
    if (this.saveTimer !== null) {
      this.getTimerWindow().clearTimeout(this.saveTimer);
    }

    this.saveTimer = this.getTimerWindow().setTimeout(() => {
      void this.saveNow();
    }, 300);
    this.queueSummarySync();
  }

  private flushQueuedSave(): void {
    if (this.saveTimer === null) return;
    this.getTimerWindow().clearTimeout(this.saveTimer);
    this.saveTimer = null;
    void this.saveNow();
  }

  private async saveNow(): Promise<void> {
    if (this.saveTimer !== null) {
      this.getTimerWindow().clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.writeData(this.data);
  }

  private queueSummarySync(): void {
    if (!this.sourceFile || !this.data.settings.autoSaveSummaryFile) return;
    if (this.syncTimer !== null) {
      this.getTimerWindow().clearTimeout(this.syncTimer);
    }

    this.syncTimer = this.getTimerWindow().setTimeout(() => {
      void this.syncSummaryFile();
    }, 500);
  }

  private flushQueuedSync(): void {
    if (this.syncTimer === null) return;
    this.getTimerWindow().clearTimeout(this.syncTimer);
    this.syncTimer = null;
    void this.syncSummaryFile();
  }

  private flushQueuedReconcile(): void {
    if (this.reconcileTimer === null) return;
    this.getTimerWindow().clearTimeout(this.reconcileTimer);
    this.reconcileTimer = null;
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
      this.getTimerWindow().clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }

    const path = await this.ensureSummaryPath(workbench, this.sourceFile);
    const content = this.renderSummaryFile(workbench, this.sourceFile);
    await this.writeMarkdownFile(path, content);

    if (this.data.settings.addBidirectionalLinks) {
      await this.ensureSourceBacklink(this.sourceFile, path);
    }

    await this.saveNow();
    return path;
  }

  private renderSummaryFile(workbench: WorkbenchData, sourceFile: TFile): string {
    const body = this.renderExport(workbench).trim();
    const sourceLink = this.data.settings.addBidirectionalLinks
      ? `Source: ${this.wikilinkForFile(sourceFile.path, sourceFile.basename)}\n\n`
      : "";
    return `${sourceLink}${body ? `${body}\n` : ""}`;
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

  private async revertExcerptMarkupInSource(entry: ExcerptEntry): Promise<boolean> {
    if (!this.sourceFile || entry.kind !== "excerpt") return false;
    const sourceFile = this.sourceFile;

    return this.runSourceMutation(async () => {
      let reverted = false;

      await this.app.vault.process(sourceFile, (content) => {
        const match = this.findSourceExcerptMatch(content, entry);
        const sourceQuote = entry.sourceQuote ?? entry.quote;
        if (!match || match.text === sourceQuote) {
          reverted = match?.text === sourceQuote;
          return content;
        }

        reverted = true;
        return `${content.slice(0, match.startOffset)}${sourceQuote}${content.slice(match.startOffset + match.text.length)}`;
      });

      return reverted;
    });
  }

  private async reconcileWorkbenchWithSource(): Promise<void> {
    if (!this.sourceFile) return;

    const workbench = this.getCurrentWorkbench();
    if (!workbench) return;

    const sourceContent = await this.app.vault.cachedRead(this.sourceFile);
    const removedEntries = workbench.entries.filter((entry) => {
      if (entry.kind !== "excerpt") return false;
      return !this.sourceContainsExcerpt(sourceContent, entry);
    });
    if (removedEntries.length === 0) return;

    const removedIds = new Set(removedEntries.map((entry) => entry.id));
    workbench.entries = workbench.entries.filter((entry) => !removedIds.has(entry.id));

    for (const entry of removedEntries) {
      this.view?.removeEntry(entry.id);
    }

    this.queueSave();
  }

  private sourceContainsExcerpt(sourceContent: string, entry: ExcerptEntry): boolean {
    return this.findSourceExcerptVariant(sourceContent, entry) !== null;
  }

  private findSourceExcerptMatch(
    sourceContent: string,
    entry: ExcerptEntry
  ): { text: string; format: LeftExcerptFormat; startOffset: number } | null {
    const match = this.findSourceExcerptVariantForQuote(
      sourceContent,
      entry.sourceQuote ?? entry.quote,
      entry.sourceFormat,
      entry.sourceStart
    );
    if (!match) {
      return null;
    }

    entry.sourceFormat = match.format;
    entry.sourceStart = this.offsetToPosition(sourceContent, match.startOffset);
    return match;
  }

  private findSourceExcerptVariant(sourceContent: string, entry: ExcerptEntry): string | null {
    const match = this.findSourceExcerptMatch(sourceContent, entry);
    if (!match) {
      return null;
    }
    return match.text;
  }

  private findSourceExcerptVariantForQuote(
    sourceContent: string,
    quote: string,
    preferredFormat?: LeftExcerptFormat,
    sourceStart?: SourcePosition
  ): { text: string; format: LeftExcerptFormat; startOffset: number } | null {
    const formats: LeftExcerptFormat[] = ["highlight", "bold", "italic", "none"];
    const candidates = preferredFormat
      ? [preferredFormat, ...formats.filter((format) => format !== preferredFormat)]
      : formats;
    const preferredOffset = sourceStart ? this.positionToOffset(sourceContent, sourceStart) : null;

    for (const format of candidates) {
      const variant = this.applySourceFormat(quote, format);
      const startOffset = this.findBestExcerptOffset(sourceContent, variant, preferredOffset);
      if (startOffset !== null) {
        return {
          text: variant,
          format,
          startOffset,
        };
      }
    }

    return null;
  }

  private runSourceMutation<T>(task: () => Promise<T>): Promise<T> {
    const next = this.sourceMutationQueue.then(task, task);
    this.sourceMutationQueue = next.then(() => undefined, () => undefined);
    return next;
  }

  private syncWorkbenchToSourceScroll(): void {
    if (!this.leftEditor || !this.leftScrollEl || !this.view) return;
    if (Date.now() < this.ignoreLeftScrollUntil) return;

    this.rightScrollEl = this.view.getScrollContainer() ?? this.rightScrollEl;
    const targetEntry = this.findPrimaryVisibleExcerptEntry();
    if (!targetEntry) return;
    if (targetEntry.id === this.activeScrollSyncEntryId) return;

    const behavior = this.shouldUseSmoothScroll(targetEntry.id) ? "smooth" : "auto";
    this.activeScrollSyncEntryId = targetEntry.id;
    this.view.scrollEntryIntoView(targetEntry.id, behavior);
  }

  private findBestExcerptOffset(
    sourceContent: string,
    excerptText: string,
    preferredOffset: number | null
  ): number | null {
    if (!excerptText) return null;

    const matches: number[] = [];
    let searchFrom = 0;
    while (searchFrom <= sourceContent.length) {
      const foundAt = sourceContent.indexOf(excerptText, searchFrom);
      if (foundAt === -1) break;
      matches.push(foundAt);
      searchFrom = foundAt + Math.max(excerptText.length, 1);
    }

    if (matches.length === 0) return null;
    if (preferredOffset === null) return matches[0];

    return matches.reduce((best, current) => {
      const bestDistance = Math.abs(best - preferredOffset);
      const currentDistance = Math.abs(current - preferredOffset);
      return currentDistance < bestDistance ? current : best;
    });
  }

  private findPrimaryVisibleExcerptEntry(): ExcerptEntry | null {
    const workbench = this.getCurrentWorkbench();
    if (!workbench || !this.leftScrollEl || !this.leftEditor) return null;

    const excerptEntries = workbench.entries.filter((entry) => entry.kind === "excerpt");
    if (excerptEntries.length === 0) return null;

    const lineCount = Math.max(this.leftEditor.lineCount(), 1);
    const scrollRange = Math.max(this.leftScrollEl.scrollHeight - this.leftScrollEl.clientHeight, 1);
    const viewportMidRatio =
      (this.leftScrollEl.scrollTop + this.leftScrollEl.clientHeight * 0.42) / scrollRange;
    const focusLine = Math.max(
      0,
      Math.min(lineCount - 1, Math.round(viewportMidRatio * (lineCount - 1)))
    );

    return excerptEntries.reduce((best, current) => {
      const currentLine = current.sourceStart?.line ?? 0;
      const bestLine = best.sourceStart?.line ?? 0;
      const currentDistance = Math.abs(currentLine - focusLine);
      const bestDistance = Math.abs(bestLine - focusLine);
      return currentDistance < bestDistance ? current : best;
    });
  }

  private shouldUseSmoothScroll(nextEntryId: string): boolean {
    if (!this.rightScrollEl || !this.view) return false;
    if (!this.activeScrollSyncEntryId) return true;

    const nextElement = this.rightScrollEl.querySelector<HTMLElement>(`[data-entry-id="${nextEntryId}"]`);
    const currentElement = this.rightScrollEl.querySelector<HTMLElement>(
      `[data-entry-id="${this.activeScrollSyncEntryId}"]`
    );
    if (!nextElement || !currentElement) return true;

    return Math.abs(nextElement.offsetTop - currentElement.offsetTop) < this.rightScrollEl.clientHeight * 1.25;
  }

  private positionToOffset(content: string, position: SourcePosition): number {
    const lines = content.split("\n");
    const maxLine = Math.max(0, Math.min(position.line, lines.length - 1));
    let offset = 0;

    for (let line = 0; line < maxLine; line += 1) {
      offset += lines[line].length + 1;
    }

    return offset + Math.max(0, Math.min(position.ch, lines[maxLine]?.length ?? 0));
  }

  private offsetToPosition(content: string, offset: number): { line: number; ch: number } {
    const clamped = Math.max(0, Math.min(offset, content.length));
    let line = 0;
    let ch = 0;

    for (let index = 0; index < clamped; index += 1) {
      if (content[index] === "\n") {
        line += 1;
        ch = 0;
      } else {
        ch += 1;
      }
    }

    return { line, ch };
  }

  private findScrollContainer(start: HTMLElement | null): HTMLElement | null {
    let current = start;
    while (current) {
      const styles = window.getComputedStyle(current);
      const overflowY = styles.overflowY;
      if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
        return current;
      }
      current = current.parentElement;
    }

    return null;
  }
}

export function normalizePluginData(raw: unknown): SidecarPluginData {
  const data = raw as Partial<SidecarPluginData> | null;
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(data?.settings ?? {}),
  };
  settings.summaryFontSize = normalizeSummaryFontSize(settings.summaryFontSize);
  if (!isCalloutType(settings.exportCalloutType)) {
    settings.exportCalloutType = DEFAULT_SETTINGS.exportCalloutType;
  }

  const workbenches = data?.workbenches ?? {};
  const normalizedAt = Date.now();
  for (const workbench of Object.values(workbenches)) {
    for (const entry of workbench.entries) {
      entry.kind = entry.kind ?? (entry.quote.trim() ? "excerpt" : "note");
      entry.noteOpen = entry.noteOpen ?? entry.kind === "note";
      entry.sourceQuote = entry.kind === "excerpt" ? (entry.sourceQuote ?? entry.quote) : undefined;
      entry.sourceFormat = entry.kind === "excerpt" ? entry.sourceFormat : undefined;
      entry.sourceStart = entry.kind === "excerpt" ? entry.sourceStart : undefined;
      entry.createdAt = typeof entry.createdAt === "number" && !Number.isNaN(entry.createdAt)
        ? entry.createdAt
        : normalizedAt;
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

function normalizeSummaryFontSize(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULT_SETTINGS.summaryFontSize;
  }

  return Math.min(20, Math.max(12, Math.round(value)));
}
