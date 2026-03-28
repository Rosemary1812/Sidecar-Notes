/**
 * Generates the notes filename for a given source file.
 * Rule: "{basename} notes.md" (space-separated)
 */
export function getNotesFilename(sourceFileBasename: string): string {
  const withoutExt = sourceFileBasename.replace(/\.[^.]+$/, "");
  return `${withoutExt} notes.md`;
}

/**
 * Returns true when a file name matches this plugin's companion note pattern.
 */
export function isCompanionNotesFile(filename: string): boolean {
  return / notes\.md$/i.test(filename);
}

/**
 * Extracts the quote block prefix "> " from a line if present.
 */
export function extractQuote(line: string): string | null {
  const trimmed = line.trimStart();
  if (trimmed.startsWith("> ")) {
    return trimmed.slice(2);
  }
  return null;
}

/**
 * Parses all existing quote content from a notes file content string.
 * Returns a Set of trimmed quote texts (for deduplication initialization).
 */
export function parseExistingQuotes(content: string): Set<string> {
  const quotes = new Set<string>();
  const lines = content.split("\n");
  for (const line of lines) {
    const quote = extractQuote(line);
    if (quote !== null) {
      quotes.add(quote.trim());
    }
  }
  return quotes;
}
