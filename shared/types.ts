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
    Local = 'Local'
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
    sourceUrl?: string;
    links?: Record<string, string>;
    badges?: Badge[];
    source: ResolutionSource;
    confidence: number; // 0.0 to 1.0
    metadata?: Record<string, any>;
    content?: string; // Legacy support
    overloads?: string[];
    protocolHints?: string[];
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

export interface SymbolInfo {
    name: string;
    module: string;
    docstring?: string;
    signature?: string;
    path?: string;
    isStdlib?: boolean;
    qualname?: string;
    kind?: string;
    overloads?: string[];
    protocolHints?: string[];
}
