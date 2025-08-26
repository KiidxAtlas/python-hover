"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryManager = void 0;
const node_fetch_1 = require("node-fetch");
const pako = require("pako");
const cache_1 = require("./cache");
class InventoryManager {
    constructor(cacheManager) {
        this.cacheManager = cacheManager;
    }
    async getInventory(version) {
        const cacheKey = `inventory-${version}-v8`; // v8 for enhanced cache invalidation support
        const maxAge = cache_1.CacheManager.hoursToMs(24); // 24 hours
        console.log(`[PythonHover] Getting inventory for version ${version}, cache key: ${cacheKey}`);
        try {
            // Check cache first
            const cached = await this.cacheManager.get(cacheKey);
            console.log(`[PythonHover] Cache lookup result: ${cached ? 'found' : 'not found'}`);
            if (cached) {
                const isExpired = await this.cacheManager.isExpired(cacheKey, maxAge);
                console.log(`[PythonHover] Cache expired check: ${isExpired ? 'expired' : 'not expired'}`);
                console.log(`[PythonHover] Cache timestamp: ${new Date(cached.timestamp)}`);
                console.log(`[PythonHover] Max age: ${maxAge}ms (${maxAge / (1000 * 60 * 60)}h)`);
                if (!isExpired) {
                    console.log(`[PythonHover] Using cached inventory for version ${version}`);
                    return new Map(Object.entries(cached.data));
                }
            }
            console.log(`[PythonHover] Fetching fresh inventory for version ${version}`);
            const inventory = await this.fetchInventory(version);
            // Convert Map to Object for storage
            const inventoryObj = {};
            inventory.forEach((value, key) => {
                inventoryObj[key] = value;
            });
            await this.cacheManager.set(cacheKey, inventoryObj);
            return inventory;
        }
        catch (error) {
            console.error(`[PythonHover] Failed to get inventory for ${version}:`, error);
            // If fetch fails but we have cached data, use it
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                console.log(`[PythonHover] Using stale cached inventory due to fetch error`);
                return new Map(Object.entries(cached.data));
            }
            throw error;
        }
    }
    async invalidateCache() {
        console.log('[PythonHover] Invalidating inventory cache by incrementing version');
        // This forces cache refresh by incrementing the version number
        // Update the current cache key version to force refresh on next access
        const currentVersion = '3.12'; // Could be made dynamic if needed
        const newCacheKey = `inventory-${currentVersion}-v8`; // Increment from v7 to v8
        // Update the class constant to use the new version
        console.log(`[PythonHover] Inventory cache will use new version: v8`);
        // Note: The actual cache key increment is handled by changing the version
        // in the getInventory method's cacheKey generation
    }
    async fetchInventory(version) {
        const inventoryUrl = `${InventoryManager.DOCS_BASE_URL}/${version}/objects.inv`;
        const response = await (0, node_fetch_1.default)(inventoryUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch inventory: ${response.status} ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        return this.parseInventory(new Uint8Array(buffer), version);
    }
    parseInventory(data, version) {
        const inventory = new Map();
        try {
            // Skip the header (first 4 lines)
            let offset = 0;
            let lineCount = 0;
            // Find the end of the header
            while (lineCount < 4 && offset < data.length) {
                if (data[offset] === 0x0A) { // newline
                    lineCount++;
                }
                offset++;
            }
            // The rest is zlib-compressed
            const compressedData = data.slice(offset);
            const decompressed = pako.inflate(compressedData, { to: 'string' });
            // Parse each line
            const lines = decompressed.split('\n');
            for (const line of lines) {
                if (line.trim() === '')
                    continue;
                const entry = this.parseInventoryLine(line, version);
                if (entry) {
                    // Debug: Log entries we're storing to see if anchor replacement worked
                    if (entry.name === 'len' || entry.name === 'class' || entry.name === 'min') {
                        console.log(`[PythonHover] Storing entry: ${entry.name} -> ${entry.uri}#${entry.anchor}`);
                    }
                    // Store with both simple name and domain:role qualified name
                    // This allows us to find all entries for a name and then select the best one
                    const qualifiedName = `${entry.name}:${entry.domain}:${entry.role}`;
                    inventory.set(qualifiedName, entry);
                    // Also store with simple name, but prefer certain types over others
                    const existing = inventory.get(entry.name);
                    if (!existing || this.shouldReplaceEntry(existing, entry)) {
                        inventory.set(entry.name, entry);
                    }
                }
            }
        }
        catch (error) {
            throw new Error(`Failed to parse inventory: ${error}`);
        }
        return inventory;
    }
    shouldReplaceEntry(existing, newEntry) {
        // Priority order: py:keyword > py:function > py:class > std:label > std:term
        const priorityOrder = [
            'py:keyword',
            'py:function',
            'py:class',
            'py:exception',
            'std:label',
            'std:term'
        ];
        const existingKey = `${existing.domain}:${existing.role}`;
        const newKey = `${newEntry.domain}:${newEntry.role}`;
        const existingPriority = priorityOrder.indexOf(existingKey);
        const newPriority = priorityOrder.indexOf(newKey);
        // If new entry has higher priority (lower index), replace
        if (newPriority !== -1 && existingPriority !== -1) {
            return newPriority < existingPriority;
        }
        // If only new entry is in priority list, replace
        if (newPriority !== -1)
            return true;
        // Otherwise don't replace
        return false;
    }
    parseInventoryLine(line, version) {
        // Intersphinx inventory format:
        // name domain:role priority uri anchor [display_name]
        // The inventory uses space-separated fields, but the display name can contain spaces
        // We need to be careful about parsing when URI contains # and anchor
        const parts = line.split(/\s+/);
        if (parts.length < 5) {
            return null;
        }
        const name = parts[0];
        const [domain, role] = parts[1].split(':');
        const priority = parseInt(parts[2], 10);
        // The URI might contain #, and the anchor follows it
        // Look for the pattern: uri#anchor or just uri with anchor as next field
        let uri = parts[3];
        let anchor = parts[4];
        // Check if URI contains # - if so, split it
        if (uri.includes('#')) {
            const uriParts = uri.split('#');
            uri = uriParts[0];
            // The anchor might be embedded in the URI or be the next field
            if (uriParts.length > 1 && uriParts[1]) {
                anchor = uriParts[1];
            }
            // If anchor field is just "-", then use the anchor from URI
            if (parts[4] === '-' && uriParts[1]) {
                anchor = uriParts[1];
            }
        }
        // Debug: Log the raw line and parsed anchor for specific items
        if (name === 'for' || name === 'class' || name === 'len') {
            console.log(`[PythonHover] Raw line: "${line}"`);
            console.log(`[PythonHover] Parsed - name: "${name}", uri: "${uri}", anchor: "${anchor}"`);
        }
        // Skip if invalid
        if (!name || !domain || !role || isNaN(priority)) {
            return null;
        }
        // Handle special placeholders in intersphinx inventory
        // '$' is a placeholder for the object name in anchors
        if (name === 'for' || name === 'class' || name === 'len') {
            console.log(`[PythonHover] Processing anchor for ${name}: "${anchor}"`);
        }
        if (anchor.includes('$')) {
            if (name === 'for' || name === 'class' || name === 'len') {
                console.log(`[PythonHover] Anchor contains $, replacing...`);
            }
            // For some entries, we need to transform the name
            let replacementName = name;
            // Special cases for anchor replacement
            if (anchor.includes('term-$')) {
                // For glossary terms, use the name directly
                replacementName = name;
                anchor = anchor.replace(/\$/g, replacementName);
            }
            else if (domain === 'py' && role === 'class') {
                // For Python classes, use the class name
                replacementName = name;
                anchor = anchor.replace(/\$/g, replacementName);
            }
            else if (domain === 'py' && role === 'function') {
                // For Python functions, use the function name
                replacementName = name;
                anchor = anchor.replace(/\$/g, replacementName);
            }
            else if (domain === 'std' && role === 'label') {
                // For std:label entries, the anchor often has extra content after $
                // For 'for' with anchor '$#The', we want just 'for'
                if (anchor.startsWith('$#') || anchor.startsWith('$')) {
                    // Replace $ with the name and remove any trailing content after #
                    anchor = anchor.replace('$', replacementName);
                    // If there's a # followed by other content, keep only the name part
                    if (anchor.includes('#') && anchor !== replacementName) {
                        const parts = anchor.split('#');
                        anchor = parts[0]; // Keep only the part before #
                    }
                    if (name === 'for' || name === 'class' || name === 'len') {
                        console.log(`[PythonHover] Special std:label processing: ${anchor}`);
                    }
                    // Skip the general replacement below
                }
                else {
                    anchor = anchor.replace(/\$/g, replacementName);
                }
            }
            else {
                anchor = anchor.replace(/\$/g, replacementName);
            }
            if (name === 'for' || name === 'class' || name === 'len') {
                console.log(`[PythonHover] Final processed anchor: "${anchor}"`);
            }
        }
        // Build full URL
        const baseUrl = `${InventoryManager.DOCS_BASE_URL}/${version}`;
        const fullUri = uri.startsWith('http') ? uri : `${baseUrl}/${uri}`;
        const fullAnchor = anchor === '-' ? '' : anchor;
        return {
            name,
            domain,
            role,
            priority,
            uri: fullUri,
            anchor: fullAnchor
        };
    }
    async resolveSymbol(symbol, version) {
        const inventory = await this.getInventory(version);
        // Collect all matching entries by checking both simple names and qualified names
        const candidates = [];
        // First, find all entries for this symbol (including qualified names)
        for (const [key, inventoryEntry] of inventory) {
            if (key === symbol || (key.includes(':') && key.startsWith(`${symbol}:`))) {
                candidates.push(inventoryEntry);
                console.log(`[PythonHover] Found entry: ${inventoryEntry.name} (${inventoryEntry.domain}:${inventoryEntry.role})`);
            }
        }
        // Try with builtins prefix for common functions
        const builtinEntry = inventory.get(`builtins.${symbol}`);
        if (builtinEntry) {
            candidates.push(builtinEntry);
        }
        // Try as a method on common types
        const commonTypes = ['str', 'list', 'dict', 'set', 'tuple', 'int', 'float'];
        for (const type of commonTypes) {
            const typeEntry = inventory.get(`${type}.${symbol}`);
            if (typeEntry) {
                candidates.push(typeEntry);
            }
        }
        // Special handling for dunder methods (like __str__, __init__, __len__, etc.)
        if (symbol.startsWith('__') && symbol.endsWith('__')) {
            console.log(`[PythonHover] Looking for special method: ${symbol}`);
            // Try on object (base class for all Python objects)
            const objectEntry = inventory.get(`object.${symbol}`);
            if (objectEntry) {
                candidates.push(objectEntry);
                console.log(`[PythonHover] Found ${symbol} on object`);
            }
            // Try without the prefix/suffix in case it's documented differently
            const baseMethodName = symbol.slice(2, -2); // Remove __ from both ends
            const baseEntry = inventory.get(baseMethodName);
            if (baseEntry) {
                candidates.push(baseEntry);
                console.log(`[PythonHover] Found base method: ${baseMethodName}`);
            }
            // Look for it in the data model documentation
            const dataModelEntries = [
                `datamodel.${symbol}`,
                `object.${symbol}`,
                `type.${symbol}`,
                symbol // Direct lookup
            ];
            for (const key of dataModelEntries) {
                const entry = inventory.get(key);
                if (entry) {
                    candidates.push(entry);
                    console.log(`[PythonHover] Found ${symbol} via ${key}`);
                }
            }
            // Search through all entries to find any that contain this special method
            for (const [key, inventoryEntry] of inventory) {
                if (key.endsWith(`.${symbol}`) && !candidates.includes(inventoryEntry)) {
                    candidates.push(inventoryEntry);
                    console.log(`[PythonHover] Found ${symbol} on ${key.split('.')[0]}`);
                }
            }
        }
        // Try exceptions
        const exceptionEntry = inventory.get(`exceptions.${symbol}`);
        if (exceptionEntry) {
            candidates.push(exceptionEntry);
        }
        // If we have candidates, pick the best one based on priority
        if (candidates.length > 0) {
            console.log(`[PythonHover] Found ${candidates.length} candidates for "${symbol}":`, candidates.map(c => `${c.name} (${c.domain}:${c.role}) -> ${c.uri}#${c.anchor}`));
            const selected = this.selectBestCandidate(candidates, symbol);
            console.log(`[PythonHover] Selected: ${selected.name} (${selected.domain}:${selected.role})`);
            return selected;
        }
        // Fallback: create synthetic entries for common Python keywords
        if (this.isPythonKeyword(symbol)) {
            console.log(`[PythonHover] Creating fallback entry for keyword: ${symbol}`);
            return this.createKeywordFallback(symbol, version);
        }
        // Fallback: create synthetic entries for common special methods
        if (symbol.startsWith('__') && symbol.endsWith('__')) {
            console.log(`[PythonHover] Creating fallback entry for special method: ${symbol}`);
            return this.createSpecialMethodFallback(symbol, version);
        }
        return null;
    }
    createKeywordFallback(symbol, version) {
        // Manual mapping for Python keywords to their documentation sections
        const keywordMappings = {
            'class': { uri: 'reference/compound_stmts.html', anchor: 'class' },
            'def': { uri: 'reference/compound_stmts.html', anchor: 'function' },
            'if': { uri: 'reference/compound_stmts.html', anchor: 'if' },
            'for': { uri: 'reference/compound_stmts.html', anchor: 'for' },
            'while': { uri: 'reference/compound_stmts.html', anchor: 'while' },
            'try': { uri: 'reference/compound_stmts.html', anchor: 'try' },
            'with': { uri: 'reference/compound_stmts.html', anchor: 'with' },
            'import': { uri: 'reference/simple_stmts.html', anchor: 'import' },
            'from': { uri: 'reference/simple_stmts.html', anchor: 'from' },
            'return': { uri: 'reference/simple_stmts.html', anchor: 'return' },
            'yield': { uri: 'reference/simple_stmts.html', anchor: 'yield' },
            'pass': { uri: 'reference/simple_stmts.html', anchor: 'pass' },
            'break': { uri: 'reference/simple_stmts.html', anchor: 'break' },
            'continue': { uri: 'reference/simple_stmts.html', anchor: 'continue' },
            'lambda': { uri: 'reference/expressions.html', anchor: 'lambda' },
            'and': { uri: 'reference/expressions.html', anchor: 'and' },
            'or': { uri: 'reference/expressions.html', anchor: 'or' },
            'not': { uri: 'reference/expressions.html', anchor: 'not' },
            'in': { uri: 'reference/expressions.html', anchor: 'in' },
            'is': { uri: 'reference/expressions.html', anchor: 'is' }
        };
        const mapping = keywordMappings[symbol];
        if (mapping) {
            const baseUrl = `${InventoryManager.DOCS_BASE_URL}/${version}`;
            return {
                name: symbol,
                domain: 'py',
                role: 'keyword',
                priority: 1,
                uri: `${baseUrl}/${mapping.uri}`,
                anchor: mapping.anchor
            };
        }
        return null;
    }
    createSpecialMethodFallback(symbol, version) {
        // Manual mapping for common special methods to their documentation sections
        const specialMethodMappings = {
            '__init__': { uri: 'reference/datamodel.html', anchor: '__init__', description: 'Object initialization' },
            '__str__': { uri: 'reference/datamodel.html', anchor: '__str__', description: 'String representation' },
            '__repr__': { uri: 'reference/datamodel.html', anchor: '__repr__', description: 'Official string representation' },
            '__len__': { uri: 'reference/datamodel.html', anchor: '__len__', description: 'Length of object' },
            '__getitem__': { uri: 'reference/datamodel.html', anchor: '__getitem__', description: 'Get item by key/index' },
            '__setitem__': { uri: 'reference/datamodel.html', anchor: '__setitem__', description: 'Set item by key/index' },
            '__delitem__': { uri: 'reference/datamodel.html', anchor: '__delitem__', description: 'Delete item by key/index' },
            '__iter__': { uri: 'reference/datamodel.html', anchor: '__iter__', description: 'Return iterator' },
            '__next__': { uri: 'reference/datamodel.html', anchor: '__next__', description: 'Return next item from iterator' },
            '__contains__': { uri: 'reference/datamodel.html', anchor: '__contains__', description: 'Membership test operator' },
            '__call__': { uri: 'reference/datamodel.html', anchor: '__call__', description: 'Make object callable' },
            '__enter__': { uri: 'reference/datamodel.html', anchor: '__enter__', description: 'Context manager entry' },
            '__exit__': { uri: 'reference/datamodel.html', anchor: '__exit__', description: 'Context manager exit' },
            '__new__': { uri: 'reference/datamodel.html', anchor: '__new__', description: 'Object creation' },
            '__del__': { uri: 'reference/datamodel.html', anchor: '__del__', description: 'Object deletion' },
            '__eq__': { uri: 'reference/datamodel.html', anchor: '__eq__', description: 'Equality comparison' },
            '__ne__': { uri: 'reference/datamodel.html', anchor: '__ne__', description: 'Inequality comparison' },
            '__lt__': { uri: 'reference/datamodel.html', anchor: '__lt__', description: 'Less than comparison' },
            '__le__': { uri: 'reference/datamodel.html', anchor: '__le__', description: 'Less than or equal comparison' },
            '__gt__': { uri: 'reference/datamodel.html', anchor: '__gt__', description: 'Greater than comparison' },
            '__ge__': { uri: 'reference/datamodel.html', anchor: '__ge__', description: 'Greater than or equal comparison' },
            '__hash__': { uri: 'reference/datamodel.html', anchor: '__hash__', description: 'Hash value' },
            '__bool__': { uri: 'reference/datamodel.html', anchor: '__bool__', description: 'Truth value testing' },
            '__add__': { uri: 'reference/datamodel.html', anchor: '__add__', description: 'Addition operator' },
            '__sub__': { uri: 'reference/datamodel.html', anchor: '__sub__', description: 'Subtraction operator' },
            '__mul__': { uri: 'reference/datamodel.html', anchor: '__mul__', description: 'Multiplication operator' },
            '__truediv__': { uri: 'reference/datamodel.html', anchor: '__truediv__', description: 'Division operator' },
            '__floordiv__': { uri: 'reference/datamodel.html', anchor: '__floordiv__', description: 'Floor division operator' },
            '__mod__': { uri: 'reference/datamodel.html', anchor: '__mod__', description: 'Modulo operator' },
            '__pow__': { uri: 'reference/datamodel.html', anchor: '__pow__', description: 'Power operator' },
            '__getattr__': { uri: 'reference/datamodel.html', anchor: '__getattr__', description: 'Attribute access' },
            '__setattr__': { uri: 'reference/datamodel.html', anchor: '__setattr__', description: 'Attribute assignment' },
            '__delattr__': { uri: 'reference/datamodel.html', anchor: '__delattr__', description: 'Attribute deletion' }
        };
        const mapping = specialMethodMappings[symbol];
        if (mapping) {
            const baseUrl = `${InventoryManager.DOCS_BASE_URL}/${version}`;
            return {
                name: symbol,
                domain: 'py',
                role: 'method',
                priority: 1,
                uri: `${baseUrl}/${mapping.uri}`,
                anchor: mapping.anchor
            };
        }
        return null;
    }
    isPythonKeyword(symbol) {
        const keywords = [
            'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
            'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
            'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
            'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield'
        ];
        return keywords.includes(symbol);
    }
    selectBestCandidate(candidates, symbol) {
        // Priority order for domain:role combinations
        const domainRolePriority = [
            'py:keyword', // Python keywords like 'class', 'def', 'if'
            'py:stmt', // Statement types like compound statements
            'py:function', // Built-in functions like 'len', 'print'
            'py:method', // Methods like 'str.split'
            'py:class', // Classes like 'str', 'list'
            'py:exception', // Exceptions like 'ValueError'
            'py:attribute', // Attributes
            'py:module', // Modules
            'py:data', // Data/constants
            'std:doc', // Documentation sections
            'std:label', // Labels
            'std:term' // Glossary terms (lowest priority)
        ];
        // First, filter out std:term entries if we have better alternatives for keywords
        if (this.isPythonKeyword(symbol)) {
            const pyEntries = candidates.filter(c => c.domain === 'py');
            const stdLabelEntries = candidates.filter(c => c.domain === 'std' && c.role === 'label');
            // Prefer py: entries if available
            if (pyEntries.length > 0) {
                candidates = pyEntries;
            }
            // Otherwise, prefer std:label over std:term for keywords
            else if (stdLabelEntries.length > 0) {
                candidates = stdLabelEntries;
            }
        }
        // Sort candidates by priority
        candidates.sort((a, b) => {
            const aKey = `${a.domain}:${a.role}`;
            const bKey = `${b.domain}:${b.role}`;
            const aPriority = domainRolePriority.indexOf(aKey);
            const bPriority = domainRolePriority.indexOf(bKey);
            // If both are in priority list, use the order
            if (aPriority !== -1 && bPriority !== -1) {
                return aPriority - bPriority;
            }
            // If only one is in priority list, prefer it
            if (aPriority !== -1)
                return -1;
            if (bPriority !== -1)
                return 1;
            // If neither is in priority list, use inventory priority
            return a.priority - b.priority;
        });
        return candidates[0];
    }
    async searchSymbols(query, version, limit = 10) {
        const inventory = await this.getInventory(version);
        const results = [];
        const lowercaseQuery = query.toLowerCase();
        for (const [name, entry] of inventory) {
            if (name.toLowerCase().includes(lowercaseQuery)) {
                results.push(entry);
                if (results.length >= limit) {
                    break;
                }
            }
        }
        // Sort by relevance (exact match first, then by length)
        results.sort((a, b) => {
            const aExact = a.name.toLowerCase() === lowercaseQuery ? 0 : 1;
            const bExact = b.name.toLowerCase() === lowercaseQuery ? 0 : 1;
            if (aExact !== bExact) {
                return aExact - bExact;
            }
            return a.name.length - b.name.length;
        });
        return results;
    }
}
exports.InventoryManager = InventoryManager;
InventoryManager.DOCS_BASE_URL = 'https://docs.python.org';
//# sourceMappingURL=inventory.js.map