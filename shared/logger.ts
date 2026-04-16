/**
 * Minimal logger interface shared between docs-engine and extension.
 * Decouples docs-engine from the VS Code OutputChannel implementation.
 */
export interface ILogger {
  log(message: string, data?: unknown): void
  debug(message: string, data?: unknown): void
  error(message: string, error?: unknown): void
}

/** No-op logger used as the default when no logger has been injected. */
export const nullLogger: ILogger = {
  log: () => {},
  debug: () => {},
  error: () => {},
}
