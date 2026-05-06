# Sidecar Notes

[English](./README.md) | 中文

左边阅读，右边摘录。

Sidecar Notes 是一个 Obsidian 桌面插件，适合做“摘录式阅读笔记”。它会在右侧提供一个专门的工作台，让你在左边继续阅读原文的同时，把摘录、批注和临时笔记整理到右边，而不是把整个流程做成固定模板。

## 这个插件怎么用

Sidecar Notes 的核心流程很简单：

1. 打开一篇 Markdown 笔记。
2. 打开 Sidecar Notes。
3. 在左侧选中文本。
4. 在右侧整理摘录和笔记。
5. 需要时再同步成一篇 Markdown 笔记。

## 界面展示

![Sidecar Notes 主界面](./assets/notes.png)

![Sidecar Notes 设置面板](./assets/settings.png)

## 快速开始

1. 在 Obsidian 中打开一篇 Markdown 笔记。
2. 执行 `Sidecar Notes: Toggle excerpt workbench`，或者点击侧边栏图标。
3. 保持右侧工作台中的 `Excerpt mode: On`。
4. 在左侧原文中选择文本。
5. 选中的文本会进入右侧，成为一张摘录卡片。
6. 你可以搜索、排序、补充笔记，或点击摘录卡片跳回左侧原文。
7. 如果想立即更新导出的 Markdown 笔记，点击 `Sync` 即可。

## 它能做什么

- 把“阅读”和“摘录整理”拆成左右分栏，而不是全塞进同一个编辑器。
- 把左侧选中的文本直接捕获到右侧摘录工作台。
- 支持选择左侧原文的标记方式：`highlight`、`bold`、`italic` 或 `none`。
- 支持在当前工作台内搜索摘录和笔记。
- 显示摘录和笔记的创建时间，并支持按最新/最早排序。
- 点击右侧摘录卡片，可以跳回左侧对应原文。
- 支持为每条摘录附加笔记。
- 支持创建不绑定摘录的独立笔记。
- 右侧摘录和笔记都支持 Markdown 渲染。
- 长摘录支持展开和折叠。
- 支持自动同步或手动同步到 Markdown 笔记。
- 摘录导出时支持 quote block 或 Obsidian callout。
- 支持在原文笔记和导出笔记之间添加双向链接。

## 设置项说明

- `Left excerpt format`
  控制左侧选中文本在被摘录后如何标记。
- `Summary font size`
  调整右侧工作台正文预览的字号。
- `Auto-open sidecar`
  打开 Markdown 笔记时是否自动打开工作台。
- `Auto-save summary file`
  编辑摘录和笔记时，是否持续更新导出的 Markdown 笔记。
- `Add bidirectional links`
  是否在原文笔记和导出笔记之间自动添加双向链接。
- `Export excerpt format`
  控制摘录导出为 quote block 还是 callout。
- `Export callout style`
  当导出格式为 callout 时，选择具体的 Obsidian callout 类型。
- `Summary folder`
  设置导出的 Markdown 笔记保存到哪个文件夹，支持用 `/` 设置多级路径，例如 `Sidecar Exports/Books`。

## 导出的笔记

开启自动保存后，Sidecar Notes 会创建或更新类似这样的笔记：

```text
Sidecar Exports/{原文笔记名} Notes.md
```

工作台状态也会保存在插件数据中，所以重新打开同一篇原文笔记时，可以恢复之前的摘录和笔记。

## 适合什么场景

Sidecar Notes 更适合这些场景：

- 一边阅读一边摘录
- 收集引用，同时顺手补一些短批注
- 想做阅读笔记，但不想被固定模板限制
- 最后整理出一篇干净的 Markdown 笔记

它并不打算做成：

- 自动摘要工具
- 固定结构的读书笔记模板
- 预设大量分区的完整写作系统

## 手动安装

把以下文件复制到：

```text
<vault>/.obsidian/plugins/sidecar-notes/
```

必需文件：

- `main.js`
- `manifest.json`
- `styles.css`
- `versions.json`

重新加载 Obsidian，然后启用 `Sidecar Notes`。

## 开发

```bash
npm install
npm run build
```

开发监听模式：

```bash
npm run dev
```

## 发布文件

每次 GitHub Release 需要上传：

- `main.js`
- `manifest.json`
- `styles.css`
- `versions.json`
