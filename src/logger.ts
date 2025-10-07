import { ConfigurationManager } from './config';

/**
 * Centralized logging utility for the Python Hover extension.
 * Provides different log levels with optional debug mode controlled by user settings.
 */
export class Logger {
    private static instance: Logger;
    private config: ConfigurationManager;
    private readonly prefix = '[PythonHover]';

    private constructor(config: ConfigurationManager) {
        this.config = config;
    }

    public static getInstance(config?: ConfigurationManager): Logger {
        if (!Logger.instance && config) {
            Logger.instance = new Logger(config);
        }
        return Logger.instance;
    }

    /**
     * Log debug information. Only shown when pythonHover.enableDebugLogging is true.
     */
    public debug(message: string, ...args: any[]): void {
        if (this.config.getValue('enableDebugLogging', false)) {
            console.log(`${this.prefix} ${message}`, ...args);
        }
    }

    /**
     * Log informational messages. Always shown.
     */
    public info(message: string, ...args: any[]): void {
        console.log(`${this.prefix} ${message}`, ...args);
    }

    /**
     * Log warning messages. Always shown.
     */
    public warn(message: string, ...args: any[]): void {
        console.warn(`${this.prefix} ${message}`, ...args);
    }

    /**
     * Log error messages. Always shown.
     */
    public error(message: string, error?: any): void {
        if (error) {
            console.error(`${this.prefix} ${message}`, error);
        } else {
            console.error(`${this.prefix} ${message}`);
        }
    }

    /**
     * Update the configuration manager (useful when settings change)
     */
    public updateConfig(config: ConfigurationManager): void {
        this.config = config;
    }
}
