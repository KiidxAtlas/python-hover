export interface ILogger {
  log(message: string, data?: unknown): void
  debug(message: string, data?: unknown): void
  error(message: string, error?: unknown): void
}

export const nullLogger: ILogger = {
  log() {
    /* no-op */
  },
  debug() {
    /* no-op */
  },
  error() {
    /* no-op */
  },
}