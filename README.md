# Sidecar Notes

English | [中文](#中文说明)

Sidecar Notes is an Obsidian plugin for reading and annotating a source note alongside a dedicated companion note. It opens a side-by-side workspace, writes selected text into the companion file as blockquotes, and keeps the workflow focused on capture instead of manual copy-paste.

## What It Does

Sidecar Notes helps when you want to read a note on one side and keep structured reading notes on the other side.

Typical workflow:

- Open a source note
- Launch Sidecar Notes
- Let the plugin create or open a companion note
- Select important passages in the source note
- Keep your own summary, comments, and synthesis in the sidecar file

This is useful for:

- Reading notes
- Literature notes
- Course notes
- Research excerpts
- Long-form article annotation

## Features

- Open the current note with a companion note in split view
- Create a `{basename} notes.md` file automatically when needed
- Append selected text to the companion note as blockquotes
- Avoid duplicate quote insertion within a session and against existing saved quotes
- Organize a source file and its companion note into a dedicated folder

## Screenshots

Add screenshots or a short GIF here before publishing. A good set is:

- Source note and sidecar note shown side by side
- Text selection syncing into the sidecar file
- Organize command result

Suggested file names if you add them later:

- `docs/screenshot-split-view.png`
- `docs/screenshot-quote-sync.png`
- `docs/screenshot-organize.png`

## Installation

### Community Plugins

After the plugin is accepted into the Obsidian Community Plugins directory:

1. Open `Settings`
2. Go to `Community plugins`
3. Turn off `Restricted mode` if needed
4. Search for `Sidecar Notes`
5. Install and enable the plugin

### Manual Installation

1. Open your vault folder
2. Go to `.obsidian/plugins/sidecar-notes`
3. Copy these files into that folder:
   - `main.js`
   - `manifest.json`
   - `versions.json`
4. Reload Obsidian
5. Enable `Sidecar Notes` in Community Plugins

## Commands

- `Sidecar Notes: Toggle`
- `Sidecar Notes: Organize into folder`

## Usage

1. Open a Markdown note.
2. Run `Sidecar Notes: Toggle` or click the ribbon icon.
3. Sidecar Notes opens a split view and creates or opens the companion note for the active file.
4. Select text in the source pane. The plugin wraps the selection in `==highlight==` and appends the raw text to the companion notes file as a blockquote.
5. Continue writing your own notes in the sidecar file.
6. If needed, run `Sidecar Notes: Organize into folder` to move the source file and its companion note into one folder.

## File Naming

The companion file naming rule is:

```text
{basename} notes.md
```

Example:

- Source note: `Book Chapter 1.md`
- Companion note: `Book Chapter 1 notes.md`

## Current Limitations

- Desktop only for now
- The plugin currently assumes a Markdown note workflow
- Selected source text is wrapped with `==highlight==`
- Companion note naming is fixed to `{basename} notes.md`

## Development

```bash
npm install
npm run build
```

For live rebuilds:

```bash
npm run dev
```

## Release Checklist

- Verify `manifest.json` metadata before publishing, especially `author`, `authorUrl`, `fundingUrl`, and `minAppVersion`
- Build release artifacts: `main.js`, `manifest.json`, and `styles.css` if applicable
- Create a GitHub release whose tag matches the plugin version
- Upload the release artifacts to the GitHub release
- Submit the plugin repository to `obsidianmd/obsidian-releases`

## Roadmap Ideas

- Configurable companion note naming
- Settings tab
- Better mobile support
- More note insertion formats besides blockquotes
- Smarter navigation between source and extracted quotes

---

## 中文说明

Sidecar Notes 是一个 Obsidian 插件，用来把“原文阅读”和“配套笔记”放在左右两个面板里一起工作。它会为当前笔记创建一个 companion note，把你选中的原文自动追加成引用块，减少来回复制粘贴。

## 它适合做什么

这个插件适合你一边读原文、一边写整理笔记的场景。

典型流程：

- 打开一篇原始笔记
- 启动 Sidecar Notes
- 自动打开或创建对应的配套笔记
- 在左侧原文中选择重要内容
- 在右侧 sidecar 文件里继续写自己的总结、注释和整理

适用场景：

- 阅读笔记
- 文献摘录
- 课程笔记
- 研究记录
- 长文批注

## 功能

- 以左右分栏方式同时打开当前笔记和配套笔记
- 在需要时自动创建 `{basename} notes.md`
- 将选中的原文追加到配套笔记中，格式为引用块
- 避免本次会话内以及已保存内容中的重复摘录
- 可将原文件和配套笔记整理到同一个文件夹

## 截图

建议在正式发布前补 2 到 3 张截图，或者一段简短 GIF。比较适合展示的内容有：

- 左右分栏下的原文与 sidecar 笔记
- 选中文本后自动同步到右侧引用块
- 执行整理命令后的文件结构

如果你后续补图，建议文件名可以用：

- `docs/screenshot-split-view.png`
- `docs/screenshot-quote-sync.png`
- `docs/screenshot-organize.png`

## 安装

### 社区插件安装

等插件被 Obsidian 社区插件目录收录后：

1. 打开 `Settings`
2. 进入 `Community plugins`
3. 如有需要，关闭 `Restricted mode`
4. 搜索 `Sidecar Notes`
5. 安装并启用插件

### 手动安装

1. 打开你的 vault 文件夹
2. 进入 `.obsidian/plugins/sidecar-notes`
3. 把以下文件复制进去：
   - `main.js`
   - `manifest.json`
   - `versions.json`
4. 重启或重新加载 Obsidian
5. 在社区插件列表中启用 `Sidecar Notes`

## 命令

- `Sidecar Notes: Toggle`
- `Sidecar Notes: Organize into folder`

## 使用方式

1. 打开一篇 Markdown 笔记。
2. 执行 `Sidecar Notes: Toggle`，或点击侧边栏图标。
3. 插件会以分栏方式打开当前笔记，并创建或打开对应的配套笔记。
4. 在左侧原文中选择一段文字，插件会把这段文字包成 `==highlight==`，并把原始文本追加到配套笔记里，格式为引用块。
5. 在右侧配套笔记里继续写你自己的整理内容。
6. 如果需要，可以执行 `Sidecar Notes: Organize into folder`，把原文件和配套笔记移动到同一个文件夹中。

## 文件命名规则

配套笔记命名规则为：

```text
{basename} notes.md
```

例如：

- 原文件：`Book Chapter 1.md`
- 配套笔记：`Book Chapter 1 notes.md`

## 当前限制

- 当前仅支持桌面端
- 当前主要面向 Markdown 笔记工作流
- 选中的原文会被包成 `==highlight==`
- 配套笔记文件名目前固定为 `{basename} notes.md`

## 开发

```bash
npm install
npm run build
```

开发监听模式：

```bash
npm run dev
```

## 发布前检查

- 发布前确认 `manifest.json` 中的 `author`、`authorUrl`、`fundingUrl`、`minAppVersion`
- 生成发布文件：`main.js`、`manifest.json`，如果有样式文件再带上 `styles.css`
- 在 GitHub 上创建与版本号对应的 Release
- 把发布文件作为 Release 附件上传
- 向 `obsidianmd/obsidian-releases` 提交收录 PR

## 后续可以继续做的方向

- 支持自定义配套笔记命名规则
- 增加设置页
- 改善移动端支持
- 支持更多摘录写入格式，而不仅是引用块
- 改进原文与摘录之间的跳转体验
