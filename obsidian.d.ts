// Minimal type declarations for Obsidian Plugin API
// Used only for TypeScript type checking — not bundled at runtime

declare module "obsidian" {
  export class Plugin {
    app: App;
    constructor(app: App);
    onload(): void | Promise<void>;
    onunload(): void | Promise<void>;
    addCommand(command: Command): Command;
    addRibbonIcon(
      icon: string,
      title: string,
      callback: (e: MouseEvent) => void
    ): HTMLElement;
    registerEvent(eventRef: EventRef): void;
  }

  export class Notice {
    constructor(message: string, timeout?: number);
  }

  // View types
  export class MarkdownView {
    editor: Editor;
  }

  export interface App {
    vault: Vault;
    workspace: Workspace;
    commands: Commands;
    fileManager: FileManager;
  }

  export interface Vault {
    getActiveFile(): TFile | null;
    getAbstractFileByPath(path: string): TAbstractFile | null;
    create(path: string, data: string): Promise<TFile>;
    createFolder(path: string): Promise<void>;
    read(file: TFile): Promise<string>;
    modify(file: TFile, data: string): Promise<void>;
    process(
      file: TFile,
      fn: (data: string) => string
    ): Promise<void>;
    rename(file: TFile, newPath: string): Promise<TFile>;
  }

  export interface Workspace {
    getActiveFile(): TFile | null;
    // CodeMirror 5 (older Obsidian): getActiveViewOfType
    getActiveViewOfType<T>(type: new (...args: any[]) => T): T | null;
    // CodeMirror 6 (newer Obsidian): getActiveEditor
    getActiveEditor?(): EditorFromPlugin | null;
    splitActiveLeaf(direction: "vertical" | "horizontal"): WorkspaceLeaf;
    // Workspace events — returns EventRef for use with registerEvent
    on(name: "activeLeafChange", callback: () => void): EventRef;
    on(name: "file-open", callback: (file: TFile | null) => void): EventRef;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface EventRef {}

  export interface WorkspaceLeaf {
    openFile(file: TFile): Promise<void>;
    view: any;
  }

  export interface Commands {
    addCommand(command: Command): Command;
  }

  export interface Command {
    id: string;
    name: string;
    callback?: () => void | Promise<void>;
    checkCallback?: (checking: boolean) => boolean | void;
  }

  export interface FileManager {
    renameFile(file: TAbstractFile, newPath: string): Promise<TFile>;
  }

  export interface TAbstractFile {
    path: string;
    name: string;
  }

  export interface TFile extends TAbstractFile {
    basename: string;
    extension: string;
    parent: TFolder;
  }

  export interface TFolder extends TAbstractFile {
    children: TAbstractFile[];
  }

  export interface EditorFromPlugin {
    editor: Editor;
  }

  // Editor interface — compatible with both CodeMirror 5 and 6
  export interface Editor {
    getSelection(): string;
    replaceSelection(text: string): void;
    getCursor(): EditorPosition;
    getLine(line: number): string;
    setCursor(pos: EditorPosition): void;
    setValue(content: string): void;
    getValue(): string;
    scrollIntoView(
      range: { from: EditorPosition; to: EditorPosition },
      scrollIntoViewOptions?: { y?: "center" | "nearest" | number; x?: "center" | "nearest" | number }
    ): void;
    // CodeMirror 5 Editor instance
    cm?: { dom: HTMLElement };
    // CodeMirror 6 EditorView
    cm6?: { dom: HTMLElement };
    // CodeMirror 5 event API
    on?(
      event: "cursorActivity",
      callback: (e: EditorSelectionChangeEvent) => void
    ): void;
    off?(
      event: "cursorActivity",
      callback: (e: EditorSelectionChangeEvent) => void
    ): void;
  }

  export interface EditorPosition {
    line: number;
    ch: number;
  }

  export interface EditorSelectionChangeEvent {
    editor: Editor;
    selections: { from: EditorPosition; to: EditorPosition }[];
  }
}
