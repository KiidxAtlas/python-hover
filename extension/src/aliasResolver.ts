
export class AliasResolver {
    resolve(documentText: string, symbol: string): string {
        const aliases = this.parseAliases(documentText);

        // Try to match the longest prefix of the symbol with an alias
        const parts = symbol.split('.');
        for (let i = parts.length; i > 0; i--) {
            const prefix = parts.slice(0, i).join('.');
            if (aliases.has(prefix)) {
                const resolvedPrefix = aliases.get(prefix)!;
                const suffix = parts.slice(i).join('.');
                return suffix ? `${resolvedPrefix}.${suffix}` : resolvedPrefix;
            }
        }

        return symbol;
    }

    private parseAliases(text: string): Map<string, string> {
        const aliases = new Map<string, string>();

        // Normalize multi-line imports by joining lines ending with backslash
        // and handling parenthesized imports: from X import (A, B, C)
        let normalizedText = text.replace(/\\\n\s*/g, ' ');

        // Handle parenthesized imports by removing newlines inside parentheses
        normalizedText = normalizedText.replace(/\(\s*([^)]+)\s*\)/g, (match, content) => {
            return '(' + content.replace(/\n\s*/g, ' ').replace(/\s+/g, ' ') + ')';
        });

        const lines = normalizedText.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('import') && !trimmed.startsWith('from')) {
                continue;
            }

            // 1. import X as Y
            const importAsMatch = /^import\s+([\w.]+)\s+as\s+([\w.]+)/.exec(trimmed);
            if (importAsMatch) {
                aliases.set(importAsMatch[2], importAsMatch[1]);
                continue;
            }

            // 2. from X import Y as Z (single import)
            const fromImportAsMatch = /^from\s+([\w.]+)\s+import\s+([\w.]+)\s+as\s+([\w.]+)$/.exec(trimmed);
            if (fromImportAsMatch) {
                aliases.set(fromImportAsMatch[3], `${fromImportAsMatch[1]}.${fromImportAsMatch[2]}`);
                continue;
            }

            // 3. from X import Y, Z or from X import (Y, Z)
            // This handles multiple imports: from X import A, B, C
            // And parenthesized: from X import (A, B, C)
            if (trimmed.startsWith('from')) {
                const fromMatch = /^from\s+([\w.]+)\s+import\s+\(?(.+?)\)?$/.exec(trimmed);
                if (fromMatch) {
                    const module = fromMatch[1];
                    // Remove trailing parenthesis if present and split by comma
                    const importList = fromMatch[2].replace(/\)$/, '');
                    const imports = importList.split(',');
                    for (const imp of imports) {
                        const cleanImp = imp.trim();
                        if (!cleanImp) continue;

                        // Handle "A as B" inside the list
                        const asMatch = /^([\w.]+)\s+as\s+([\w.]+)$/.exec(cleanImp);
                        if (asMatch) {
                            aliases.set(asMatch[2], `${module}.${asMatch[1]}`);
                        } else {
                            // Simple "A"
                            // Only add if it's a valid identifier
                            if (/^[\w.]+$/.test(cleanImp)) {
                                aliases.set(cleanImp, `${module}.${cleanImp}`);
                            }
                        }
                    }
                }
            }
        }

        return aliases;
    }
}
