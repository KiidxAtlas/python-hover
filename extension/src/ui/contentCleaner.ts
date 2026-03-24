/**
 * Shared content cleaning utilities used by both HoverRenderer (markdown hover)
 * and HoverPanel (HTML pin panel) to ensure consistent content processing.
 *
 * These are pure data-cleaning functions — they strip pydoc dumps, RST artifacts,
 * and Annotated[] wrappers.  They do NOT add format-specific enhancements
 * (codicons for markdown, HTML tags for the panel) — those belong in each renderer.
 */

/**
 * Strip Annotated[Type, Doc('...')] wrappers, keeping only the base type.
 * Handles nested brackets and multi-line Doc() strings.
 */
export function stripAnnotatedWrappers(sig: string): string {
    let result = sig;
    let changed = true;
    let iterations = 0;
    while (changed && iterations < 20) {
        changed = false;
        iterations++;
        const idx = result.indexOf('Annotated[');
        if (idx === -1) break;

        const start = idx + 'Annotated['.length;
        let depth = 1;
        let firstComma = -1;
        let end = -1;
        for (let i = start; i < result.length; i++) {
            const ch = result[i];
            if (ch === '[' || ch === '(') depth++;
            else if (ch === ']' || ch === ')') {
                depth--;
                if (depth === 0) { end = i; break; }
            } else if (ch === ',' && depth === 1 && firstComma === -1) {
                firstComma = i;
            }
            if (ch === '\'' || ch === '"') {
                const quote = ch;
                i++;
                while (i < result.length && result[i] !== quote) {
                    if (result[i] === '\\') i++;
                    i++;
                }
            }
        }

        if (end > start && firstComma > start) {
            const baseType = result.substring(start, firstComma).trim();
            result = result.substring(0, idx) + baseType + result.substring(end + 1);
            changed = true;
        }
    }
    return result;
}

/**
 * Strip raw pydoc class/object dumps that slip through when `pydoc.help()`
 * or `inspect.getdoc()` returns the class-level docstring for constants.
 */
export function cleanPydocDump(text: string): string {
    text = text.replace(/^Help on \w+ object:\s*/i, '');

    if (/^class\s+\w+.*\|/s.test(text) || /\|\s+Methods defined here:/s.test(text)) {
        const match = text.match(/^class\s+\w+[^|]*\|\s*(.+?)(?:\s*\||$)/s);
        if (match?.[1]) {
            const firstLine = match[1].trim().replace(/\|/g, '').trim();
            if (firstLine && !firstLine.startsWith('Methods defined')) {
                return firstLine;
            }
        }
        return '';
    }

    if (text.includes(' |  ') && text.split(' |  ').length > 3) {
        const lines = text.split(/\s*\|\s*/).filter(l => l.trim());
        if (lines.length > 0) {
            return lines[0].trim();
        }
    }

    return text;
}

/**
 * Clean RST (reStructuredText) directive artifacts from scraped Sphinx content.
 */
export function cleanRstArtifacts(text: string): string {
    text = text.replace(/\.\. note::\s*/gi, 'Note: ');
    text = text.replace(/\.\. warning::\s*/gi, 'Warning: ');
    text = text.replace(/\.\. caution::\s*/gi, 'Caution: ');
    text = text.replace(/\.\. important::\s*/gi, 'Important: ');
    text = text.replace(/\.\. tip::\s*/gi, 'Tip: ');
    text = text.replace(/\.\. deprecated::\s*(\S+)/gi, 'Deprecated since $1: ');
    text = text.replace(/\.\. versionadded::\s*(\S+)/gi, 'New in $1: ');
    text = text.replace(/\.\. versionchanged::\s*(\S+)/gi, 'Changed in $1: ');
    text = text.replace(/^[ \t]*\.\.\s+[\w-]+::.*$/gm, '');
    text = text.replace(/:(?:func|class|meth|mod|attr|exc|data|const|type|obj):`([^`]+)`/g, '`$1`');
    text = text.replace(/\|([^|\n]+)\|_?/g, '$1');
    text = text.replace(/__[ \t]*$/gm, '');
    text = text.replace(/\n{3,}/g, '\n\n');
    return text.trim();
}

/**
 * Strip Annotated[] wrappers, Doc() remnants, and raw signature artifacts
 * from content/summary text.
 */
export function cleanContentAnnotations(text: string): string {
    text = stripAnnotatedWrappers(text);
    text = text.replace(/Doc\(['"][\s\S]*?['"]\)/g, '');
    text = text.replace(/<\w[\w.]*\s+object\s+at\s+0x[0-9a-f]+>/gi, '');
    text = text.replace(/^\s*\*,?\s*$/gm, '');
    text = text.replace(/\\n/g, '\n');
    text = text.replace(/,\s*,/g, ',');
    text = text.replace(/\(\s*,/g, '(');
    text = text.replace(/,\s*\)/g, ')');
    text = text.replace(/\s{2,}/g, ' ');
    text = text.replace(/\n{3,}/g, '\n\n');
    return text.trim();
}

/**
 * Clean a signature string for display.
 */
export function cleanSignature(sig: string): string {
    sig = stripAnnotatedWrappers(sig);
    sig = sig.replace(/<\w[\w.]*\s+object\s+at\s+0x[0-9a-f]+>/gi, '...');
    sig = sig.replace(/<_py_warnings\.deprecated\s+object\s+at\s+0x[0-9a-f]+>/gi, '');
    sig = sig.replace(/,\s*,/g, ',');
    sig = sig.replace(/\(\s*,/g, '(');
    sig = sig.replace(/,\s*\)/g, ')');
    sig = sig.replace(/\s{2,}/g, ' ');
    return sig.trim();
}

/**
 * Run the full content cleaning pipeline (pydoc dump → RST → annotations).
 * Returns cleaned content ready for format-specific rendering.
 */
export function cleanContent(text: string): string {
    if (!text) return '';
    text = cleanPydocDump(text);
    text = cleanRstArtifacts(text);
    text = cleanContentAnnotations(text);
    return text;
}
