import { ItemView, MarkdownRenderer, WorkspaceLeaf, setIcon } from "obsidian";
import type { ExcerptEntry, SidecarSettings, WorkbenchData } from "./settings";

export const SIDECAR_VIEW_TYPE = "sidecar-excerpt-workbench";

export interface SidecarViewController {
  addNoteEntry(): void;
  exportMarkdown(): Promise<void>;
  updateEntry(id: string, patch: Partial<Pick<ExcerptEntry, "quote" | "note">>): void;
  deleteEntry(id: string): Promise<void>;
  deleteNote(id: string): void;
  handleWorkbenchClosed(): void;
  setExcerptMode(enabled: boolean): void;
}

interface EntryElements {
  root: HTMLElement;
  quoteTextarea: HTMLTextAreaElement | null;
  noteTextarea: HTMLTextAreaElement | null;
}

export class SidecarView extends ItemView {
  private controller: SidecarViewController | null = null;
  private workbench: WorkbenchData = { entries: [] };
  private settings: SidecarSettings | null = null;
  private title = "Sidecar Notes";
  private excerptMode = true;
  private listEl: HTMLElement | null = null;
  private modeButton: HTMLButtonElement | null = null;
  private emptyEl: HTMLElement | null = null;
  private entryEls = new Map<string, EntryElements>();
  private editingQuotes = new Set<string>();
  private editingNotes = new Set<string>();
  private expandedQuotes = new Set<string>();

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return SIDECAR_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.title;
  }

  getIcon(): string {
    return "quote";
  }

  setController(controller: SidecarViewController): void {
    this.controller = controller;
  }

  setWorkbench(
    workbench: WorkbenchData,
    title: string,
    excerptMode: boolean,
    settings: SidecarSettings
  ): void {
    this.workbench = workbench;
    this.title = title;
    this.excerptMode = excerptMode;
    this.settings = settings;
    this.render();
  }

  applySettings(settings: SidecarSettings): void {
    this.settings = settings;
    this.contentEl.style.setProperty("--sidecar-preview-font-size", `${settings.summaryFontSize}px`);
  }

  addEntry(entry: ExcerptEntry): void {
    if (!this.workbench.entries.some((item) => item.id === entry.id)) {
      this.workbench.entries.push(entry);
    }
    if (entry.kind === "note" && !entry.note.trim()) {
      this.editingNotes.add(entry.id);
    }
    this.appendEntry(entry);
    this.updateEmptyState();
  }

  updateExcerptMode(enabled: boolean): void {
    this.excerptMode = enabled;
    this.updateModeButton();
  }

  removeEntry(id: string): void {
    this.entryEls.get(id)?.root.remove();
    this.entryEls.delete(id);
    this.editingQuotes.delete(id);
    this.editingNotes.delete(id);
    this.expandedQuotes.delete(id);
    this.workbench.entries = this.workbench.entries.filter((entry) => entry.id !== id);
    this.updateEmptyState();
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  async onClose(): Promise<void> {
    this.controller?.handleWorkbenchClosed();
    this.entryEls.clear();
    this.editingQuotes.clear();
    this.editingNotes.clear();
    this.expandedQuotes.clear();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("sidecar-workbench");
    if (this.settings) {
      this.applySettings(this.settings);
    }

    const headerEl = contentEl.createDiv({ cls: "sidecar-workbench__header" });
    const titleGroup = headerEl.createDiv({ cls: "sidecar-workbench__title-group" });
    titleGroup.createEl("span", { cls: "sidecar-workbench__eyebrow", text: "Excerpt workbench" });
    titleGroup.createEl("h2", { text: this.title });

    const actionsEl = headerEl.createDiv({ cls: "sidecar-workbench__actions" });

    this.modeButton = actionsEl.createEl("button", { cls: "sidecar-mode-button" });
    this.modeButton.addEventListener("click", () => {
      this.controller?.setExcerptMode(!this.excerptMode);
    });
    this.updateModeButton();

    const exportButton = actionsEl.createEl("button", {
      cls: "sidecar-command-button",
      text: "Sync",
    });
    exportButton.addEventListener("click", () => {
      void this.controller?.exportMarkdown();
    });

    const addButton = actionsEl.createEl("button", {
      cls: "sidecar-command-button",
      text: "+ note",
    });
    addButton.addEventListener("click", () => {
      this.controller?.addNoteEntry();
    });

    this.emptyEl = contentEl.createDiv({
      cls: "sidecar-workbench__empty",
      text: "Turn on excerpt mode, then select text in the source note.",
    });

    this.listEl = contentEl.createDiv({ cls: "sidecar-workbench__list" });
    this.renderEntryList();
  }

  private renderEntryList(): void {
    if (!this.listEl) return;
    this.listEl.empty();
    this.entryEls.clear();

    for (const entry of this.workbench.entries) {
      this.appendEntry(entry);
    }

    this.updateEmptyState();
  }

  private appendEntry(entry: ExcerptEntry): void {
    if (!this.listEl) return;

    if (entry.kind === "note") {
      this.appendNoteEntry(entry);
      return;
    }

    this.appendExcerptEntry(entry);
  }

  private appendExcerptEntry(entry: ExcerptEntry): void {
    if (!this.listEl) return;

    const root = this.listEl.createDiv({ cls: "sidecar-entry sidecar-entry--excerpt" });
    root.dataset.entryId = entry.id;

    const quoteTextarea = this.renderExcerptSection(root, entry);
    const noteTextarea = this.renderExcerptNoteSection(root, entry);

    this.entryEls.set(entry.id, {
      root,
      quoteTextarea,
      noteTextarea,
    });
  }

  private renderExcerptSection(root: HTMLElement, entry: ExcerptEntry): HTMLTextAreaElement | null {
    const section = root.createDiv({ cls: "sidecar-section sidecar-section--excerpt" });
    const header = section.createDiv({ cls: "sidecar-section__header" });
    header.createEl("span", { cls: "sidecar-section__label", text: "Excerpt" });
    const actions = header.createDiv({ cls: "sidecar-icon-actions" });

    if (this.editingQuotes.has(entry.id)) {
      const textarea = section.createEl("textarea", {
        cls: "sidecar-entry__editor",
        text: entry.quote,
      });
      textarea.rows = 5;

      const editorActions = section.createDiv({ cls: "sidecar-editor-actions" });
      editorActions.createEl("button", {
        cls: "sidecar-editor-button sidecar-editor-button--primary",
        text: "Save",
      }).addEventListener("click", () => {
        entry.quote = textarea.value;
        this.controller?.updateEntry(entry.id, { quote: entry.quote });
        this.editingQuotes.delete(entry.id);
        this.renderEntryList();
      });
      editorActions.createEl("button", {
        cls: "sidecar-editor-button",
        text: "Cancel",
      }).addEventListener("click", () => {
        this.editingQuotes.delete(entry.id);
        this.renderEntryList();
      });
      return textarea;
    }

    const editButton = this.createIconButton(actions, "pencil", "Edit excerpt");
    editButton.addEventListener("click", () => {
      this.editingQuotes.add(entry.id);
      this.renderEntryList();
    });
    const deleteButton = this.createIconButton(actions, "trash-2", "Delete excerpt");
    deleteButton.addEventListener("click", () => {
      void this.controller?.deleteEntry(entry.id);
    });

    const isLongQuote = this.isLongQuote(entry.quote);
    const isExpanded = this.expandedQuotes.has(entry.id);
    const preview = section.createDiv({
      cls: isLongQuote && !isExpanded
        ? "sidecar-entry__preview sidecar-entry__preview--collapsed"
        : "sidecar-entry__preview",
    });
    void this.renderMarkdown(preview, entry.quote);
    if (isLongQuote) {
      section.createEl("button", {
        cls: "sidecar-expand-button",
        text: isExpanded ? "Less" : "More",
      }).addEventListener("click", () => {
        if (this.expandedQuotes.has(entry.id)) {
          this.expandedQuotes.delete(entry.id);
        } else {
          this.expandedQuotes.add(entry.id);
        }
        this.renderEntryList();
      });
    }
    return null;
  }

  private renderExcerptNoteSection(root: HTMLElement, entry: ExcerptEntry): HTMLTextAreaElement | null {
    if (!entry.note.trim() && !this.editingNotes.has(entry.id)) {
      root.createEl("button", {
        cls: "sidecar-add-note-button",
        text: "+ add note",
      }).addEventListener("click", () => {
        this.editingNotes.add(entry.id);
        this.renderEntryList();
      });
      return null;
    }

    const section = root.createDiv({ cls: "sidecar-section sidecar-section--note" });
    const header = section.createDiv({ cls: "sidecar-section__header" });
    header.createEl("span", { cls: "sidecar-section__label", text: "Note" });
    const actions = header.createDiv({ cls: "sidecar-icon-actions" });

    if (this.editingNotes.has(entry.id)) {
      const textarea = section.createEl("textarea", {
        cls: "sidecar-entry__editor",
        text: entry.note,
      });
      textarea.rows = 6;

      const editorActions = section.createDiv({ cls: "sidecar-editor-actions" });
      editorActions.createEl("button", {
        cls: "sidecar-editor-button sidecar-editor-button--primary",
        text: "Save",
      }).addEventListener("click", () => {
        entry.note = textarea.value;
        entry.noteOpen = false;
        this.controller?.updateEntry(entry.id, { note: entry.note });
        this.editingNotes.delete(entry.id);
        this.renderEntryList();
      });
      editorActions.createEl("button", {
        cls: "sidecar-editor-button",
        text: "Cancel",
      }).addEventListener("click", () => {
        this.editingNotes.delete(entry.id);
        this.renderEntryList();
      });
      return textarea;
    }

    const editButton = this.createIconButton(actions, "pencil", "Edit note");
    editButton.addEventListener("click", () => {
      this.editingNotes.add(entry.id);
      this.renderEntryList();
    });
    const deleteButton = this.createIconButton(actions, "trash-2", "Delete note");
    deleteButton.addEventListener("click", () => {
      entry.note = "";
      entry.noteOpen = false;
      this.controller?.deleteNote(entry.id);
      this.renderEntryList();
    });

    const preview = section.createDiv({ cls: "sidecar-entry__preview" });
    void this.renderMarkdown(preview, entry.note);
    return null;
  }

  private appendNoteEntry(entry: ExcerptEntry): void {
    if (!this.listEl) return;

    const root = this.listEl.createDiv({ cls: "sidecar-entry sidecar-entry--note" });
    root.dataset.entryId = entry.id;

    const section = root.createDiv({ cls: "sidecar-section sidecar-section--standalone-note" });
    const header = section.createDiv({ cls: "sidecar-section__header" });
    header.createEl("span", { cls: "sidecar-section__label", text: "Note" });
    const actions = header.createDiv({ cls: "sidecar-icon-actions" });

    let noteTextarea: HTMLTextAreaElement | null = null;
    if (this.editingNotes.has(entry.id)) {
      noteTextarea = section.createEl("textarea", {
        cls: "sidecar-entry__editor",
        text: entry.note,
      });
      noteTextarea.rows = 7;

      const editorActions = section.createDiv({ cls: "sidecar-editor-actions" });
      editorActions.createEl("button", {
        cls: "sidecar-editor-button sidecar-editor-button--primary",
        text: "Save",
      }).addEventListener("click", () => {
        entry.note = noteTextarea?.value ?? "";
        this.controller?.updateEntry(entry.id, { note: entry.note });
        this.editingNotes.delete(entry.id);
        this.renderEntryList();
      });
      editorActions.createEl("button", {
        cls: "sidecar-editor-button",
        text: "Cancel",
      }).addEventListener("click", () => {
        this.editingNotes.delete(entry.id);
        if (!entry.note.trim()) {
          void this.controller?.deleteEntry(entry.id);
        } else {
          this.renderEntryList();
        }
      });
    } else {
      const editButton = this.createIconButton(actions, "pencil", "Edit note");
      editButton.addEventListener("click", () => {
        this.editingNotes.add(entry.id);
        this.renderEntryList();
      });
      const deleteButton = this.createIconButton(actions, "trash-2", "Delete note");
      deleteButton.addEventListener("click", () => {
        void this.controller?.deleteEntry(entry.id);
      });

      const preview = section.createDiv({ cls: "sidecar-entry__preview" });
      void this.renderMarkdown(preview, entry.note);
    }

    this.entryEls.set(entry.id, {
      root,
      quoteTextarea: null,
      noteTextarea,
    });
  }

  private async renderMarkdown(container: HTMLElement, markdown: string): Promise<void> {
    container.empty();
    const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";
    await MarkdownRenderer.render(this.app, markdown.trim() || " ", container, sourcePath, this);
  }

  private createIconButton(parent: HTMLElement, icon: string, label: string): HTMLButtonElement {
    const button = parent.createEl("button", {
      cls: "sidecar-icon-button",
      attr: {
        "aria-label": label,
        title: label,
      },
    });
    setIcon(button, icon);
    return button;
  }

  private isLongQuote(quote: string): boolean {
    return quote.length > 900 || quote.split("\n").length > 16;
  }

  private updateModeButton(): void {
    if (!this.modeButton) return;
    this.modeButton.setText(this.excerptMode ? "Excerpt mode: On" : "Excerpt mode: Off");
    this.modeButton.toggleClass("is-active", this.excerptMode);
  }

  private updateEmptyState(): void {
    if (!this.emptyEl) return;
    this.emptyEl.toggle(this.workbench.entries.length === 0);
  }
}
