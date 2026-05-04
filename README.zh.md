# Sidecar Notes

[English](./README.md) | 中文

左边阅读，右边摘录。

Sidecar Notes 是一个 Obsidian 桌面插件，用来在阅读 Markdown 笔记时建立摘录式笔记。打开一篇原文笔记，开启摘录模式，选中左侧文本后，摘录会进入右侧的自定义工作台。

## 亮点

- 使用右侧自定义摘录工作台，不再把右侧当作 Markdown sidecar 编辑器
- 摘录模式：左侧选中文本后自动进入工作台
- 可配置左侧原文格式：高亮、加粗、斜体或不改格式
- 每条摘录都可以单独添加 Markdown 笔记
- 支持新增不绑定摘录的独立笔记
- 长摘录支持展开和折叠
- 摘录和笔记都支持 Markdown 渲染
- 自动保存为 Markdown 摘要文件
- 可选开启原文和摘要文件之间的双向链接
- 导出摘录时支持 quote block 或 Obsidian callout

## 使用方式

1. 打开一篇 Markdown 笔记。
2. 执行 `Sidecar Notes: Toggle excerpt workbench`，或点击侧边栏图标。
3. 在工作台中保持 `Excerpt mode: On`。
4. 在左侧原文中选择文本。
5. 选中文本会作为摘录卡片进入右侧工作台。
6. 可以为任意摘录添加笔记。
7. 点击 `Sync` 可立即同步 Markdown 摘要文件。

## 设置项

- `Left excerpt format`：控制左侧选中文本被摘录后如何改写。
- `Auto-open sidecar`：打开 Markdown 笔记时自动打开摘录工作台。
- `Auto-save summary file`：编辑摘录和笔记时自动更新 Markdown 摘要文件。
- `Add bidirectional links`：在原文和摘要文件之间添加双向链接。
- `Export excerpt format`：摘录导出为 quote block 或 callout。
- `Export callout style`：选择 quote、note、tip、success、todo、warning 等 Obsidian callout 类型。
- `Summary folder`：生成摘要文件的文件夹。

## 摘要文件

开启自动保存后，Sidecar Notes 会创建或更新：

```text
Sidecar Exports/{原文笔记名} Notes.md
```

工作台状态也会保存在插件数据中，所以重新打开同一篇原文笔记时，可以恢复之前的摘录和笔记。

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
