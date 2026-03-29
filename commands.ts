import { Command, Notice, Plugin } from "obsidian";
import { DualLinkManager } from "./DualLinkManager";

export function registerCommands(
  plugin: Plugin,
  manager: DualLinkManager
): { toggle: Command; organize: Command } {
  const toggle: Command = {
    id: "sidecar-notes-toggle",
    name: "Toggle sidecar notes",
    callback: () => {
      void manager.toggle();
    },
  };

  const organize: Command = {
    id: "sidecar-notes-organize",
    name: "Organize sidecar notes into folder",
    callback: async () => {
      if (!manager.isActive()) {
        new Notice("Please activate sidecar notes first.");
        return;
      }
      await manager.organize();
    },
  };

  plugin.addCommand(toggle);
  plugin.addCommand(organize);

  return { toggle, organize };
}
