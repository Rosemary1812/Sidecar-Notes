import { Command, Notice, Plugin } from "obsidian";
import { DualLinkManager } from "./DualLinkManager";

export function registerCommands(
  plugin: Plugin,
  manager: DualLinkManager
): { toggle: Command; organize: Command } {
  const toggle: Command = {
    id: "sidecar-notes-toggle",
    name: "Sidecar Notes: toggle",
    callback: () => {
      void manager.toggle();
    },
  };

  const organize: Command = {
    id: "sidecar-notes-organize",
    name: "Sidecar Notes: organize into folder",
    callback: async () => {
      if (!manager.isActive()) {
        new Notice("Please activate Sidecar Notes first.");
        return;
      }
      await manager.organize();
    },
  };

  plugin.addCommand(toggle);
  plugin.addCommand(organize);

  return { toggle, organize };
}
