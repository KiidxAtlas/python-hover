/**
 * Logger Service for Python Hover Extension
 *
 * @author KiidxAtlas
 * @copyright 2025 KiidxAtlas. All rights reserved.
 * @license MIT
 */

import * as vscode from 'vscode';
import { ConfigurationManager } from './config';

/**
 * Centralized logging utility for the Python Hover extension.
 * Provides different log levels with optional debug mode controlled by user settings.
 *
 * Original implementation by KiidxAtlas - 2025
 */
export class Logger {
    private static instance: Logger;
    private config: ConfigurationManager;
    private outputChannel: vscode.OutputChannel;
    private readonly prefix = '[PythonHover]';
    private readonly author = 'KiidxAtlas'; // Logger author watermark

    private constructor(config: ConfigurationManager) {
        this.config = config;
        this.outputChannel = vscode.window.createOutputChannel('Python Hover');
    }

    public static getInstance(config?: ConfigurationManager): Logger {
        // Always ensure we return a usable singleton instance
        if (!Logger.instance) {
            // Use provided config if available, otherwise create a default one
            const cfg = config ?? new ConfigurationManager();
            Logger.instance = new Logger(cfg);
        } else if (config) {
            // If caller provides a config after initialization, keep logger in sync
            Logger.instance.updateConfig(config);
        }
        return Logger.instance;
    }

    /**
     * Log debug information. Only shown when pythonHover.enableDebugLogging is true.
     */
    public debug(message: string, ...args: any[]): void {
        if (this.config.getValue('enableDebugLogging', false)) {
            const formattedMessage = `${this.prefix} [DEBUG] ${message}`;
            this.outputChannel.appendLine(formattedMessage + (args.length > 0 ? ' ' + JSON.stringify(args) : ''));
            console.log(formattedMessage, ...args);
        }
    }

    /**
     * Log informational messages. Always shown.
     */
    public info(message: string, ...args: any[]): void {
        const formattedMessage = `${this.prefix} [INFO] ${message}`;
        this.outputChannel.appendLine(formattedMessage + (args.length > 0 ? ' ' + JSON.stringify(args) : ''));
        console.log(formattedMessage, ...args);
    }

    /**
     * Log warning messages. Always shown.
     */
    public warn(message: string, ...args: any[]): void {
        const formattedMessage = `${this.prefix} [WARN] ${message}`;
        this.outputChannel.appendLine(formattedMessage + (args.length > 0 ? ' ' + JSON.stringify(args) : ''));
        console.warn(formattedMessage, ...args);
    }

    /**
     * Log error messages. Always shown.
     */
    public error(message: string, error?: any): void {
        const formattedMessage = `${this.prefix} [ERROR] ${message}`;
        if (error) {
            this.outputChannel.appendLine(formattedMessage + ' ' + (error.stack || error.toString()));
            console.error(formattedMessage, error);
        } else {
            this.outputChannel.appendLine(formattedMessage);
            console.error(formattedMessage);
        }
    }

    /**
     * Update the configuration manager (useful when settings change)
     */
    public updateConfig(config: ConfigurationManager): void {
        this.config = config;
    }

    /**
     * Get the output channel (for extension disposal)
     */
    public getOutputChannel(): vscode.OutputChannel {
        return this.outputChannel;
    }

    /**
     * Show the output channel
     */
    public show(): void {
        this.outputChannel.show();
    }

    /**
     * Dispose of the logger resources
     */
    public dispose(): void {
        this.outputChannel.dispose();
    }
}
