export function getImportModuleAtColumn(
  line: string,
  column: number,
): string | undefined {
  const fromMatch = /^(\s*from\s+)([A-Za-z_][\w.]*)(\s+import\b)/.exec(line);
  if (fromMatch) {
    const start = fromMatch[1].length;
    if (column >= start && column <= start + fromMatch[2].length) {
      return fromMatch[2];
    }
  }

  const importMatch = /^(\s*import\s+)(.+)$/.exec(line);
  if (!importMatch) return undefined;
  const bodyStart = importMatch[1].length;
  for (const match of importMatch[2].matchAll(/(?:^|,\s*)([A-Za-z_][\w.]*)/g)) {
    const moduleName = match[1];
    const relativeStart = (match.index ?? 0) + match[0].lastIndexOf(moduleName);
    const start = bodyStart + relativeStart;
    if (column >= start && column <= start + moduleName.length) return moduleName;
  }
  return undefined;
}
