# Sidecar Notes

[![GitHub release](https://img.shields.io/github/v/release/Rosemary1812/Sidecar-Notes?style=flat-square)](https://github.com/Rosemary1812/Sidecar-Notes/releases)
[![MIT License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](./LICENSE)
[![Obsidian](https://img.shields.io/badge/Obsidian-Plugin-7C3AED?style=flat-square)](https://obsidian.md)

English | [中文](#中文说明)

Read on the left. Capture on the right.

Sidecar Notes is an Obsidian plugin that opens a source note beside a dedicated companion note, then lets you send selected text into that companion file as blockquotes. It is designed for reading notes, literature notes, article annotation, and any workflow where you want the source and your notes visible at the same time.

## Highlights

- Split view workflow for a source note and its sidecar note
- Automatic companion file creation with the naming rule `{basename} notes.md`
- Selected text is appended to the sidecar note as blockquotes
- Duplicate quote protection for both current-session and existing saved content
- One command to organize the source note and its sidecar note into the same folder

## Demo

Add screenshots or a short GIF here before publishing to the Obsidian directory.

Recommended assets:

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
2. Create or open `.obsidian/plugins/sidecar-notes`
3. Copy these files into that folder:
   - `main.js`
   - `manifest.json`
   - `versions.json`
4. Reload Obsidian
5. Enable `Sidecar Notes`

## Usage

1. Open a Markdown note
2. Run `Sidecar Notes: Toggle` or click the ribbon icon
3. Sidecar Notes opens a split view and creates or opens the companion note
4. Select text in the source pane
5. The plugin wraps the selected text in `==highlight==` and appends the raw text to the sidecar note as a blockquote
6. Continue writing your own interpretation, summary, or notes in the sidecar file

## Commands

- `Sidecar Notes: Toggle`
- `Sidecar Notes: Organize into folder`

## File Naming

```text
{basename} notes.md
```

Example:

- Source note: `Book Chapter 1.md`
- Sidecar note: `Book Chapter 1 notes.md`

## Good Fit For

- Reading notes
- Literature notes
- Research excerpts
- Course notes
- Long-form article annotation

## Current Limitations

- Desktop only
- Designed for Markdown note workflows
- Selected source text is wrapped with `==highlight==`
- Companion note naming is currently fixed to `{basename} notes.md`

## Development

```bash
npm install
npm run build
```

For live rebuilds:

```bash
npm run dev
```

## Release Files

For each release, upload these files to GitHub Releases:

- `main.js`
- `manifest.json`
- `versions.json`

## Roadmap

- Configurable companion note naming
- Settings tab
- Better mobile support
- More output formats besides blockquotes

---

## 中文说明

English | 中文

左边读原文，右边写笔记。

Sidecar Notes 是一个 Obsidian 插件，用来把原始笔记和配套笔记并排打开。你在左侧选中的内容，会自动追加到右侧 sidecar note 中，格式为引用块。它适合阅读笔记、文献摘录、长文批注，以及任何“边看边记”的工作流。

## 亮点

- 左右分栏打开原文和 sidecar note
- 自动创建配套笔记，命名规则为 `{basename} notes.md`
- 选中文本后自动追加到 sidecar note 中，格式为引用块
- 避免本次会话和已有内容中的重复摘录
- 可一键把原文件和配套笔记整理到同一文件夹

## 演示

建议在正式发布前补 2 到 3 张截图或一段简短 GIF。

建议文件名：

- `docs/screenshot-split-view.png`
- `docs/screenshot-quote-sync.png`
- `docs/screenshot-organize.png`

## 安装

### 社区插件安装

插件被 Obsidian 社区插件目录收录后：

1. 打开 `Settings`
2. 进入 `Community plugins`
3. 如有需要，关闭 `Restricted mode`
4. 搜索 `Sidecar Notes`
5. 安装并启用

### 手动安装

1. 打开你的 vault 文件夹
2. 创建或进入 `.obsidian/plugins/sidecar-notes`
3. 把以下文件复制进去：
   - `main.js`
   - `manifest.json`
   - `versions.json`
4. 重启或重新加载 Obsidian
5. 启用 `Sidecar Notes`

## 使用方式

1. 打开一篇 Markdown 笔记
2. 执行 `Sidecar Notes: Toggle`，或点击侧边栏图标
3. 插件会以分栏方式打开当前笔记，并创建或打开对应的配套笔记
4. 在左侧选择一段文字
5. 插件会把所选文本包成 `==highlight==`，并把原始文本以引用块形式追加到右侧配套笔记
6. 继续在右侧写你自己的总结、评论或整理内容

## 命令

- `Sidecar Notes: Toggle`
- `Sidecar Notes: Organize into folder`

## 文件命名规则

```text
{basename} notes.md
```

例如：

- 原文件：`Book Chapter 1.md`
- 配套笔记：`Book Chapter 1 notes.md`

## 适合的场景

- 阅读笔记
- 文献摘录
- 研究记录
- 课程笔记
- 长文批注

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

## Release 附件

每次发布 GitHub Release 时，上传这几个文件：

- `main.js`
- `manifest.json`
- `versions.json`

## 后续方向

- 支持自定义配套笔记命名规则
- 增加设置页
- 改善移动端支持
- 支持更多输出格式，而不仅是引用块
