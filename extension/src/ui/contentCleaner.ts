/**
 * Shared content cleaning utilities used by both HoverRenderer (markdown hover)
 * and HoverPanel (HTML pin panel) to ensure consistent content processing.
 *
 * These are pure data-cleaning functions — they strip pydoc dumps, RST artifacts,
 * and Annotated[] wrappers.  They do NOT add format-specific enhancements
 * (codicons for markdown, HTML tags for the panel) — those belong in each renderer.
 */

const DOCSITE_METADATA_BLOCK_PATTERNS = [
    /^Date:\s+.+\bVersion:\s+/i,
    /^Download documentation:\s+/i,
    /^Previous versions?:\s+/i,
];

const LEGAL_BOILERPLATE_PATTERNS = [
    /^Copyright\b/im,
    /\bAll rights reserved\b/i,
    /\bRedistribution and use in source and binary forms\b/i,
    /\bPermission is hereby granted, free of charge\b/i,
    /\bTHIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS? AND CONTRIBUTORS\b/i,
    /\bWITHOUT WARRANTIES OR CONDITIONS OF ANY KIND\b/i,
    /\bApache License\b/i,
    /\bTERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION\b/i,
    /\bPython Software Foundation License Version\b/i,
    /\bThe above copyright notice\b/i,
    /\bNeither the name of\b/i,
    /\bcontributors may be used to endorse or promote products derived from this software\b/i,
];

const LEGAL_BLOCK_OPENING_PATTERNS = [
    /^Copyright\b/i,
    /^All rights reserved\.?$/i,
    /^Redistribution and use in source and binary forms\b/i,
    /^Permission is hereby granted, free of charge\b/i,
    /^THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS? AND CONTRIBUTORS\b/i,
    /^Apache License\b/i,
    /^TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION\b/i,
    /^Python Software Foundation License Version\b/i,
    /^The above copyright notice\b/i,
    /^Neither the name of\b/i,
];

/**
 * Strip Annotated[Type, Doc('...')] wrappers, keeping only the base type.
 * Handles nested brackets and multi-line Doc() strings.
 */
function stripAnnotatedWrappers(sig: string): string {
    let result = sig;
    let changed = true;
    let iterations = 0;
    while (changed && iterations < 20) {
        changed = false;
        iterations++;
        const idx = result.indexOf('Annotated[');
        if (idx === -1) {break;}

        const start = idx + 'Annotated['.length;
        let depth = 1;
        let firstComma = -1;
        let end = -1;
        for (let i = start; i < result.length; i++) {
            const ch = result[i];
            if (ch === '[' || ch === '(') {depth++;}
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
                    if (result[i] === '\\') {i++;}
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
    text = normalizeSphinxSignatureArtifacts(text);
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
    // Final sanitization: strip any tags that may have been reconstructed after earlier replacements
    text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<[^>]+>/gi, '');
    return text.trim();
}

export function stripDocumentationBoilerplate(text: string): string {
    if (!text.trim()) {
        return '';
    }

    const blocks = text
        .split(/\n{2,}/)
        .map(block => block.trim())
        .filter(Boolean);
    const kept: string[] = [];

    for (const block of blocks) {
        if (isDocumentationChromeBlock(block)) {
            continue;
        }

        if (isLegalBoilerplateBlock(block)) {
            if (kept.length > 0) {
                break;
            }
            continue;
        }

        kept.push(block);
    }

    return kept.join('\n\n').trim();
}

/**
 * Clean a signature string for display.
 */
export function cleanSignature(sig: string): string {
    sig = stripAnnotatedWrappers(sig);
    sig = sig.replace(/\s*\[\[source\]\]\([^\s)]+\)/gi, '');
    sig = sig.replace(/<\w[\w.]*\s+object\s+at\s+0x[0-9a-f]+>/gi, '...');
    sig = sig.replace(/<_py_warnings\.deprecated\s+object\s+at\s+0x[0-9a-f]+>/gi, '');
    sig = normalizeSphinxSignatureArtifacts(sig);
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
    if (!text) {return '';}
    text = cleanPydocDump(text);
    text = cleanRstArtifacts(text);
    text = stripDocumentationBoilerplate(text);
    text = cleanContentAnnotations(text);
    return text;
}

function isDocumentationChromeBlock(block: string): boolean {
    return DOCSITE_METADATA_BLOCK_PATTERNS.some(pattern => pattern.test(block));
}

function normalizeSphinxSignatureArtifacts(text: string): string {
    return text.replace(
        /\*{1,3}(async def|class|def)\s+\*+([A-Za-z_][A-Za-z0-9_.]*)\s*(\([^)]*\))\s*\*{0,3}/g,
        (_match, keyword, name, params) => `${keyword} ${name}${normalizeSphinxSignatureParams(params)}`,
    );
}

function normalizeSphinxSignatureParams(params: string): string {
    return params
        .replace(/\*([^*,()]+)\*/g, '$1')
        .replace(/\*{2,}/g, '*');
}

function isLegalBoilerplateBlock(block: string): boolean {
    const normalized = block.replace(/\s+/g, ' ').trim();
    if (!normalized) {
        return false;
    }

    if (LEGAL_BLOCK_OPENING_PATTERNS.some(pattern => pattern.test(normalized))) {
        return true;
    }

    let signalCount = 0;
    for (const pattern of LEGAL_BOILERPLATE_PATTERNS) {
        if (pattern.test(normalized)) {
            signalCount++;
        }
    }

    if (signalCount >= 2) {
        return true;
    }

    return normalized.length > 180 && signalCount >= 1;
}
