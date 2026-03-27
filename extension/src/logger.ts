import * as vscode from 'vscode';

export class Logger {
    private static _outputChannel: vscode.OutputChannel;
    private static _debugEnabled = false;

    public static initialize(name: string) {
        this._outputChannel = vscode.window.createOutputChannel(name);
    }

    public static setDebugEnabled(enabled: boolean) {
        this._debugEnabled = enabled;
    }

    public static log(message: string, data?: any) {
        if (!this._outputChannel) {
            return;
        }
        const timestamp = new Date().toLocaleTimeString();
        let logMessage = `[${timestamp}] ${message}`;

        if (data) {
            if (typeof data === 'object') {
                logMessage += `\n${JSON.stringify(data, null, 2)}`;
            } else {
                logMessage += ` ${data}`;
            }
        }

        this._outputChannel.appendLine(logMessage);
    }

    public static debug(message: string, data?: any) {
        if (!this._debugEnabled) {
            return;
        }
        this.log(`[debug] ${message}`, data);
    }

    public static error(message: string, error?: any) {
        if (!this._outputChannel) {
            return;
        }
        const timestamp = new Date().toLocaleTimeString();
        let logMessage = `[${timestamp}] [ERROR] ${message}`;

        if (error) {
            if (error instanceof Error) {
                logMessage += `\n${error.stack || error.message}`;
            } else if (typeof error === 'object') {
                logMessage += `\n${JSON.stringify(error, null, 2)}`;
            } else {
                logMessage += ` ${error}`;
            }
        }

        this._outputChannel.appendLine(logMessage);
        this._outputChannel.show(true); // Bring to front on error
    }

    public static show() {
        this._outputChannel?.show();
    }

    public static dispose() {
        this._outputChannel?.dispose();
    }
}
