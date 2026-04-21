/** Minimal RFC-style CSV parser (handles quotes and newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;

  const pushCell = () => {
    row.push(cur);
    cur = "";
  };

  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ",") {
      pushCell();
      continue;
    }
    if (c === "\r") continue;
    if (c === "\n") {
      pushCell();
      pushRow();
      continue;
    }
    cur += c;
  }

  pushCell();
  if (row.some((cell) => cell.length > 0)) {
    pushRow();
  }

  return rows;
}
