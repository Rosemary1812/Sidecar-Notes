import { App, PluginSettingTab, Setting } from "obsidian";
import type DualLinkPlugin from "./main";
import type { CalloutType, ExportFormat, LeftExcerptFormat } from "./settings";

export class SidecarSettingTab extends PluginSettingTab {
  private plugin: DualLinkPlugin;

  constructor(app: App, plugin: DualLinkPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    const settings = this.plugin.manager?.getSettings();
    containerEl.empty();

    if (!settings) {
      containerEl.createEl("p", { text: "Sidecar settings are not available." });
      return;
    }

    new Setting(containerEl)
      .setName("Left excerpt format")
      .setDesc("How selected source text is rewritten after capture.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("highlight", "Highlight")
          .addOption("italic", "Italic")
          .addOption("bold", "Bold")
          .addOption("none", "No formatting")
          .setValue(settings.leftExcerptFormat)
          .onChange(async (value) => {
            await this.plugin.manager?.updateSettings({
              leftExcerptFormat: value as LeftExcerptFormat,
            });
          });
      });

    new Setting(containerEl)
      .setName("Auto-open sidecar")
      .setDesc("Open the excerpt workbench automatically when a Markdown note is opened.")
      .addToggle((toggle) => {
        toggle.setValue(settings.autoOpenSidecar).onChange(async (value) => {
          await this.plugin.manager?.updateSettings({ autoOpenSidecar: value });
        });
      });

    new Setting(containerEl)
      .setName("Auto-save summary file")
      .setDesc("Keep a Markdown summary file updated while editing excerpts and notes.")
      .addToggle((toggle) => {
        toggle.setValue(settings.autoSaveSummaryFile).onChange(async (value) => {
          await this.plugin.manager?.updateSettings({ autoSaveSummaryFile: value });
        });
      });

    new Setting(containerEl)
      .setName("Add bidirectional links")
      .setDesc("Add a link from the source note to the summary file and a source link in the summary file.")
      .addToggle((toggle) => {
        toggle.setValue(settings.addBidirectionalLinks).onChange(async (value) => {
          await this.plugin.manager?.updateSettings({ addBidirectionalLinks: value });
        });
      });

    new Setting(containerEl)
      .setName("Export excerpt format")
      .setDesc("Markdown style used for excerpts in exported notes.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("quote", "Quote block")
          .addOption("callout", "Callout")
          .setValue(settings.exportFormat)
          .onChange(async (value) => {
            await this.plugin.manager?.updateSettings({
              exportFormat: value as ExportFormat,
            });
          });
      });

    new Setting(containerEl)
      .setName("Export callout style")
      .setDesc("Callout type used when export excerpt format is callout.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("quote", "Quote")
          .addOption("note", "Note")
          .addOption("abstract", "Abstract")
          .addOption("info", "Info")
          .addOption("todo", "Todo")
          .addOption("tip", "Tip")
          .addOption("success", "Success")
          .addOption("question", "Question")
          .addOption("warning", "Warning")
          .addOption("failure", "Failure")
          .addOption("danger", "Danger")
          .addOption("bug", "Bug")
          .addOption("example", "Example")
          .setValue(settings.exportCalloutType)
          .onChange(async (value) => {
            await this.plugin.manager?.updateSettings({
              exportCalloutType: value as CalloutType,
            });
          });
      });

    new Setting(containerEl)
      .setName("Summary folder")
      .setDesc("Folder where Markdown summary files are created and updated.")
      .addText((text) => {
        text.setPlaceholder("Sidecar exports")
          .setValue(settings.exportFolder)
          .onChange(async (value) => {
            await this.plugin.manager?.updateSettings({ exportFolder: value });
          });
      });
  }
}
