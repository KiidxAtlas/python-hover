
export class AliasResolver {
    resolve(documentText: string, symbol: string): string {
        const { importAliases, variableAliases } = this.parseAliases(documentText);

        const parts = symbol.split('.');
        const root = parts[0];

        if (variableAliases.has(root)) {
            const resolvedRoot = variableAliases.get(root)!;
            const resolvedFromVariable = parts.length > 1
                ? `${resolvedRoot}.${parts.slice(1).join('.')}`
                : resolvedRoot;
            return this.resolveAliasPath(importAliases, resolvedFromVariable);
        }

        return this.resolveWithAliases(importAliases, symbol);
    }

    private parseAliases(text: string): { importAliases: Map<string, string>; variableAliases: Map<string, string> } {
        const importAliases = new Map<string, string>();
        const variableAliases = new Map<string, string>();

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
                importAliases.set(importAsMatch[2], importAsMatch[1]);
                continue;
            }

            // 2. from X import Y as Z (single import)
            const fromImportAsMatch = /^from\s+([\w.]+)\s+import\s+([\w.]+)\s+as\s+([\w.]+)$/.exec(trimmed);
            if (fromImportAsMatch) {
                importAliases.set(fromImportAsMatch[3], `${fromImportAsMatch[1]}.${fromImportAsMatch[2]}`);
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
                            importAliases.set(asMatch[2], `${module}.${asMatch[1]}`);
                        } else {
                            // Simple "A"
                            // Only add if it's a valid identifier
                            if (/^[\w.]+$/.test(cleanImp)) {
                                importAliases.set(cleanImp, `${module}.${cleanImp}`);
                            }
                        }
                    }
                }
            }
        }

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('import') || trimmed.startsWith('from')) {
                continue;
            }

            const assignmentMatch = /^([A-Za-z_][\w]*)\s*=\s*([A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)+)\s*\(/.exec(trimmed);
            if (!assignmentMatch) {
                continue;
            }

            const variableName = assignmentMatch[1];
            const constructorPath = this.resolveAliasPath(importAliases, assignmentMatch[2]);
            variableAliases.set(variableName, constructorPath);
        }

        return { importAliases, variableAliases };
    }

    private resolveAliasPath(aliases: Map<string, string>, symbol: string): string {
        let resolved = symbol;

        for (let depth = 0; depth < 4; depth++) {
            const next = this.resolveWithAliases(aliases, resolved);
            if (next === resolved) {
                return resolved;
            }
            resolved = next;
        }

        return resolved;
    }

    private resolveWithAliases(aliases: Map<string, string>, symbol: string): string {
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
}
