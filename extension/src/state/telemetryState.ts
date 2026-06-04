import { HoverDoc } from '#shared/types'
import * as vscode from 'vscode'

type TelemetrySnapshot = {
  totalHoverEvents: number
  bySource: Record<string, number>
  topSymbols: Record<string, number>
  updatedAt: string
}

const EMPTY_SNAPSHOT: TelemetrySnapshot = {
  totalHoverEvents: 0,
  bySource: {},
  topSymbols: {},
  updatedAt: new Date(0).toISOString(),
}

export class TelemetryState {
  private static readonly STATE_KEY = 'python-hover.telemetry.v1'

  constructor(private readonly globalState: vscode.Memento) {}

  recordHover(doc: HoverDoc): void {
    const snapshot = this.getSnapshot()
    snapshot.totalHoverEvents += 1
    const source = doc.source || 'unknown'
    snapshot.bySource[source] = (snapshot.bySource[source] ?? 0) + 1

    const title = doc.title.replace(/^builtins\./, '')
    snapshot.topSymbols[title] = (snapshot.topSymbols[title] ?? 0) + 1
    snapshot.updatedAt = new Date().toISOString()

    this.trimTopSymbols(snapshot)
    void this.globalState.update(TelemetryState.STATE_KEY, snapshot)
  }

  getSnapshot(): TelemetrySnapshot {
    const value = this.globalState.get<TelemetrySnapshot>(TelemetryState.STATE_KEY)
    if (!value) {
      return { ...EMPTY_SNAPSHOT }
    }
    return {
      totalHoverEvents: value.totalHoverEvents ?? 0,
      bySource: { ...(value.bySource ?? {}) },
      topSymbols: { ...(value.topSymbols ?? {}) },
      updatedAt: value.updatedAt ?? new Date(0).toISOString(),
    }
  }

  private trimTopSymbols(snapshot: TelemetrySnapshot): void {
    const entries = Object.entries(snapshot.topSymbols).sort((a, b) => b[1] - a[1])
    const keep = entries.slice(0, 30)
    snapshot.topSymbols = Object.fromEntries(keep)
  }
}
