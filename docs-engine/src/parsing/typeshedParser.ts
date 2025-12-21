import * as fs from 'fs';
import * as readline from 'readline';

export interface TypeshedInfo {
    signature?: string;
    docstring?: string;
    overloads?: string[];
    protocolHints?: string[];
}

const PROTOCOL_HINTS: Record<string, string> = {
    'Sized': 'requires `__len__`',
    'Iterable': 'requires `__iter__`',
    'Iterator': 'requires `__next__` and `__iter__`',
    'Sequence': 'requires `__getitem__` and `__len__`',
    'Mapping': 'requires `__getitem__`, `__iter__`, and `__len__`',
    'Hashable': 'requires `__hash__`',
    'Container': 'requires `__contains__`',
    'Reversible': 'requires `__reversed__`',
    'SupportsAbs': 'requires `__abs__`',
    'SupportsInt': 'requires `__int__`',
    'SupportsFloat': 'requires `__float__`',
    'SupportsComplex': 'requires `__complex__`',
    'SupportsBytes': 'requires `__bytes__`',
    'SupportsIndex': 'requires `__index__`',
    'SupportsRound': 'requires `__round__`',
};

export class TypeshedParser {

    static async parse(filePath: string, symbol: string): Promise<TypeshedInfo | null> {
        if (!fs.existsSync(filePath)) {
            return null;
        }

        const fileStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        const parts = symbol.split('.');
        // Handle cases like "builtins.len" -> targetName="len", targetClass=null
        // Handle cases like "builtins.object.__str__" -> targetName="__str__", targetClass="object"

        let targetName = parts[parts.length - 1];
        let targetClass: string | null = null;

        if (parts.length > 1) {
            const potentialClass = parts[parts.length - 2];
            // Heuristic: Classes usually start with Uppercase, or it's a known built-in type like 'list', 'str', 'object'
            // But 'builtins' is a module.
            // If the second to last part is a module (lowercase), then it's a global function.
            // If it's a class (Uppercase or known type), it's a method.

            // Better heuristic: Check if the part before name is likely a class.
            // In typeshed, builtins are often just "len", "list", etc.
            // If we get "builtins.len", parts=["builtins", "len"]. "builtins" is module.
            // If we get "builtins.str.upper", parts=["builtins", "str", "upper"]. "str" is class.

            // We can't know for sure without semantic info, but we can guess.
            // If the user hovered "len", LSP says "builtins.len".
            // If the user hovered "my_list.append", LSP says "builtins.list.append".

            if (/^[A-Z]/.test(potentialClass) || ['str', 'int', 'float', 'list', 'dict', 'set', 'tuple', 'object', 'type'].includes(potentialClass)) {
                targetClass = potentialClass;
            }
        }

        const classStack: { name: string, indent: number }[] = [];
        let isCollecting = false;
        let collectionIndent = -1;
        let foundLines: string[] = [];
        let overloads: string[] = [];

        const defRegex = new RegExp(`^(?:async\\s+)?def\\s+${targetName}\\s*\\(`);

        for await (const line of rl) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('@')) continue;

            const indent = line.search(/\S/);


            // Manage Class Stack
            // Pop classes that have ended (current indent <= class indent)
            // Note: We must be careful with empty lines or comments (handled above)
            while (classStack.length > 0 && indent <= classStack[classStack.length - 1].indent) {
                classStack.pop();
            }

            if (trimmed.startsWith('class ')) {
                const match = trimmed.match(/^class\s+([a-zA-Z0-9_]+)/);
                if (match) {
                    classStack.push({ name: match[1], indent });
                }
            } else if (trimmed.startsWith('def ') && indent === 0) {
                // Reset class stack if we see a top-level function
                // This handles cases where indentation might be ambiguous or we missed a class exit
                // But be careful: methods inside class have indent > 0
                // If indent is 0, we are definitely at top level.
                while (classStack.length > 0) {
                    classStack.pop();
                }
            }

            const currentClass = classStack.length > 0 ? classStack[classStack.length - 1].name : null;

            // Check for match
            let isMatch = false;
            if (targetClass) {
                // Looking for method
                if (currentClass === targetClass && defRegex.test(trimmed)) {
                    isMatch = true;
                }
            } else {
                // Looking for global function
                // Must NOT be inside a class
                if (currentClass === null && defRegex.test(trimmed)) {
                    isMatch = true;
                }
            }

            if (isMatch) {
                isCollecting = true;
                collectionIndent = indent;
                foundLines = [trimmed];

                // If it's a single-line definition, we capture it immediately
                if (trimmed.endsWith(':') || trimmed.endsWith('...')) {
                    isCollecting = false;
                    overloads.push(foundLines.join('\n'));
                }
                continue;
            }

            if (isCollecting) {
                // Continue collecting until indent drops or we see the end of signature
                // In .pyi, signatures end with `...` or pass or empty body.
                // Usually: `def foo(...) -> int: ...` (one line)
                // Or:
                // def foo(
                //    x: int
                // ) -> int: ...

                // If we encounter a line with SAME indent as start, it's likely the next definition (unless it's `) -> ...:` on new line?)
                // Actually, if it's a new definition, it will start with `def` or `class` or `@`.
                // If it starts with `def`, we stop collecting previous.

                if (indent <= collectionIndent && (trimmed.startsWith('def ') || trimmed.startsWith('class ') || trimmed.startsWith('@'))) {
                    isCollecting = false;
                    overloads.push(foundLines.join('\n'));
                    // Don't skip this line, it might be the next match!
                    // But we can't re-process easily in this loop structure without goto or complex logic.
                    // However, if it matches `def targetName`, the NEXT iteration won't see it because we consumed it.
                    // We should re-evaluate this line?
                    // Or just push the overload and let the loop continue?
                    // If this line IS a match, we need to trigger match logic.

                    // Quick fix: Check if this line matches our target again.
                    if (targetClass) {
                        if (currentClass === targetClass && defRegex.test(trimmed)) {
                            isCollecting = true;
                            collectionIndent = indent;
                            foundLines = [trimmed];
                            continue;
                        }
                    } else {
                        if (currentClass === null && defRegex.test(trimmed)) {
                            isCollecting = true;
                            collectionIndent = indent;
                            foundLines = [trimmed];
                            continue;
                        }
                    }
                } else {
                    // It's part of the signature (or body `...`)
                    // If it's just `...`, we can skip it or include it.
                    if (trimmed !== '...') {
                        foundLines.push(trimmed);
                    }

                    // Check if signature ended
                    if (trimmed.endsWith(':') || trimmed.endsWith('...')) {
                        isCollecting = false;
                        overloads.push(foundLines.join('\n'));
                    }
                }
            }
        }

        if (overloads.length === 0) return null;

        // Clean up signatures
        // Remove `...` at the end if present
        // Remove `self` from methods? Maybe keep it for clarity.
        const cleanOverloads = overloads.map(sig => {
            return sig.replace(/:\s*\.\.\.$/, '').replace(/:$/, '');
        });

        const signature = cleanOverloads.join('\n');
        const protocolHints: string[] = [];

        // Scan for protocol hints
        for (const [protocol, hint] of Object.entries(PROTOCOL_HINTS)) {
            // Simple regex check for Protocol name in signature
            // Ensure it's a whole word match to avoid partial matches
            const regex = new RegExp(`\\b${protocol}\\b`);
            if (regex.test(signature)) {
                protocolHints.push(`**${protocol}** → ${hint}`);
            }
        }

        return {
            signature: signature,
            overloads: cleanOverloads,
            protocolHints: protocolHints.length > 0 ? protocolHints : undefined
        };
    }
}
