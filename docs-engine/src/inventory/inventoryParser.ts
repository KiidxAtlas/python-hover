import * as zlib from 'zlib';
import { Logger } from '../../../extension/src/logger';
import { HoverDoc, ResolutionSource } from '../../../shared/types';

const PYTHON_SYMBOL_NAME_RE = /^[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*$/;
const INCLUDED_PYTHON_ROLES = new Set([
    'module',
    'function',
    'class',
    'exception',
    'method',
    'staticmethod',
    'classmethod',
    'attribute',
    'property',
    'data',
    'obj',
]);

export class InventoryParser {
    parse(buffer: Buffer, baseUrl: string, docsProvider: 'mkdocs' | 'sphinx' = 'sphinx'): Map<string, HoverDoc> {
        const inventory = new Map<string, HoverDoc>();

        // 1. Split header and compressed body
        // The header ends with a line saying "The remainder of this file is compressed using zlib."
        const headerEndMarker = 'The remainder of this file is compressed using zlib.\n';
        const headerEndIndex = buffer.indexOf(headerEndMarker);

        if (headerEndIndex === -1) {
            Logger.log('Invalid objects.inv format: Header marker not found');
            return inventory;
        }

        const startOfCompressed = headerEndIndex + headerEndMarker.length;
        const compressedData = buffer.slice(startOfCompressed);

        try {
            // 2. Decompress
            const decompressed = zlib.inflateSync(compressedData);
            const content = decompressed.toString('utf-8');

            // 3. Parse lines
            const lines = content.split('\n');
            for (const line of lines) {
                if (!line.trim()) {continue;}

                // Format: name domain:role priority uri dispname
                // Example: pandas.DataFrame py:class 1 api/pandas.DataFrame.html -
                // Example with spaces: import path std:term -1 glossary.html#term-import-path -

                const parts = line.split(/\s+/);
                if (parts.length < 4) {continue;}

                // Find the domain:role column (heuristic: contains ':' and followed by a number)
                let domainIndex = -1;
                for (let i = 0; i < parts.length - 2; i++) {
                    if (parts[i].includes(':') && !isNaN(parseInt(parts[i + 1]))) {
                        domainIndex = i;
                        break;
                    }
                }

                if (domainIndex === -1) {
                    // Fallback to standard format (name is first part)
                    domainIndex = 1;
                }

                const name = parts.slice(0, domainIndex).join(' ');
                const domainRole = parts[domainIndex];
                let uri = parts[domainIndex + 2];

                if (!this.shouldIncludeEntry(name, domainRole)) {
                    continue;
                }

                // Handle relative URIs
                if (uri.endsWith('$')) {
                    uri = uri.slice(0, -1) + name;
                }

                const fullUrl = baseUrl.endsWith('/') ? baseUrl + uri : baseUrl + '/' + uri;
                const kind = this.mapRoleToKind(domainRole);

                // Store in map
                // Key: fully qualified name (e.g. pandas.DataFrame)
                inventory.set(name, {
                    title: name,
                    url: fullUrl,
                    kind,
                    source: ResolutionSource.Corpus,
                    confidence: 1.0,
                    metadata: {
                        docsProvider,
                    },
                });
            }

        } catch (e) {
            Logger.error('Failed to decompress objects.inv:', e);
        }

        return inventory;
    }

    private shouldIncludeEntry(name: string, domainRole: string): boolean {
        const [domain = '', role = ''] = domainRole.toLowerCase().split(':', 2);
        if (domain !== 'py') {
            return false;
        }

        if (!INCLUDED_PYTHON_ROLES.has(role)) {
            return false;
        }

        return PYTHON_SYMBOL_NAME_RE.test(name.trim());
    }

    private mapRoleToKind(domainRole: string): string | undefined {
        const role = domainRole.split(':').pop()?.toLowerCase();
        switch (role) {
            case 'method':
            case 'staticmethod':
            case 'classmethod':
                return 'method';
            case 'function':
                return 'function';
            case 'class':
            case 'exception':
                return 'class';
            case 'module':
                return 'module';
            case 'attribute':
            case 'property':
            case 'data':
            case 'obj':
                return 'attribute';
            default:
                return undefined;
        }
    }
}
