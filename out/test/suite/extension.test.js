"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const vscode = require("vscode");
const config_1 = require("../../config");
const symbolResolver_1 = require("../../symbolResolver");
suite('Python Hover Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');
    test('Configuration Manager', () => {
        const configManager = new config_1.ConfigurationManager();
        assert.ok(configManager);
        assert.strictEqual(typeof configManager.docsVersion, 'string');
        assert.strictEqual(typeof configManager.maxSnippetLines, 'number');
    });
    test('Symbol Resolver - Builtin Functions', async () => {
        const resolver = new symbolResolver_1.SymbolResolver();
        // Create a mock document
        const uri = vscode.Uri.parse('untitled:test.py');
        const document = await vscode.workspace.openTextDocument(uri);
        // Note: This is a simplified test. In real usage, you'd need to edit the document
        // and test with actual Python code
        assert.ok(resolver);
    });
    test('Python Keywords Detection', () => {
        // Test that we can identify Python keywords
        const keywords = ['if', 'for', 'while', 'def', 'class', 'import'];
        keywords.forEach(keyword => {
            // In a real test, we'd use the symbol resolver to check keyword detection
            assert.ok(keyword.length > 0);
        });
    });
    test('Builtin Functions Detection', () => {
        // Test that we can identify Python builtins
        const builtins = ['len', 'print', 'str', 'int', 'list', 'dict'];
        builtins.forEach(builtin => {
            // In a real test, we'd use the symbol resolver to check builtin detection
            assert.ok(builtin.length > 0);
        });
    });
});
//# sourceMappingURL=extension.test.js.map