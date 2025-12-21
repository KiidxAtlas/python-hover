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

    get docsVersion(): string {
        return this.config.get('docsVersion', 'auto');
    }

    get maxSnippetLines(): number {
        return this.config.get('maxSnippetLines', 12);
    }

    get fontSize(): string {
        return this.config.get('fontSize', 'medium');
    }

    get showEmojis(): boolean {
        return this.config.get('showEmojis', true);
    }

    get showColors(): boolean {
        return this.config.get('showColors', true);
    }

    get showBorders(): boolean {
        return this.config.get('showBorders', true);
    }

    get inventoryCacheDays(): number {
        return this.config.get('cacheTTL.inventoryDays', 7);
    }

    get snippetCacheHours(): number {
        return this.config.get('cacheTTL.snippetHours', 48);
    }

    get enableKeywordDocs(): boolean {
        return this.config.get('enableKeywordDocs', true);
    }

    get enhancedMethodResolution(): boolean {
        return this.config.get('enhancedMethodResolution', true);
    }

    get showPracticalExamples(): boolean {
        return this.config.get('showPracticalExamples', true);
    }

    get showRelatedMethods(): boolean {
        return this.config.get('showRelatedMethods', true);
    }

    get showVersionInfo(): boolean {
        return this.config.get('showVersionInfo', true);
    }

    get enableDebugLogging(): boolean {
        return this.config.get('enableDebugLogging', false);
    }

    get requestTimeout(): number {
        return this.config.get('requestTimeout', 10000);
    }

    get openDocsInEditor(): boolean {
        return this.config.get('openDocsInEditor', false);
    }

    get telemetry(): boolean {
        return this.config.get('telemetry', false);
    }

    get debounceDelay(): number {
        return this.config.get('debounceDelay', 150);
    }

    get versionCacheTTL(): number {
        return this.config.get('versionCacheTTL', 30);
    }

    get customLibraries(): any[] {
        return this.config.get('customLibraries', []);
    }

    get autoDetectLibraries(): boolean {
        return this.config.get('experimental.autoDetectLibraries', false);
    }

    get showParameterTables(): boolean {
        return this.config.get('ui.showParameterTables', true);
    }

    get showSignatures(): boolean {
        return this.config.get('ui.showSignatures', true);
    }

    get showDeprecationWarnings(): boolean {
        return this.config.get('ui.showDeprecationWarnings', true);
    }

    get showReturnTypes(): boolean {
        return this.config.get('ui.showReturnTypes', true);
    }

    get showQuickActions(): boolean {
        return this.config.get('ui.showQuickActions', true);
    }

    get showSeeAlso(): boolean {
        return this.config.get('ui.showSeeAlso', true);
    }

    get showPerformanceHints(): boolean {
        return this.config.get('ui.showPerformanceHints', false);
    }

    get showKeyboardHints(): boolean {
        return this.config.get('ui.showKeyboardHints', true);
    }

    get maxContentLength(): number {
        return this.config.get('ui.maxContentLength', 800);
    }

    get pythonPath(): string {
        // Prefer the path configured by the Python extension, or default to 'python'
        // The Python extension updates 'python.defaultInterpreterPath' or we can rely on the environment path.
        // For a more advanced integration, we would consume the Python Extension API.
        const pythonConfig = vscode.workspace.getConfiguration('python');
        const configured = pythonConfig.get<string>('defaultInterpreterPath') || pythonConfig.get<string>('pythonPath');
        if (configured && configured.trim().length > 0) {
            return configured;
        }

        // Prefer python3 on non-Windows hosts.
        return process.platform === 'win32' ? 'python' : 'python3';
    }
}
