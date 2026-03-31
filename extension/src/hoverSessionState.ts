import * as vscode from 'vscode';
import { HoverDoc, HoverHistoryEntry } from '../../shared/types';

export class HoverSessionState {
    private static readonly MAX_COMMAND_DOCS = 500;
    private static readonly MAX_HISTORY_ENTRIES = 25;

    private lastDoc: HoverDoc | null = null;
    private commandDocCache = new Map<string, HoverDoc>();
    private hoverHistory: HoverHistoryEntry[] = [];
    private readonly sidebarDidChangeEmitter = new vscode.EventEmitter<void>();
    readonly onDidChangeSidebarState = this.sidebarDidChangeEmitter.event;

    getLastDoc(): HoverDoc | null {
        return this.lastDoc;
    }

    getDocByCommandToken(token?: string): HoverDoc | null {
        if (!token) {
            return this.lastDoc;
        }
        return this.commandDocCache.get(token) ?? this.lastDoc;
    }

    getExactDocByCommandToken(token: string): HoverDoc | null {
        return this.commandDocCache.get(token) ?? null;
    }

    getHoverHistory(): HoverHistoryEntry[] {
        return [...this.hoverHistory];
    }

    rememberCommandDoc(doc: HoverDoc, commandToken: string): HoverDoc {
        doc.metadata = {
            ...(doc.metadata ?? {}),
            commandToken,
            indexedPackage: typeof doc.metadata?.indexedPackage === 'string' ? doc.metadata.indexedPackage : doc.module?.split('.')[0],
            indexedModule: typeof doc.metadata?.indexedModule === 'string' ? doc.metadata.indexedModule : doc.module,
            indexedName: typeof doc.metadata?.indexedName === 'string' ? doc.metadata.indexedName : doc.title,
        };
        this.commandDocCache.set(commandToken, doc);
        this.evictIfNeeded(this.commandDocCache);
        this.lastDoc = doc;
        this.sidebarDidChangeEmitter.fire();
        return doc;
    }

    rememberHoverHistoryEntry(entry: HoverHistoryEntry): void {
        const normalizedTitle = entry.title.trim();
        if (!normalizedTitle) {
            return;
        }

        const normalizedEntry: HoverHistoryEntry = {
            ...entry,
            title: normalizedTitle,
        };
        const dedupeKey = `${normalizedEntry.title}|${normalizedEntry.kind ?? ''}|${normalizedEntry.module ?? ''}|${normalizedEntry.url ?? ''}`;
        this.hoverHistory = [
            normalizedEntry,
            ...this.hoverHistory.filter(existing => (
                `${existing.title}|${existing.kind ?? ''}|${existing.module ?? ''}|${existing.url ?? ''}`
            ) !== dedupeKey),
        ];
        if (this.hoverHistory.length > HoverSessionState.MAX_HISTORY_ENTRIES) {
            this.hoverHistory.length = HoverSessionState.MAX_HISTORY_ENTRIES;
        }
        this.sidebarDidChangeEmitter.fire();
    }

    fireSidebarDidChange(): void {
        this.sidebarDidChangeEmitter.fire();
    }

    dispose(): void {
        this.sidebarDidChangeEmitter.dispose();
    }

    private evictIfNeeded<K, V>(map: Map<K, V>): void {
        if (map.size <= HoverSessionState.MAX_COMMAND_DOCS) {
            return;
        }

        const excess = map.size - HoverSessionState.MAX_COMMAND_DOCS;
        for (const key of Array.from(map.keys()).slice(0, excess)) {
            map.delete(key);
        }
    }
}
