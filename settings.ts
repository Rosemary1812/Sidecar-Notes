export type LeftExcerptFormat = "highlight" | "italic" | "bold" | "none";
export type CalloutType =
  | "quote"
  | "note"
  | "abstract"
  | "info"
  | "todo"
  | "tip"
  | "success"
  | "question"
  | "warning"
  | "failure"
  | "danger"
  | "bug"
  | "example";
export type ExportFormat = "quote" | "callout";

export interface SidecarSettings {
  leftExcerptFormat: LeftExcerptFormat;
  autoOpenSidecar: boolean;
  autoSaveSummaryFile: boolean;
  addBidirectionalLinks: boolean;
  exportFormat: ExportFormat;
  exportCalloutType: CalloutType;
  exportFolder: string;
}

export interface ExcerptEntry {
  id: string;
  kind: "excerpt" | "note";
  quote: string;
  note: string;
  noteOpen: boolean;
}

export interface WorkbenchData {
  entries: ExcerptEntry[];
  summaryPath?: string;
}

export interface SidecarPluginData {
  settings: SidecarSettings;
  workbenches: Record<string, WorkbenchData>;
}

export const DEFAULT_SETTINGS: SidecarSettings = {
  leftExcerptFormat: "highlight",
  autoOpenSidecar: true,
  autoSaveSummaryFile: true,
  addBidirectionalLinks: false,
  exportFormat: "quote",
  exportCalloutType: "quote",
  exportFolder: "Sidecar Exports",
};

export function createEmptyWorkbench(): WorkbenchData {
  return {
    entries: [],
  };
}
