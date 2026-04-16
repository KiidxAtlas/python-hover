import { ILogger, nullLogger } from '../../shared/logger'

let _logger: ILogger = nullLogger

/**
 * Inject a logger into the docs-engine.
 * Called once during extension activation before any resolution work begins.
 */
export function setEngineLogger(logger: ILogger): void {
  _logger = logger
}

/** Returns the active logger (nullLogger until setEngineLogger is called). */
export function getEngineLogger(): ILogger {
  return _logger
}
