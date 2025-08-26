"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationManager = void 0;
const vscode = require("vscode");
class ConfigurationManager {
    constructor() {
        this.config = this.loadConfig();
    }
    loadConfig() {
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
    getConfig() {
        return this.config;
    }
    refresh() {
        this.config = this.loadConfig();
    }
    get docsVersion() {
        return this.config.docsVersion;
    }
    get maxSnippetLines() {
        return this.config.maxSnippetLines;
    }
    get inventoryCacheDays() {
        return this.config.cacheTTL.inventoryDays;
    }
    get snippetCacheHours() {
        return this.config.cacheTTL.snippetHours;
    }
    get enableKeywordDocs() {
        return this.config.enableKeywordDocs;
    }
    get telemetryEnabled() {
        return this.config.telemetry;
    }
}
exports.ConfigurationManager = ConfigurationManager;
//# sourceMappingURL=config.js.map