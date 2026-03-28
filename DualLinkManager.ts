import {
  App,
  Editor,
  TFile,
  WorkspaceLeaf,
  Notice,
  MarkdownView,
} from "obsidian";
import { getNotesFilename } from "./utils";
import { DedupeStore } from "./DedupeStore";
import { Navigator } from "./Navigator";

export class DualLinkManager {
  private app: App;
  private isActiveFlag = false;
  private isActivatingFlag = false;

  // ── State ───────────────────────────────────────────────────────

  private sourceFile: TFile | null = null;
  private notesFile: TFile | null = null;
  private rightLeaf: WorkspaceLeaf | null = null;
  private leftEditor: Editor | null = null;
  private rightEditor: Editor | null = null;

  private dedupeStore = new DedupeStore();
  private navigator: Navigator | null = null;
  private notesContent = "";
  private pendingQuotes = new Set<string>();

  // DOM event listeners (always on the editor container — works in both CM5 and CM6)
  private onBoundMouseUp = () => this.syncSelection();
  private onBoundKeyUp = () => this.syncSelection();
  private onBoundLeftClick = (e: MouseEvent) => this.handleLeftClick(e);
  private onBoundRightClick = (e: MouseEvent) => this.handleRightClick(e);

  constructor(app: App) {
    this.app = app;
  }

  // ── Public API ─────────────────────────────────────────────────

  isActive(): boolean {
    return this.isActiveFlag;
  }

  isActivating(): boolean {
    return this.isActivatingFlag;
  }

  async toggle(): Promise<void> {
    if (this.isActiveFlag) {
      this.deactivate();
    } else {
      await this.activate();
    }
  }

  async organize(): Promise<void> {
    if (!this.isActiveFlag || !this.sourceFile || !this.notesFile) {
      new Notice("Sidecar Notes is not active.");
      return;
    }

    const folderName = this.sourceFile.basename;
    const parentPath =
      this.sourceFile.parent.path === "/" ? "" : this.sourceFile.parent.path;
    const folderPath = parentPath ? `${parentPath}/${folderName}` : `/${folderName}`;

    try {
      await this.app.vault.createFolder(folderPath);
    } catch (_e: unknown) {
      // Folder may already exist — ignore
    }

    const newSourcePath = `${folderPath}/${this.sourceFile.name}`;
    const newNotesPath = `${folderPath}/${this.notesFile.name}`;

    try {
      await this.app.fileManager.renameFile(this.sourceFile, newSourcePath);
      await this.app.fileManager.renameFile(this.notesFile, newNotesPath);

      this.sourceFile =
        this.app.vault.getAbstractFileByPath(newSourcePath) as TFile;
      this.notesFile =
        this.app.vault.getAbstractFileByPath(newNotesPath) as TFile;

      new Notice(`Organized into ${folderName}/`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      new Notice(`Failed to organize: ${msg}`);
    }
  }

  // ── Activation ─────────────────────────────────────────────────

  private getLeftEditor(): Editor | null {
    // Try CodeMirror 6 API first (newer Obsidian)
    if (this.app.workspace.getActiveEditor) {
      const ed = this.app.workspace.getActiveEditor();
      if (ed?.editor) return ed.editor;
    }

    // Fall back to CodeMirror 5 API
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view?.editor) return view.editor;

    return null;
  }

  private getEditorDom(editor: Editor): HTMLElement | null {
    // CodeMirror 6: editor.cm6.dom or editor.cm?.dom
    if ((editor as any).cm6) return (editor as any).cm6.dom;
    if ((editor as any).cm?.dom) return (editor as any).cm.dom;
    // Fallback: try the editor element directly
    return (editor as any).containerEl ?? null;
  }

  private async activate(): Promise<void> {
    // Always clean up any stale state first
    if (this.isActiveFlag) {
      this.deactivate();
    }
    if (this.isActivatingFlag) {
      return;
    }

    this.isActivatingFlag = true;

    try {
      const activeFile = this.app.workspace.getActiveFile();
      if (!activeFile) {
        new Notice("No active file to link.");
        return;
      }

      // ── 1. Get left editor ──
      const leftEditor = this.getLeftEditor();
      if (!leftEditor) {
        new Notice("Could not get left editor.");
        return;
      }
      this.leftEditor = leftEditor;

      // ── 2. Find or create the notes file ──
      this.sourceFile = activeFile;
      this.notesFile = await this.ensureNotesFile(activeFile);

      // ── 3. Split right and open notes file ──
      this.rightLeaf = this.app.workspace.splitActiveLeaf("vertical");
      await this.rightLeaf.openFile(this.notesFile);

      // ── 4. Get right editor ──
      // rightLeaf.view is a MarkdownView (both CM5 and CM6)
      const rightView = this.rightLeaf.view as MarkdownView;
      if (!rightView?.editor) {
        new Notice("Could not get right editor.");
        this.rightLeaf = null;
        return;
      }
      this.rightEditor = rightView.editor;

      // ── 5. Initialize dedupe store ──
      this.notesContent = await this.app.vault.read(this.notesFile);
      this.dedupeStore.initFromContent(this.notesContent);

      // ── 6. Initialize navigator ──
      this.navigator = new Navigator(
        this.leftEditor,
        this.rightEditor,
        () => this.notesContent
      );

      // ── 7. Register listeners ──
      this.registerListeners();

      this.isActiveFlag = true;
      new Notice("Sidecar Notes activated.");
    } finally {
      this.isActivatingFlag = false;
    }
  }

  public deactivate(): void {
    this.unregisterListeners();
    this.isActiveFlag = false;
    this.sourceFile = null;
    this.notesFile = null;
    this.rightLeaf = null;
    this.leftEditor = null;
    this.rightEditor = null;
    this.navigator = null;
    this.dedupeStore.clear();
    this.notesContent = "";
    this.pendingQuotes.clear();
  }

  // ── Notes File ─────────────────────────────────────────────────

  private async ensureNotesFile(sourceFile: TFile): Promise<TFile> {
    const notesName = getNotesFilename(sourceFile.name);
    const parentPath = sourceFile.parent.path === "/" ? "" : sourceFile.parent.path;
    const notesPath = parentPath ? `${parentPath}/${notesName}` : `/${notesName}`;

    const existing = this.app.vault.getAbstractFileByPath(notesPath);
    if (existing && (existing as TFile).extension) {
      return existing as TFile;
    }

    const created = await this.app.vault.create(notesPath, "");
    return created as TFile;
  }

  // ── Listeners ────────────────────────────────────────────────
  // All event listeners are attached to the editor's DOM container.
  // This is version-agnostic: works in both CodeMirror 5 and 6.

  private registerListeners(): void {
    if (!this.leftEditor || !this.rightEditor) return;

    const leftDom = this.getEditorDom(this.leftEditor);
    const rightDom = this.getEditorDom(this.rightEditor);

    // F2: mouseup / keyup trigger sync on the left editor
    if (leftDom) {
      leftDom.addEventListener("mouseup", this.onBoundMouseUp);
      leftDom.addEventListener("keyup", this.onBoundKeyUp);
    }

    // F4: click navigates
    if (leftDom) leftDom.addEventListener("click", this.onBoundLeftClick);
    if (rightDom) rightDom.addEventListener("click", this.onBoundRightClick);
  }

  private unregisterListeners(): void {
    if (this.leftEditor) {
      const leftDom = this.getEditorDom(this.leftEditor);
      if (leftDom) {
        leftDom.removeEventListener("mouseup", this.onBoundMouseUp);
        leftDom.removeEventListener("keyup", this.onBoundKeyUp);
        leftDom.removeEventListener("click", this.onBoundLeftClick);
      }
    }

    if (this.rightEditor) {
      const rightDom = this.getEditorDom(this.rightEditor);
      if (rightDom) {
        rightDom.removeEventListener("click", this.onBoundRightClick);
      }
    }
  }

  // ── Selection Sync (F2) ───────────────────────────────────────

  private syncSelection(): void {
    if (!this.leftEditor || !this.notesFile) return;

    const selection = this.leftEditor.getSelection();
    const trimmed = selection.trim();
    if (!trimmed) return;

    if (this.dedupeStore.has(trimmed) || this.pendingQuotes.has(trimmed)) return;

    // Persistent highlight: wrap selection in ==...==
    this.leftEditor.replaceSelection(`==${trimmed}==`);

    // Append raw text (without == markers) to the notes file
    void this.appendQuote(trimmed);
  }

  private async appendQuote(quote: string): Promise<void> {
    if (!this.notesFile) return;

    const normalized = `> ${quote}\n\n`;
    this.pendingQuotes.add(quote);
    try {
      await this.app.vault.process(this.notesFile, (content) => {
        return content + normalized;
      });

      // Append to the IN-MEMORY cache for Navigator cross-file searches.
      // Do NOT call setValue() — Obsidian's live-sync mechanism
      // already refreshes the right editor from disk, and calling
      // setValue() here would overwrite the user's manual edits.
      // Instead, keep the cache in sync with what vault.process wrote.
      this.notesContent += normalized;
      this.dedupeStore.add(quote);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      new Notice(`Failed to append quote: ${msg}`);
    } finally {
      this.pendingQuotes.delete(quote);
    }
  }

  // ── Navigation (F4) ──────────────────────────────────────────

  private handleLeftClick(_e: MouseEvent): void {
    if (!this.navigator || !this.leftEditor) return;
    const cursor = this.leftEditor.getCursor();
    const lineText = this.leftEditor.getLine(cursor.line);
    this.navigator.navigateLeftToRight(lineText);
  }

  private handleRightClick(_e: MouseEvent): void {
    if (!this.navigator || !this.rightEditor) return;
    const cursor = this.rightEditor.getCursor();
    const lineText = this.rightEditor.getLine(cursor.line);
    this.navigator.navigateRightToLeft(lineText);
  }
}
