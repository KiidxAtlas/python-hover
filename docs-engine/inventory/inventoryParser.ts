import * as zlib from 'zlib';
import { Logger } from '../../extension/src/logger';
import { HoverDoc, ResolutionSource } from '../../shared/types';

interface InventoryItem {
    name: string;
    domain: string;
    role: string;
    priority: string;
    uri: string;
    dispname: string;
}

export class InventoryParser {
    parse(buffer: Buffer, baseUrl: string): Map<string, HoverDoc> {
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
                if (!line.trim()) continue;

                // Format: name domain:role priority uri dispname
                // Example: pandas.DataFrame py:class 1 api/pandas.DataFrame.html -
                // Example with spaces: import path std:term -1 glossary.html#term-import-path -

                const parts = line.split(/\s+/);
                if (parts.length < 4) continue;

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
                const priority = parts[domainIndex + 1];
                let uri = parts[domainIndex + 2];
                const dispname = parts.slice(domainIndex + 3).join(' ');

                if (name === 'import') {
                    Logger.log(`[InventoryParser] Found 'import': ${line}`);
                    Logger.log(`[InventoryParser] Parsed URI: ${uri}`);
                }

                // Handle relative URIs
                if (uri.endsWith('$')) {
                    uri = uri.slice(0, -1) + name;
                }

                const fullUrl = baseUrl.endsWith('/') ? baseUrl + uri : baseUrl + '/' + uri;

                // Store in map
                // Key: fully qualified name (e.g. pandas.DataFrame)
                inventory.set(name, {
                    title: name,
                    content: `Documentation from Sphinx Inventory (${domainRole})`,
                    url: fullUrl,
                    source: ResolutionSource.Sphinx,
                    confidence: 1.0
                });
            }

        } catch (e) {
            Logger.error('Failed to decompress objects.inv:', e);
        }

        return inventory;
    }
}
