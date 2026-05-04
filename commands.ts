import { Command, Plugin } from "obsidian";
import { DualLinkManager } from "./DualLinkManager";

export function registerCommands(
  plugin: Plugin,
  manager: DualLinkManager
): { toggle: Command; exportMarkdown: Command } {
  const toggle: Command = {
    id: "sidecar-notes-toggle",
    name: "Toggle excerpt workbench",
    callback: () => {
      void manager.toggle();
    },
  };

  const exportMarkdown: Command = {
    id: "sidecar-notes-export-markdown",
    name: "Export excerpts to Markdown",
    callback: () => {
      void manager.exportMarkdown();
    },
  };

  plugin.addCommand(toggle);
  plugin.addCommand(exportMarkdown);

  return { toggle, exportMarkdown };
}
