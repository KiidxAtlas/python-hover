import * as vscode from "vscode";

/** Format an error value into a human-readable string. */
function formatErrorValue(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message;
  }
  if (typeof error === "object" && error !== null) {
    return JSON.stringify(error, null, 2);
  }
  return String(error);
}

/** Format data for log output, handling objects and primitives. */
function formatLogData(data?: unknown): string {
  if (!data) {
    return "";
  }
  if (typeof data === "object") {
    return `\n${JSON.stringify(data, null, 2)}`;
  }
  return ` ${data}`;
}

export class Logger {
  private static _outputChannel: vscode.OutputChannel | undefined;
  private static _debugEnabled = false;
  private static _revealOnError = false;

  public static initialize(name: string) {
    this._outputChannel = vscode.window.createOutputChannel(name);
  }

  public static setDebugEnabled(enabled: boolean) {
    this._debugEnabled = enabled;
  }

  public static setRevealOnError(enabled: boolean) {
    this._revealOnError = enabled;
  }

  public static log(message: string, data?: unknown) {
    const channel = this._outputChannel;
    if (!channel) {
      return;
    }
    const timestamp = new Date().toLocaleTimeString();
    channel.appendLine(`[${timestamp}] ${message}${formatLogData(data)}`);
  }

  public static debug(message: string, data?: unknown) {
    if (!this._debugEnabled) {
      return;
    }
    this.log(`[debug] ${message}`, data);
  }

  public static debugDuration(
    message: string,
    startedAt: number,
    data?: unknown,
    minDurationMs = 0,
  ) {
    if (!this._debugEnabled) {
      return;
    }

    const durationMs = Date.now() - startedAt;
    if (durationMs < minDurationMs) {
      return;
    }

    const payload =
      data && typeof data === "object"
        ? { ...(data as Record<string, unknown>), durationMs }
        : data !== undefined
          ? { detail: data, durationMs }
          : { durationMs };
    this.log(`[debug] ${message}`, payload);
  }

  /** Log a warning-level message (non-critical, user-visible issues). */
  public static warn(message: string, data?: unknown) {
    const channel = this._outputChannel;
    if (!channel) {
      return;
    }
    const timestamp = new Date().toLocaleTimeString();
    channel.appendLine(
      `[${timestamp}] [WARN] ${message}${formatLogData(data)}`,
    );
  }

  public static error(message: string, error?: unknown) {
    const channel = this._outputChannel;
    if (!channel) {
      return;
    }
    const timestamp = new Date().toLocaleTimeString();
    let logMessage = `[${timestamp}] [ERROR] ${message}`;

    if (error) {
      logMessage += `\n${formatErrorValue(error)}`;
    }

    channel.appendLine(logMessage);
    if (this._revealOnError) {
      channel.show(true);
    }
  }

  public static show() {
    this._outputChannel?.show();
  }

  /** Expose the output channel for error-handling utilities. */
  public static getOutputChannel() {
    return this._outputChannel;
  }

  public static dispose() {
    this._outputChannel?.dispose();
  }
}
