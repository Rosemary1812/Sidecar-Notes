import { Plugin, TFile } from "obsidian";
import { DualLinkManager, normalizePluginData } from "./DualLinkManager";
import { SidecarSettingTab } from "./SidecarSettingTab";
import { SIDECAR_VIEW_TYPE, SidecarView } from "./SidecarView";
import { registerCommands } from "./commands";
import type { SidecarPluginData } from "./settings";

export default class DualLinkPlugin extends Plugin {
  manager: DualLinkManager | null = null;
  private data: SidecarPluginData | null = null;

  async onload(): Promise<void> {
    this.data = normalizePluginData(await this.loadData());
    this.manager = new DualLinkManager(this.app, this.data, async (data) => {
      this.data = data;
      await this.saveData(data);
    });

    this.registerView(SIDECAR_VIEW_TYPE, (leaf) => new SidecarView(leaf));
    registerCommands(this, this.manager);

    this.addRibbonIcon("quote", "Toggle sidecar workbench", () => {
      void this.manager?.toggle();
    });

    this.addSettingTab(new SidecarSettingTab(this.app, this));

    this.registerEvent(
      this.app.workspace.on("file-open", (openedFile: TFile | null) => {
        void this.handleFileOpen(openedFile);
      })
    );
  }

  onunload(): void {
    this.manager?.deactivate();
    this.manager = null;
    this.data = null;
  }

  private async handleFileOpen(openedFile: TFile | null): Promise<void> {
    if (!this.manager || !openedFile) return;
    if (openedFile.extension !== "md") return;
    if (!this.manager.getSettings().autoOpenSidecar) return;
    if (this.manager.isActive() || this.manager.isActivating()) return;

    try {
      await this.manager.activateForCurrentFile();
    } catch (error) {
      console.error("[Sidecar Notes] Failed to auto-open workbench", error);
    }
  }
}
