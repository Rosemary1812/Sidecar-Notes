import { Plugin, TFile } from "obsidian";
import { DualLinkManager } from "./DualLinkManager";
import { registerCommands } from "./commands";
import { getNotesFilename, isCompanionNotesFile } from "./utils";

export default class DualLinkPlugin extends Plugin {
  private manager: DualLinkManager | null = null;

  async onload(): Promise<void> {
    this.manager = new DualLinkManager(this.app);

    // Register commands
    registerCommands(this, this.manager);

    // Ribbon icon — "columns" is a valid Obsidian SVG icon
    this.addRibbonIcon("columns", "Toggle Sidecar Notes", () => {
      this.manager?.toggle();
    });

    // Auto-activation: when a file is opened (via file-open event, not activeLeafChange),
    // check if it has a paired notes file and auto-activate dual link mode.
    this.registerEvent(
      this.app.workspace.on("file-open", async (openedFile: TFile | null) => {
        if (!this.manager || !openedFile) return;

        // Only auto-activate if not already active and not already in-flight
        if (this.manager.isActive() || this.manager.isActivating()) return;

        // Never auto-activate when the opened file is already the companion notes file
        if (isCompanionNotesFile(openedFile.name)) return;

        // Check if the paired notes file exists
        const notesName = getNotesFilename(openedFile.name);
        const parentPath = openedFile.parent.path === "/" ? "" : openedFile.parent.path;
        const notesPath = parentPath ? `${parentPath}/${notesName}` : `/${notesName}`;
        const pairedFile = this.app.vault.getAbstractFileByPath(notesPath);

        if (pairedFile && (pairedFile as TFile).extension) {
          // Paired notes file found — auto activate
          await this.manager.toggle();
        }
      })
    );

    console.log("[SidecarNotes] Plugin loaded.");
  }

  onunload(): void {
    this.manager?.deactivate();
    this.manager = null;
    console.log("[SidecarNotes] Plugin unloaded.");
  }
}
