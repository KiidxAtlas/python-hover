export interface DocKey {
    package: string;
    version?: string;
    module: string;
    name: string;
    qualname: string;
    isStdlib?: boolean;
}

export enum ResolutionSource {
    LSP = 'LSP',
    Runtime = 'Runtime',
    Sphinx = 'Sphinx',
    RTD = 'RTD',
    DevDocs = 'DevDocs',
    PyPI = 'PyPI',
    GitHub = 'GitHub',
    Fallback = 'Fallback',
    Static = 'Static',
    Corpus = 'Corpus',
    Local = 'Local'
}

export interface IndexedSymbolSummary {
    name: string;
    url: string;
    kind: string;
    package: string;
    title?: string;
    module?: string;
    signature?: string;
    summary?: string;
    sourceUrl?: string;
}

export interface IndexedSymbolPreview {
    name: string;
    title?: string;
    kind?: string;
    module?: string;
    summary?: string;
    signature?: string;
    url?: string;
    sourceUrl?: string;
    source?: ResolutionSource;
    installedVersion?: string;
}

export interface HoverDoc {
    title: string;
    kind?: string;
    signature?: string;
    summary?: string;
    parameters?: ParameterInfo[];
    returns?: ReturnInfo;
    raises?: ExceptionInfo[];
    notes?: string[];
    examples?: string[];
    url?: string;
    devdocsUrl?: string;
    sourceUrl?: string;
    links?: Record<string, string>;
    badges?: Badge[];
    source: ResolutionSource;
    confidence: number; // 0.0 to 1.0
    metadata?: Record<string, any>;
    content?: string; // Legacy support
    structuredContent?: StructuredHoverContent;
    overloads?: string[];
    protocolHints?: string[];
    seeAlso?: string[];        // Links scraped from Sphinx "See also" sections
    module?: string;           // Top-level package/module (e.g. "typing", "pandas")
    moduleExports?: string[];     // Key exported names shown in module overview hover
    exportCount?: number;         // Total indexed symbol count for this module
    installedVersion?: string;    // Installed package version (from importlib.metadata)
    latestVersion?: string;         // Latest version published on PyPI
    license?: string;               // Package license (e.g. "MIT", "Apache-2.0")
    requiresPython?: string;        // Minimum Python version (e.g. ">=3.9")
}

export interface StructuredHoverSection {
    kind: 'paragraph' | 'code' | 'note' | 'list';
    role?: 'summary' | 'description' | 'example' | 'note';
    title?: string;
    content: string;
    language?: string;
    items?: string[];
}

export interface StructuredHoverContent {
    signature?: string;
    summary?: string;
    description?: string;
    examples?: string[];
    notes?: string[];
    sections: StructuredHoverSection[];
}

export interface ParameterInfo {
    name: string;
    type?: string;
    default?: string;
    description?: string;
    isRequired?: boolean;
}

export interface ReturnInfo {
    type?: string;
    description?: string;
}

export interface ExceptionInfo {
    type: string;
    description?: string;
}

export interface Badge {
    label: string;
    color?: string;
    tooltip?: string;
}

export interface Candidate {
    key: DocKey;
    score: number;
}

/**
 * Raw symbol data as returned by the Language Server Protocol (Pylance etc.)
 * and post-processed by NameRefinement. This is the working object that flows
 * through the hover pipeline before being merged with runtime/doc data.
 */
export interface LspSymbol {
    name: string;
    kind?: string;
    module?: string;
    path?: string;
    targetUri?: string;
    signature?: string;
    docstring?: string;
    overloads?: string[];
    protocolHints?: string[];
    isStdlib?: boolean;
}

export interface SymbolInfo {
    name: string;
    module?: string;
    docstring?: string;
    signature?: string;
    path?: string;
    isStdlib?: boolean;
    qualname?: string;
    kind?: string;
    overloads?: string[];
    protocolHints?: string[];
}
