/**
 * The RULES tab.
 *
 * Free text, not a table — so it is read row by row rather than through the
 * header-mapped table helper, and the first row is kept because it is rules
 * text, not a header. Cells within a row are joined so a rule split across two
 * columns still reads as one line.
 */

import { parseCsv } from "./csv";
import { isErrorCell } from "./numbers";
import { tidy } from "./text";

export function parseRules(text: string): string[] {
  const lines: string[] = [];

  for (const row of parseCsv(text)) {
    const line = row
      .map((cell) => tidy(cell))
      .filter((cell) => cell !== "" && !isErrorCell(cell))
      .join(" ");

    if (line !== "") lines.push(line);
  }

  return lines;
}
