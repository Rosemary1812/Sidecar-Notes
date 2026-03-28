import { parseExistingQuotes } from "./utils";

/**
 * Manages a deduplication set for quote strings.
 * - `has()` / `add()` for O(1) dedup checks within a session.
 * - `initFromContent()` parses an existing notes file to prime the set.
 */
export class DedupeStore {
  private set: Set<string>;

  constructor() {
    this.set = new Set();
  }

  /**
   * Initialize the store from an existing notes file's raw content.
   * Parses all "> ..." lines and seeds the set with them.
   */
  initFromContent(content: string): void {
    const quotes = parseExistingQuotes(content);
    for (const q of quotes) {
      this.set.add(q);
    }
  }

  has(text: string): boolean {
    return this.set.has(text.trim());
  }

  add(text: string): void {
    this.set.add(text.trim());
  }

  clear(): void {
    this.set.clear();
  }
}
