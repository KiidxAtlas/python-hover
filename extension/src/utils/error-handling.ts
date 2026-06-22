/**
 * Shared error handling utilities for the python-hover extension.
 *
 * Provides consistent user-facing notifications, standardized message formatting,
 * and error boundary helpers to replace silent failures throughout the codebase.
 */

import * as vscode from "vscode";

// ─────────────────────────────────────────────────────────────────────────────
// USER NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Severity levels for user-facing error notifications. */
export enum NotificationSeverity {
  /** User action required — always show a notification. */
  Error = "error",
  /** Something unexpected happened, but the extension can recover. */
  Warning = "warning",
  /** Informational — shown only when debug mode is enabled. */
  Info = "info",
}

/**
 * Show a user-facing error notification with a consistent format.
 * Uses VS Code's native notification API so the message appears in the
 * same location as other extension warnings/errors.
 */
export function showErrorNotification(
  title: string,
  options?: {
    /** Additional context to log (shown in output channel). */
    logData?: unknown;
    /** Whether to also reveal the error in the output panel. */
    revealInOutput?: boolean;
    /** Custom action buttons to show alongside "OK". */
    actions?: Array<{ label: string; callback: () => Promise<void> }>;
  },
): void {
  const actions = options?.actions ?? [];

  // Always log to output channel for debugging.
  if (options?.logData !== undefined) {
    Logger.log(`[ERROR] ${title}`, options.logData);
  } else {
    Logger.log(`[ERROR] ${title}`);
  }

  // Build notification with optional actions.
  const actionLabels = actions.map((a) => a.label);

  vscode.window.showErrorMessage(title, ...actionLabels).then((selected) => {
    if (!selected) return;
    const action = actions.find((a) => a.label === selected);
    if (action) {
      void action.callback();
    }
  });

  // Optionally reveal in output panel.
  if (options?.revealInOutput) {
    revealErrorInOutput(title);
  }
}

/**
 * Show a user-facing warning notification.
 * Warnings are less intrusive than errors — they use showInformationMessage.
 */
export function showWarningNotification(
  title: string,
  options?: {
    logData?: unknown;
    actions?: Array<{ label: string; callback: () => Promise<void> }>;
  },
): void {
  if (options?.logData !== undefined) {
    Logger.log(`[WARN] ${title}`, options.logData);
  } else {
    Logger.log(`[WARN] ${title}`);
  }

  const actions = options?.actions ?? [];
  const actionLabels = actions.map((a) => a.label);

  vscode.window
    .showInformationMessage(title, ...actionLabels)
    .then((selected) => {
      if (!selected) return;
      const action = actions.find((a) => a.label === selected);
      if (action) {
        void action.callback();
      }
    });
}

/**
 * Show an informational message (non-blocking).
 */
export function showInfoMessage(
  title: string,
  options?: {
    logData?: unknown;
    actions?: Array<{ label: string; callback: () => Promise<void> }>;
  },
): void {
  if (options?.logData !== undefined) {
    Logger.log(title, options.logData);
  } else {
    Logger.log(title);
  }

  const actions = options?.actions ?? [];
  const actionLabels = actions.map((a) => a.label);

  vscode.window
    .showInformationMessage(title, ...actionLabels)
    .then((selected) => {
      if (!selected) return;
      const action = actions.find((a) => a.label === selected);
      if (action) {
        void action.callback();
      }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR BOUNDARIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wrap an async function in a try-catch that logs errors and optionally
 * shows a user notification. Returns null on failure instead of throwing.
 *
 * Usage:
 *   const result = await safeAsync(
 *     async () => expensiveOperation(),
 *     "Failed to fetch documentation",
 *     { notifyUser: true }
 *   );
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  errorMessage: string,
  options?: {
    notifyUser?: boolean;
    logData?: unknown;
    /** Custom error formatter (overrides errorMessage). */
    formatError?: (error: unknown) => string;
  },
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    const formattedError = options?.formatError
      ? options.formatError(error)
      : formatErrorValue(error);

    if (options?.notifyUser) {
      showErrorNotification(`${errorMessage}. ${formattedError}`, {
        logData: options?.logData,
      });
    } else {
      Logger.log(`[ERROR] ${errorMessage}`, options?.logData);
    }

    return null;
  }
}

/**
 * Synchronous version of safeAsync for sync operations.
 */
export function safeSync<T>(
  fn: () => T,
  errorMessage: string,
  options?: {
    notifyUser?: boolean;
    logData?: unknown;
    formatError?: (error: unknown) => string;
  },
): T | null {
  try {
    return fn();
  } catch (error) {
    const formattedError = options?.formatError
      ? options.formatError(error)
      : formatErrorValue(error);

    if (options?.notifyUser) {
      showErrorNotification(`${errorMessage}. ${formattedError}`, {
        logData: options?.logData,
      });
    } else {
      Logger.log(`[ERROR] ${errorMessage}`, options?.logData);
    }

    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOADING STATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Represents an in-flight async operation that can be tracked for loading states.
 */
export interface LoadingHandle {
  /** Whether the operation is currently in progress. */
  readonly isActive: boolean;
  /** Cancel or complete the loading state. */
  complete: () => void;
}

/**
 * Create a simple loading state manager for tracking async operations.
 */
export class LoadingManager {
  private activeLoads = new Map<string, boolean>();

  /** Start a loading state with the given ID. */
  start(id: string): LoadingHandle {
    const self = this;
    return {
      get isActive() {
        return self.activeLoads.get(id) ?? false;
      },
      complete: () => {
        self.activeLoads.delete(id);
      },
    };
  }

  /** Check if any loading operation is active. */
  hasActiveLoads(): boolean {
    return this.activeLoads.size > 0;
  }

  /** Check if a specific loading operation is active. */
  isActive(id: string): boolean {
    return this.activeLoads.get(id) ?? false;
  }

  /** Clear all loading states. */
  clear(): void {
    this.activeLoads.clear();
  }

  /** Get IDs of all active loading operations. */
  getActiveIds(): string[] {
    return Array.from(this.activeLoads.keys());
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STANDARDIZED MESSAGE FORMATTING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a standardized error message for user display.
 * Ensures consistent messaging across all commands and panels.
 */
export function formatStandardErrorMessage(
  category: string,
  symbolName?: string,
  additionalContext?: string,
): string {
  const parts: string[] = [];

  switch (category) {
    case "resolution-failed":
      parts.push(
        `Could not resolve documentation for "${symbolName ?? "unknown symbol"}".`,
      );
      break;
    case "network-error":
      parts.push(
        `Network request failed while fetching documentation for "${symbolName ?? "unknown symbol"}".`,
      );
      break;
    case "cache-error":
      parts.push(
        `Cache operation failed for "${symbolName ?? "unknown symbol"}".`,
      );
      break;
    case "lsp-error":
      parts.push(
        `Language server did not return information for "${symbolName ?? "unknown symbol"}".`,
      );
      break;
    case "python-helper-error":
      parts.push(
        `Python helper encountered an error processing "${symbolName ?? "unknown symbol"}".`,
      );
      break;
    default:
      parts.push(`An error occurred for "${symbolName ?? "unknown symbol"}".`);
  }

  if (additionalContext) {
    parts.push(additionalContext);
  }

  return parts.join(" ");
}

/**
 * Format a standardized warning message for user display.
 */
export function formatStandardWarningMessage(
  category: string,
  symbolName?: string,
): string {
  switch (category) {
    case "fallback-used":
      return `Showing fallback documentation for "${symbolName ?? "unknown symbol"}" — full docs may not be available.`;
    case "stale-cache":
      return `Using cached documentation for "${symbolName ?? "unknown symbol"}" — it may be outdated.`;
    case "partial-result":
      return `Partial documentation available for "${symbolName ?? "unknown symbol"}" — some details are not yet cached.`;
    default:
      return `Limited documentation available for "${symbolName ?? "unknown symbol"}".`;
  }
}

/**
 * Format a standardized info message for user display.
 */
export function formatStandardInfoMessage(
  action: string,
  symbolName?: string,
): string {
  return `${action} ${symbolName ?? "symbol"} successfully.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Format an error value into a human-readable string. */
function formatErrorValue(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null) {
    return JSON.stringify(error);
  }
  return String(error);
}

/** Reveal an error in the output panel for debugging. */
function revealErrorInOutput(title: string): void {
  const channel = Logger.getOutputChannel();
  if (channel) {
    channel.appendLine(`\n--- Error Notification ---`);
    channel.appendLine(title);
    channel.show();
  }
}

import { Logger } from "#src/logger";
