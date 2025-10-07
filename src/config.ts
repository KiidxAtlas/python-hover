import * as vscode from 'vscode';

export interface PythonHoverConfig {
    docsVersion: string;
    maxSnippetLines: number;
    cacheTTL: {
        inventoryDays: number;
        snippetHours: number;
    };
    enableKeywordDocs: boolean;
    telemetry: boolean;
}

export class ConfigurationManager {
    private config: PythonHoverConfig;

    constructor() {
        this.config = this.loadConfig();
    }

    private loadConfig(): PythonHoverConfig {
        const vscodeConfig = vscode.workspace.getConfiguration('pythonHover');

        return {
            docsVersion: vscodeConfig.get('docsVersion', 'auto'),
            maxSnippetLines: vscodeConfig.get('maxSnippetLines', 20),
            cacheTTL: {
                inventoryDays: vscodeConfig.get('cacheTTL.inventoryDays', 7),
                snippetHours: vscodeConfig.get('cacheTTL.snippetHours', 48)
            },
            enableKeywordDocs: vscodeConfig.get('enableKeywordDocs', true),
            telemetry: vscodeConfig.get('telemetry', false)
        };
    }

    public getConfig(): PythonHoverConfig {
        return this.config;
    }

    public refresh(): void {
        this.config = this.loadConfig();
    }

    public get docsVersion(): string {
        return this.config.docsVersion;
    }

    public get maxSnippetLines(): number {
        return this.config.maxSnippetLines;
    }

    public get inventoryCacheDays(): number {
        return this.config.cacheTTL.inventoryDays;
    }

    public get snippetCacheHours(): number {
        return this.config.cacheTTL.snippetHours;
    }

    public get enableKeywordDocs(): boolean {
        return this.config.enableKeywordDocs;
    }

    public get telemetryEnabled(): boolean {
        return this.config.telemetry;
    }

    /**
     * Get a configuration value by key with optional default
     */
    public getValue<T>(key: string, defaultValue: T): T {
        const vscodeConfig = vscode.workspace.getConfiguration('pythonHover');
        return vscodeConfig.get(key, defaultValue);
    }
}
