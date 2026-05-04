# Sidecar Notes

English | [中文](./README.zh.md)

Read on the left. Capture on the right.

Sidecar Notes is an Obsidian desktop plugin for building excerpt-based notes while reading. Open a Markdown note, turn on excerpt mode, select text in the source note, and manage the captured excerpts in a dedicated right-side workbench.

## Highlights

- Right-side custom excerpt workbench instead of a Markdown sidecar editor
- Excerpt mode: selected source text is captured into the workbench
- Configurable source formatting: highlight, bold, italic, or no formatting
- Each excerpt can have an optional Markdown note
- Standalone notes can be added without an excerpt
- Long excerpts can be expanded or collapsed in the workbench
- Markdown rendering for excerpts and notes
- Auto-save to a Markdown summary file
- Optional bidirectional links between source note and summary file
- Export excerpt formatting as quote blocks or Obsidian callouts

## Usage

1. Open a Markdown note.
2. Run `Sidecar Notes: Toggle excerpt workbench` or click the ribbon icon.
3. Use `Excerpt mode: On` in the workbench.
4. Select text in the source note.
5. The selected text is added as an excerpt card in the workbench.
6. Optionally add a note to any excerpt.
7. Use `Sync` to immediately update the Markdown summary file.

## Settings

- `Left excerpt format`: controls how selected source text is rewritten.
- `Auto-open sidecar`: opens the workbench automatically for Markdown notes.
- `Auto-save summary file`: keeps a Markdown summary file updated while editing.
- `Add bidirectional links`: links the source note and summary file.
- `Export excerpt format`: quote block or callout.
- `Export callout style`: quote, note, tip, success, todo, warning, and other Obsidian callout types.
- `Summary folder`: folder for generated summary files.

## Summary Files

When auto-save is enabled, Sidecar Notes creates or updates:

```text
Sidecar Exports/{source note name} Notes.md
```

The workbench state is also stored in plugin data, so excerpts and notes can be restored when reopening the same source note.

## Manual Installation

Copy these files into:

```text
<vault>/.obsidian/plugins/sidecar-notes/
```

Required files:

- `main.js`
- `manifest.json`
- `styles.css`
- `versions.json`

Reload Obsidian and enable `Sidecar Notes`.

## Development

```bash
npm install
npm run build
```

For watch mode:

```bash
npm run dev
```

## Release Files

Upload these files for each GitHub release:

- `main.js`
- `manifest.json`
- `styles.css`
- `versions.json`
