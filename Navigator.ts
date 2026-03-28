import { Editor, EditorPosition } from "obsidian";
import { extractQuote } from "./utils";

export class Navigator {
  constructor(
    private leftEditor: Editor,
    private rightEditor: Editor,
    private notesFileContent: () => string
  ) {}

  /**
   * Left → Right: user clicked in the source note.
   * Scroll the right notes pane to the matching "> {lineText}" block.
   */
  navigateLeftToRight(lineText: string): void {
    // Strip ==...== highlight markers so the comparison works
    // whether the user has persistent highlights enabled or not
    const cleanText = lineText.replace(/==([^=]+)==/g, '$1').trim();
    if (!cleanText) return;

    const content = this.notesFileContent();
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const quote = extractQuote(lines[i]);
      if (quote !== null && quote.trim() === cleanText) {
        this.rightEditor.setCursor({ line: i, ch: 0 });
        this.rightEditor.scrollIntoView(
          { from: { line: i, ch: 0 }, to: { line: i, ch: 0 } },
          { y: "center" }
        );
        return;
      }
    }
  }

  /**
   * Right → Left: user clicked in the notes pane.
   * If on a quote line, scroll the left source pane to the matching text.
   * If on a user note line (not starting with "> "), do nothing.
   */
  navigateRightToLeft(lineText: string): void {
    const quote = extractQuote(lineText);
    if (quote === null) return;

    const target = quote.trim();
    const content = this.leftEditor.getValue();
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === target) {
        this.leftEditor.setCursor({ line: i, ch: 0 });
        this.leftEditor.scrollIntoView(
          { from: { line: i, ch: 0 }, to: { line: i, ch: 0 } },
          { y: "center" }
        );
        return;
      }
    }
  }
}
