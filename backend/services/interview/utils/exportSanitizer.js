/**
 * Sanitizes values against CSV/Excel formula injection (CSV Injection / CWE-1236).
 * Spreadsheet applications (Excel, LibreOffice, Google Sheets) execute cells starting with
 * '=', '+', '-', '@', '\t', or '\r' as formulas. Prepending a single quote (') disables formula evaluation.
 *
 * @param {any} value
 * @returns {any} Sanitized value
 */
export const sanitizeFormula = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  const rawStr = String(value);
  if (rawStr.length === 0) {
    return "";
  }

  // Check if raw string begins with tab or carriage return (often used to disguise formulas)
  if (rawStr.startsWith("\t") || rawStr.startsWith("\r")) {
    return `'${rawStr}`;
  }

  const trimmed = rawStr.trim();
  if (trimmed.length === 0) {
    return "";
  }

  const formulaChars = ["=", "+", "-", "@"];
  if (formulaChars.includes(trimmed[0])) {
    return `'${trimmed}`;
  }

  return trimmed;
};

/**
 * Escapes a cell for RFC 4180 compliant CSV output.
 * If the cell contains commas, quotes, or newlines, encloses in quotes and escapes internal quotes.
 *
 * @param {any} cell
 * @returns {string} Escaped CSV cell string
 */
export const escapeCsvCell = (cell) => {
  const sanitized = sanitizeFormula(cell);
  const str = String(sanitized ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r") || str.includes("\t")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Converts a 2D array of rows into a UTF-8 CSV string with BOM.
 *
 * @param {Array<Array<any>>} rows
 * @returns {string} UTF-8 CSV with BOM
 */
export const generateCsvString = (rows) => {
  const BOM = "\uFEFF";
  const csvBody = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
  return BOM + csvBody;
};
