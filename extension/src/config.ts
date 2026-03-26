import * as vscode from 'vscode';

export class Config {
    private get config() {
        return vscode.workspace.getConfiguration('python-hover');
    }

    get isEnabled(): boolean {
        return this.config.get('enable', true);
    }

    get onlineDiscovery(): boolean {
        return this.config.get('onlineDiscovery', true);
    }

    get buildFullCorpus(): boolean {
        return this.config.get('buildFullCorpus', false);
    }

    get docsVersion(): string {
        return this.config.get('docsVersion', 'auto');
    }

    get maxSnippetLines(): number {
        return this.config.get('maxSnippetLines', 12);
    }

    get inventoryCacheDays(): number {
        return this.config.get('cacheTTL.inventoryDays', 7);
    }

    get snippetCacheHours(): number {
        return this.config.get('cacheTTL.snippetHours', 48);
    }

    get showPracticalExamples(): boolean {
        return this.config.get('showPracticalExamples', true);
    }

    get requestTimeout(): number {
        const raw = this.config.get('requestTimeout', 10000);
        return Math.min(Math.max(raw, 1000), 60000);
    }

    /** Where to open official docs links: 'integrated' (side panel), 'external' (system browser) */
    get docsBrowser(): 'integrated' | 'external' {
        return this.config.get('docsBrowser', 'integrated');
    }

    /** Where to open DevDocs links: 'integrated' (side panel), 'external' (system browser) */
    get devdocsBrowser(): 'integrated' | 'external' {
        return this.config.get('devdocsBrowser', 'external');
    }

    get customLibraries(): Array<{ name: string; baseUrl: string }> {
        const raw = this.config.get<any[]>('customLibraries', []);
        return raw.filter(entry => {
            if (!entry || typeof entry.name !== 'string' || typeof entry.baseUrl !== 'string') return false;
            if (!entry.name.trim() || !entry.baseUrl.trim()) return false;
            try { new URL(entry.baseUrl); return true; } catch { return false; }
        });
    }

    get showSignatures(): boolean {
        return this.config.get('ui.showSignatures', true);
    }

    get showReturnTypes(): boolean {
        return this.config.get('ui.showReturnTypes', true);
    }

    get showDebugPinButton(): boolean {
        return this.config.get('ui.showDebugPinButton', false);
    }

    get maxContentLength(): number {
        return this.config.get('ui.maxContentLength', 800);
    }

    get pythonPath(): string {
        const pythonConfig = vscode.workspace.getConfiguration('python');
        const configured = pythonConfig.get<string>('defaultInterpreterPath') || pythonConfig.get<string>('pythonPath');
        if (configured && configured.trim().length > 0) {
            return configured;
        }
        return process.platform === 'win32' ? 'python' : 'python3';
    }
}
