/**
 * Interactive Code Runner
 * Executes Python code examples in the terminal
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

export class CodeRunner {
    private outputChannel: vscode.OutputChannel;
    private terminal: vscode.Terminal | undefined;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Python Hover Examples');
    }

    /**
     * Run Python code and display output
     */
    async runCode(code: string, useTerminal: boolean = false): Promise<void> {
        this.outputChannel.show(true);
        this.outputChannel.appendLine('─'.repeat(60));
        this.outputChannel.appendLine('🐍 Running Python Example...');
        this.outputChannel.appendLine('─'.repeat(60));
        this.outputChannel.appendLine(code);
        this.outputChannel.appendLine('─'.repeat(60));

        if (useTerminal) {
            await this.runInTerminal(code);
        } else {
            await this.runInOutputChannel(code);
        }
    }

    /**
     * Run code in integrated terminal
     */
    private async runInTerminal(code: string): Promise<void> {
        // Create or reuse terminal
        if (!this.terminal || this.terminal.exitStatus !== undefined) {
            this.terminal = vscode.window.createTerminal({
                name: 'Python Hover',
                hideFromUser: false
            });
        }

        this.terminal.show();

        // Clean the code (remove comments about expected output)
        const cleanCode = this.cleanCode(code);

        // For multi-line code, create a temp file
        if (cleanCode.includes('\n')) {
            const tempFile = await this.createTempFile(cleanCode);
            this.terminal.sendText(`python "${tempFile}"`);
        } else {
            // Single line can use -c
            const escapedCode = cleanCode.replace(/"/g, '\\"');
            this.terminal.sendText(`python -c "${escapedCode}"`);
        }
    }

    /**
     * Run code and capture output in output channel
     */
    private async runInOutputChannel(code: string): Promise<void> {
        const cleanCode = this.cleanCode(code);
        const tempFile = await this.createTempFile(cleanCode);

        try {
            // Get Python path
            const pythonPath = await this.getPythonPath();

            // Execute Python
            const { exec } = require('child_process');
            const util = require('util');
            const execPromise = util.promisify(exec);

            const { stdout, stderr } = await execPromise(`"${pythonPath}" "${tempFile}"`, {
                timeout: 10000 // 10 second timeout
            });

            if (stdout) {
                this.outputChannel.appendLine('📤 Output:');
                this.outputChannel.appendLine(stdout);
            }

            if (stderr) {
                this.outputChannel.appendLine('⚠️  Warnings/Errors:');
                this.outputChannel.appendLine(stderr);
            }

            this.outputChannel.appendLine('✅ Execution completed');
        } catch (error: any) {
            this.outputChannel.appendLine('❌ Error executing code:');
            this.outputChannel.appendLine(error.message);

            if (error.stdout) {
                this.outputChannel.appendLine('\n📤 Partial Output:');
                this.outputChannel.appendLine(error.stdout);
            }

            if (error.stderr) {
                this.outputChannel.appendLine('\n⚠️  Error Details:');
                this.outputChannel.appendLine(error.stderr);
            }
        } finally {
            // Clean up temp file
            try {
                fs.unlinkSync(tempFile);
            } catch (e) {
                // Ignore cleanup errors
            }
        }

        this.outputChannel.appendLine('─'.repeat(60));
    }

    /**
     * Create temporary Python file
     */
    private async createTempFile(code: string): Promise<string> {
        const tempDir = os.tmpdir();
        const timestamp = Date.now();
        const tempFile = path.join(tempDir, `python_hover_${timestamp}.py`);

        fs.writeFileSync(tempFile, code, 'utf-8');

        return tempFile;
    }

    /**
     * Clean code by removing comment lines with expected output
     */
    private cleanCode(code: string): string {
        const lines = code.split('\n');
        const cleanedLines: string[] = [];

        for (const line of lines) {
            // Skip lines that are just comments showing expected output
            const trimmed = line.trim();
            if (trimmed.startsWith('#') && (
                trimmed.includes('Output:') ||
                trimmed.includes('>>>') ||
                trimmed.includes('Returns:') ||
                /^#\s*[[\d]/.test(trimmed) || // # [1, 2, 3]
                /^#\s*['"]/.test(trimmed)     // # 'result'
            )) {
                continue;
            }
            cleanedLines.push(line);
        }

        return cleanedLines.join('\n').trim();
    }

    /**
     * Get Python interpreter path
     */
    private async getPythonPath(): Promise<string> {
        // Try to get from Python extension
        try {
            const pythonExtension = vscode.extensions.getExtension('ms-python.python');
            if (pythonExtension) {
                if (!pythonExtension.isActive) {
                    await pythonExtension.activate();
                }

                const pythonPath = pythonExtension.exports?.settings?.getExecutionDetails?.()?.execCommand;
                if (pythonPath && Array.isArray(pythonPath) && pythonPath.length > 0) {
                    return pythonPath[0];
                }
            }
        } catch (e) {
            console.error('[PythonHover] Error getting Python path from extension:', e);
        }

        // Fallback to 'python' or 'python3'
        return process.platform === 'win32' ? 'python' : 'python3';
    }

    /**
     * Insert code at cursor position
     */
    async insertCode(code: string): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }

        const cleanCode = this.cleanCode(code);
        const position = editor.selection.active;

        await editor.edit(editBuilder => {
            editBuilder.insert(position, cleanCode);
        });

        vscode.window.showInformationMessage('✅ Code inserted');
    }

    /**
     * Copy code to clipboard
     */
    async copyCode(code: string): Promise<void> {
        const cleanCode = this.cleanCode(code);
        await vscode.env.clipboard.writeText(cleanCode);
        vscode.window.showInformationMessage('✅ Code copied to clipboard');
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.outputChannel.dispose();
        if (this.terminal) {
            this.terminal.dispose();
        }
    }
}
