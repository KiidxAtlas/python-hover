import { HoverDoc, SavedDocEntry } from '../../shared/types';

export const MAX_SAVED_DOCS = 24;

export function getSavedDocModuleTarget(doc: HoverDoc): string | undefined {
    if (doc.kind === 'module') {
        const title = normalizeSavedDocTitle(doc.title);
        return title && title !== 'builtins' ? title : doc.module;
    }

    return doc.module;
}

export function getSavedDocEntryId(entry: Pick<SavedDocEntry, 'title' | 'kind' | 'module' | 'url' | 'sourceUrl'>): string {
    return [
        normalizeSavedDocTitle(entry.title).toLowerCase(),
        entry.kind?.trim().toLowerCase() ?? '',
        entry.module?.trim().toLowerCase() ?? '',
        entry.url?.trim() ?? '',
        entry.sourceUrl?.trim() ?? '',
    ].join('|');
}

export function normalizeSavedDocTitle(title: string): string {
    return title.trim().replace(/^builtins\./, '');
}

export function normalizeSavedDocEntry(entry: Partial<SavedDocEntry> | undefined): SavedDocEntry | undefined {
    if (!entry) {
        return undefined;
    }

    const title = normalizeSavedDocTitle(entry.title ?? '');
    if (!title) {
        return undefined;
    }

    const kind = entry.kind?.trim() || undefined;
    const moduleName = entry.module?.trim() || undefined;
    const packageName = entry.package?.trim() || moduleName?.split('.')[0] || undefined;
    const url = entry.url?.trim() || undefined;
    const sourceUrl = entry.sourceUrl?.trim() || undefined;
    const summary = entry.summary?.replace(/\s+/g, ' ').trim() || undefined;
    const commandToken = entry.commandToken?.trim() || undefined;

    if (!url && !sourceUrl && !moduleName && !commandToken) {
        return undefined;
    }

    return {
        id: getSavedDocEntryId({
            title,
            kind,
            module: moduleName,
            url,
            sourceUrl,
        }),
        title,
        kind,
        module: moduleName,
        package: packageName,
        url,
        sourceUrl,
        summary: summary ? summary.slice(0, 220) : undefined,
        commandToken,
    };
}

export function buildSavedDocEntry(doc: HoverDoc): SavedDocEntry | undefined {
    const moduleName = getSavedDocModuleTarget(doc);
    const packageName = typeof doc.metadata?.indexedPackage === 'string'
        ? doc.metadata.indexedPackage
        : moduleName?.split('.')[0];
    const sourceUrl = doc.sourceUrl || (typeof doc.links?.source === 'string' ? doc.links.source : undefined);
    const summary = doc.summary?.trim()
        || doc.structuredContent?.summary?.trim()
        || undefined;
    const commandToken = typeof doc.metadata?.commandToken === 'string'
        ? doc.metadata.commandToken
        : undefined;

    return normalizeSavedDocEntry({
        title: doc.title,
        kind: doc.kind,
        module: moduleName,
        package: packageName,
        url: doc.url,
        sourceUrl,
        summary,
        commandToken,
    });
}
