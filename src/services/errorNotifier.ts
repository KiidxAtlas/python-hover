import * as vscode from 'vscode';
import { Logger } from './logger';

/**
 * Centralized error notification service
 * Provides consistent error/warning/info messages to users
 * with optional action buttons and rate limiting
 */
export class ErrorNotifier {
    private static logger = Logger.getInstance();
    private static readonly MESSAGE_PREFIX = 'Python Hover';
    
    // Rate limiting to prevent notification spam
    private static lastNotificationTime = new Map<string, number>();
    private static readonly MIN_NOTIFICATION_INTERVAL = 5000; // 5 seconds

    /**
     * Show an error message with optional action buttons
     * @param message The error message to display
     * @param actions Optional action button labels
     * @returns The selected action label, or undefined if dismissed
     */
    public static async showError(
        message: string,
        ...actions: string[]
    ): Promise<string | undefined> {
        const fullMessage = this.formatMessage(message);
        this.logger.error(message);

        if (this.shouldThrottle(fullMessage)) {
            this.logger.debug(`Throttling error notification: ${message}`);
            return undefined;
        }

        this.recordNotification(fullMessage);
        return await vscode.window.showErrorMessage(fullMessage, ...actions);
    }

    /**
     * Show a warning message with optional action buttons
     * @param message The warning message to display
     * @param actions Optional action button labels
     * @returns The selected action label, or undefined if dismissed
     */
    public static async showWarning(
        message: string,
        ...actions: string[]
    ): Promise<string | undefined> {
        const fullMessage = this.formatMessage(message);
        this.logger.warn(message);

        if (this.shouldThrottle(fullMessage)) {
            this.logger.debug(`Throttling warning notification: ${message}`);
            return undefined;
        }

        this.recordNotification(fullMessage);
        return await vscode.window.showWarningMessage(fullMessage, ...actions);
    }

    /**
     * Show an information message with optional action buttons
     * @param message The information message to display
     * @param actions Optional action button labels
     * @returns The selected action label, or undefined if dismissed
     */
    public static async showInfo(
        message: string,
        ...actions: string[]
    ): Promise<string | undefined> {
        const fullMessage = this.formatMessage(message);
        this.logger.info(message);
        return await vscode.window.showInformationMessage(fullMessage, ...actions);
    }

    /**
     * Show error with "Open Settings" action
     * Commonly used for configuration errors
     */
    public static async showErrorWithSettings(
        message: string,
        settingKey?: string
    ): Promise<void> {
        const action = await this.showError(message, 'Open Settings');
        
        if (action === 'Open Settings') {
            const settingToOpen = settingKey || 'pythonHover';
            vscode.commands.executeCommand('workbench.action.openSettings', settingToOpen);
        }
    }

    /**
     * Show warning with "Retry" and "Open Settings" actions
     * Commonly used for recoverable errors
     */
    public static async showWarningWithRetry(
        message: string,
        onRetry?: () => void,
        settingKey?: string
    ): Promise<void> {
        const action = await this.showWarning(message, 'Retry', 'Open Settings');
        
        if (action === 'Retry' && onRetry) {
            onRetry();
        } else if (action === 'Open Settings') {
            const settingToOpen = settingKey || 'pythonHover';
            vscode.commands.executeCommand('workbench.action.openSettings', settingToOpen);
        }
    }

    /**
     * Show error for network/connectivity issues
     */
    public static async showNetworkError(
        operation: string,
        error?: Error
    ): Promise<void> {
        const message = `Failed to ${operation}. Please check your internet connection.`;
        
        if (error) {
            this.logger.error(`Network error during ${operation}`, error);
        }
        
        await this.showError(message);
    }

    /**
     * Show error for invalid configuration
     */
    public static async showConfigError(
        configName: string,
        reason: string,
        settingKey?: string
    ): Promise<void> {
        const message = `Invalid ${configName} configuration: ${reason}`;
        await this.showErrorWithSettings(message, settingKey);
    }

    /**
     * Format message with consistent prefix
     */
    private static formatMessage(message: string): string {
        // Don't add prefix if it already has one
        if (message.startsWith(this.MESSAGE_PREFIX)) {
            return message;
        }
        return `${this.MESSAGE_PREFIX}: ${message}`;
    }

    /**
     * Check if notification should be throttled to prevent spam
     */
    private static shouldThrottle(message: string): boolean {
        const lastTime = this.lastNotificationTime.get(message);
        if (!lastTime) {
            return false;
        }

        const timeSinceLastNotification = Date.now() - lastTime;
        return timeSinceLastNotification < this.MIN_NOTIFICATION_INTERVAL;
    }

    /**
     * Record notification time for rate limiting
     */
    private static recordNotification(message: string): void {
        this.lastNotificationTime.set(message, Date.now());
    }

    /**
     * Clear rate limiting history (useful for testing)
     */
    public static clearThrottleHistory(): void {
        this.lastNotificationTime.clear();
    }

    /**
     * Configure minimum notification interval (useful for testing)
     */
    public static setMinNotificationInterval(_intervalMs: number): void {
        // This would be used for testing, but we keep it simple for now
        // Could be expanded to make the interval configurable
    }
}
