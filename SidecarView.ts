import { ItemView, MarkdownRenderer, WorkspaceLeaf, setIcon } from "obsidian";
import type { ExcerptEntry, SidecarSettings, WorkbenchData } from "./settings";

export const SIDECAR_VIEW_TYPE = "sidecar-excerpt-workbench";

export interface SidecarViewController {
  addNoteEntry(): void;
  exportMarkdown(): Promise<void>;
  updateEntry(id: string, patch: Partial<Pick<ExcerptEntry, "quote" | "note">>): void;
  deleteEntry(id: string): Promise<void>;
  deleteNote(id: string): void;
  jumpToSourceEntry(id: string): void;
  handleWorkbenchClosed(): void;
  setExcerptMode(enabled: boolean): void;
}

interface EntryElements {
  root: HTMLElement;
  quoteTextarea: HTMLTextAreaElement | null;
  noteTextarea: HTMLTextAreaElement | null;
}

type SortOrder = "asc" | "desc";

export class SidecarView extends ItemView {
  private controller: SidecarViewController | null = null;
  private workbench: WorkbenchData = { entries: [] };
  private settings: SidecarSettings | null = null;
  private title = "Sidecar Notes";
  private excerptMode = true;
  private listEl: HTMLElement | null = null;
  private modeButton: HTMLButtonElement | null = null;
  private emptyEl: HTMLElement | null = null;
  private searchInputEl: HTMLInputElement | null = null;
  private sortButtonEl: HTMLButtonElement | null = null;
  private backToTopButtonEl: HTMLButtonElement | null = null;
  private entryEls = new Map<string, EntryElements>();
  private editingQuotes = new Set<string>();
  private editingNotes = new Set<string>();
  private expandedQuotes = new Set<string>();
  private pendingNoteFocusId: string | null = null;
  private searchQuery = "";
  private sortOrder: SortOrder = "desc";
  private onBoundWorkbenchScroll = () => this.updateBackToTopButton();

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
      this.pendingNoteFocusId = entry.id;
    }
    this.renderEntryList();
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
    if (this.pendingNoteFocusId === id) {
      this.pendingNoteFocusId = null;
    }
    this.workbench.entries = this.workbench.entries.filter((entry) => entry.id !== id);
    this.updateEmptyState();
  }

  onOpen(): Promise<void> {
    this.render();
    return Promise.resolve();
  }

  onClose(): Promise<void> {
    this.controller?.handleWorkbenchClosed();
    this.entryEls.clear();
    this.editingQuotes.clear();
    this.editingNotes.clear();
    this.expandedQuotes.clear();
    this.pendingNoteFocusId = null;
    this.searchInputEl = null;
    this.sortButtonEl = null;
    this.backToTopButtonEl = null;
    this.getScrollContainer()?.removeEventListener("scroll", this.onBoundWorkbenchScroll);
    return Promise.resolve();
  }

  commitPendingNoteEditors(): boolean {
    if (this.editingNotes.size === 0) return false;

    const removedIds = new Set<string>();
    const nextEntries: ExcerptEntry[] = [];

    for (const entry of this.workbench.entries) {
      if (!this.editingNotes.has(entry.id)) {
        nextEntries.push(entry);
        continue;
      }

      const draft = this.entryEls.get(entry.id)?.noteTextarea?.value ?? entry.note;
      const nextNote = draft.trimEnd();
      if (entry.kind === "note" && nextNote.trim().length === 0) {
        removedIds.add(entry.id);
        continue;
      }

      entry.note = nextNote;
      entry.noteOpen = false;
      nextEntries.push(entry);
    }

    this.workbench.entries = nextEntries;
    for (const id of removedIds) {
      this.entryEls.delete(id);
    }
    this.editingNotes.clear();
    this.pendingNoteFocusId = null;
    this.renderEntryList();
    return true;
  }

  getScrollContainer(): HTMLElement | null {
    return this.containerEl.querySelector<HTMLElement>(".view-content")
      ?? this.contentEl.parentElement
      ?? this.findScrollContainer(this.contentEl);
  }

  scrollEntryIntoView(id: string, behavior: ScrollBehavior): void {
    const container = this.getScrollContainer();
    const entryEl = this.entryEls.get(id)?.root;
    if (!container || !entryEl) return;

    const containerRect = container.getBoundingClientRect();
    const entryRect = entryEl.getBoundingClientRect();
    const viewTop = containerRect.top;
    const viewBottom = containerRect.bottom;
    const targetTopOffset = container.clientHeight * 0.34;

    const fullyVisible =
      entryRect.top >= viewTop + 12 &&
      entryRect.bottom <= viewBottom - 12;
    if (fullyVisible) return;

    const nextTop =
      container.scrollTop +
      (entryRect.top - viewTop) -
      targetTopOffset;

    container.scrollTo({
      top: Math.max(0, nextTop),
      behavior,
    });
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

    const toolbarEl = contentEl.createDiv({ cls: "sidecar-workbench__toolbar" });
    this.searchInputEl = toolbarEl.createEl("input", {
      cls: "sidecar-search-input",
      attr: {
        type: "search",
        placeholder: "Search excerpts and notes",
        "aria-label": "Search excerpts and notes",
      },
    });
    this.searchInputEl.value = this.searchQuery;
    this.searchInputEl.addEventListener("input", () => {
      this.syncEditorDrafts();
      this.searchQuery = this.searchInputEl?.value ?? "";
      this.renderEntryList();
    });

    this.sortButtonEl = toolbarEl.createEl("button", {
      cls: "sidecar-sort-button",
    });
    this.sortButtonEl.addEventListener("click", () => {
      this.syncEditorDrafts();
      this.sortOrder = this.sortOrder === "desc" ? "asc" : "desc";
      this.updateSortButton();
      this.renderEntryList();
    });
    this.updateSortButton();

    this.emptyEl = contentEl.createDiv({
      cls: "sidecar-workbench__empty",
      text: "Turn on excerpt mode, then select text in the source note.",
    });

    this.listEl = contentEl.createDiv({ cls: "sidecar-workbench__list" });
    this.backToTopButtonEl = contentEl.createEl("button", {
      cls: "sidecar-back-to-top",
      attr: {
        "aria-label": "Back to top",
        title: "Back to top",
      },
    });
    setIcon(this.backToTopButtonEl, "arrow-up");
    this.backToTopButtonEl.addEventListener("click", () => {
      this.getScrollContainer()?.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });
    this.registerWorkbenchScrollListener();
    this.renderEntryList();
  }

  private renderEntryList(): void {
    if (!this.listEl) return;
    this.syncEditorDrafts();
    this.listEl.empty();
    this.entryEls.clear();

    for (const entry of this.getVisibleEntries()) {
      this.appendEntry(entry);
    }

    this.updateEmptyState();
    this.applyPendingNoteFocus();
    this.updateBackToTopButton();
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
    const meta = header.createDiv({ cls: "sidecar-section__meta" });
    meta.createEl("span", { cls: "sidecar-section__label", text: "Excerpt" });
    this.appendEntryTime(meta, entry);
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
        void this.controller?.updateEntry(entry.id, { quote: textarea.value });
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
        ? "sidecar-entry__preview sidecar-entry__preview--collapsed sidecar-entry__preview--interactive"
        : "sidecar-entry__preview sidecar-entry__preview--interactive",
    });
    preview.addEventListener("click", () => {
      this.controller?.jumpToSourceEntry(entry.id);
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
        this.openNoteEditor(entry.id);
      });
      return null;
    }

    const section = root.createDiv({ cls: "sidecar-section sidecar-section--note" });
    const header = section.createDiv({ cls: "sidecar-section__header" });
    const meta = header.createDiv({ cls: "sidecar-section__meta" });
    meta.createEl("span", { cls: "sidecar-section__label", text: "Note" });
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
        entry.noteOpen = false;
        void this.controller?.updateEntry(entry.id, { note: textarea.value });
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
      this.openNoteEditor(entry.id);
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
    const meta = header.createDiv({ cls: "sidecar-section__meta" });
    meta.createEl("span", { cls: "sidecar-section__label", text: "Note" });
    this.appendEntryTime(meta, entry);
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
        void this.controller?.updateEntry(entry.id, { note: noteTextarea?.value ?? "" });
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
        this.openNoteEditor(entry.id);
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

  private updateSortButton(): void {
    if (!this.sortButtonEl) return;
    this.sortButtonEl.setText(this.sortOrder === "desc" ? "Newest" : "Oldest");
    this.sortButtonEl.setAttribute(
      "aria-label",
      this.sortOrder === "desc" ? "Sort newest first" : "Sort oldest first"
    );
  }

  private updateEmptyState(): void {
    if (!this.emptyEl) return;
    const hasEntries = this.workbench.entries.length > 0;
    const hasVisibleEntries = this.getVisibleEntries().length > 0;

    this.emptyEl.setText(
      hasEntries
        ? "No matching excerpts or notes."
        : "Turn on excerpt mode, then select text in the source note."
    );
    this.emptyEl.toggle(!hasEntries || !hasVisibleEntries);
  }

  private registerWorkbenchScrollListener(): void {
    const container = this.getScrollContainer();
    if (!container) return;

    container.removeEventListener("scroll", this.onBoundWorkbenchScroll);
    container.addEventListener("scroll", this.onBoundWorkbenchScroll, { passive: true });
    this.updateBackToTopButton();
  }

  private updateBackToTopButton(): void {
    if (!this.backToTopButtonEl) return;
    const container = this.getScrollContainer();
    if (!container) {
      this.backToTopButtonEl.toggleClass("is-visible", false);
      return;
    }

    const canScroll = container.scrollHeight > container.clientHeight + 8;
    const hasScrolled = container.scrollTop > 24;
    this.backToTopButtonEl.toggleClass("is-visible", canScroll && hasScrolled);
  }

  private getVisibleEntries(): ExcerptEntry[] {
    const query = this.normalizeSearchText(this.searchQuery);
    const entries = query
      ? this.workbench.entries.filter((entry) => this.entryMatchesSearch(entry, query))
      : [...this.workbench.entries];

    return entries.sort((left, right) => {
      const leftTime = this.getEntryTime(left);
      const rightTime = this.getEntryTime(right);
      return this.sortOrder === "desc"
        ? rightTime - leftTime
        : leftTime - rightTime;
    });
  }

  private entryMatchesSearch(entry: ExcerptEntry, query: string): boolean {
    const searchable = entry.kind === "excerpt"
      ? `${entry.quote}\n${entry.note}`
      : entry.note;
    return this.normalizeSearchText(searchable).includes(query);
  }

  private normalizeSearchText(value: string): string {
    return value.trim().toLocaleLowerCase();
  }

  private getEntryTime(entry: ExcerptEntry): number {
    return typeof entry.createdAt === "number" && !Number.isNaN(entry.createdAt)
      ? entry.createdAt
      : 0;
  }

  private appendEntryTime(parent: HTMLElement, entry: ExcerptEntry): void {
    const timestamp = this.getEntryTime(entry);
    if (timestamp <= 0) return;

    parent.createEl("span", {
      cls: "sidecar-entry-time",
      text: this.formatEntryTime(timestamp),
    });
  }

  private formatEntryTime(timestamp: number): string {
    return new Date(timestamp).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  private syncEditorDrafts(): void {
    for (const id of this.editingQuotes) {
      const entry = this.workbench.entries.find((item) => item.id === id);
      const textarea = this.entryEls.get(id)?.quoteTextarea;
      if (entry && textarea) {
        entry.quote = textarea.value;
      }
    }

    for (const id of this.editingNotes) {
      const entry = this.workbench.entries.find((item) => item.id === id);
      const textarea = this.entryEls.get(id)?.noteTextarea;
      if (entry && textarea) {
        entry.note = textarea.value;
      }
    }
  }

  private openNoteEditor(id: string): void {
    this.editingNotes.add(id);
    this.pendingNoteFocusId = id;
    this.renderEntryList();
  }

  private applyPendingNoteFocus(): void {
    if (!this.pendingNoteFocusId) return;
    const elements = this.entryEls.get(this.pendingNoteFocusId);
    const textarea = elements?.noteTextarea;
    if (!textarea) return;

    textarea.focus();
    textarea.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
    this.pendingNoteFocusId = null;
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
