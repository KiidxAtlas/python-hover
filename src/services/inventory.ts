// CommonJS import for node-fetch
import * as nodeFetch from 'node-fetch';
const fetch = nodeFetch.default || nodeFetch;

import * as pako from 'pako';
import * as vscode from 'vscode';
import { URLValidator } from '../utils/urlValidator';
import { CacheManager } from './cache';
import { ConfigurationManager } from './config';
import { ErrorNotifier } from './errorNotifier';
import { Logger } from './logger';
import { PackageDetector } from './packageDetector';

export interface InventoryEntry {
    name: string;
    domain: string;
    role: string;
    priority: number;
    uri: string;
    anchor: string;
}

export interface LibraryInventoryConfig {
    name: string;
    inventoryUrl: string;
    baseUrl: string; // Base URL for resolving relative links
    version?: string; // Optional: specific version
}

export interface VersionedInventoryConfig extends LibraryInventoryConfig {
    version: string;
    isExactMatch: boolean; // true if exact version match, false if fallback
}

export class InventoryManager {
    private static readonly DOCS_BASE_URL = 'https://docs.python.org';

    // Third-party library inventory configurations
    private static readonly THIRD_PARTY_LIBRARIES: LibraryInventoryConfig[] = [
        {
            name: 'numpy',
            inventoryUrl: 'https://numpy.org/doc/stable/objects.inv',
            baseUrl: 'https://numpy.org/doc/stable/'
        },
        {
            name: 'pandas',
            inventoryUrl: 'https://pandas.pydata.org/docs/objects.inv',
            baseUrl: 'https://pandas.pydata.org/docs/'
        },
        {
            name: 'requests',
            inventoryUrl: 'https://docs.python-requests.org/en/latest/objects.inv',
            baseUrl: 'https://docs.python-requests.org/en/latest/'
        },
        {
            name: 'scipy',
            inventoryUrl: 'https://docs.scipy.org/doc/scipy/objects.inv',
            baseUrl: 'https://docs.scipy.org/doc/scipy/'
        },
        {
            name: 'matplotlib',
            inventoryUrl: 'https://matplotlib.org/stable/objects.inv',
            baseUrl: 'https://matplotlib.org/stable/'
        },
        {
            name: 'flask',
            inventoryUrl: 'https://flask.palletsprojects.com/en/stable/objects.inv',
            baseUrl: 'https://flask.palletsprojects.com/en/stable/'
        },
        {
            name: 'django',
            inventoryUrl: 'https://docs.djangoproject.com/en/stable/_objects/',
            baseUrl: 'https://docs.djangoproject.com/en/stable/'
        },
        {
            name: 'sklearn',
            inventoryUrl: 'https://scikit-learn.org/stable/objects.inv',
            baseUrl: 'https://scikit-learn.org/stable/'
        },
        {
            name: 'pytest',
            inventoryUrl: 'https://docs.pytest.org/en/stable/objects.inv',
            baseUrl: 'https://docs.pytest.org/en/stable/'
        },
        {
            name: 'sphinx',
            inventoryUrl: 'https://www.sphinx-doc.org/en/master/objects.inv',
            baseUrl: 'https://www.sphinx-doc.org/en/master/'
        },
        {
            name: 'fastapi',
            inventoryUrl: 'https://fastapi.tiangolo.com/objects.inv',
            baseUrl: 'https://fastapi.tiangolo.com/'
        },
        {
            name: 'pydantic',
            inventoryUrl: 'https://docs.pydantic.dev/latest/objects.inv',
            baseUrl: 'https://docs.pydantic.dev/latest/'
        },
        {
            name: 'sqlalchemy',
            inventoryUrl: 'https://docs.sqlalchemy.org/en/20/objects.inv',
            baseUrl: 'https://docs.sqlalchemy.org/en/20/'
        },
        {
            name: 'beautifulsoup4',
            inventoryUrl: 'https://www.crummy.com/software/BeautifulSoup/bs4/doc/objects.inv',
            baseUrl: 'https://www.crummy.com/software/BeautifulSoup/bs4/doc/'
        },
        {
            name: 'bs4',
            inventoryUrl: 'https://www.crummy.com/software/BeautifulSoup/bs4/doc/objects.inv',
            baseUrl: 'https://www.crummy.com/software/BeautifulSoup/bs4/doc/'
        },
        {
            name: 'selenium',
            inventoryUrl: 'https://www.selenium.dev/selenium/docs/api/py/objects.inv',
            baseUrl: 'https://www.selenium.dev/selenium/docs/api/py/'
        },
        {
            name: 'pillow',
            inventoryUrl: 'https://pillow.readthedocs.io/en/stable/objects.inv',
            baseUrl: 'https://pillow.readthedocs.io/en/stable/'
        },
        {
            name: 'pil',
            inventoryUrl: 'https://pillow.readthedocs.io/en/stable/objects.inv',
            baseUrl: 'https://pillow.readthedocs.io/en/stable/'
        },
        // Machine Learning & AI
        {
            name: 'torch',
            inventoryUrl: 'https://pytorch.org/docs/stable/objects.inv',
            baseUrl: 'https://pytorch.org/docs/stable/'
        },
        {
            name: 'pytorch',
            inventoryUrl: 'https://pytorch.org/docs/stable/objects.inv',
            baseUrl: 'https://pytorch.org/docs/stable/'
        },
        // HTTP & Async
        {
            name: 'aiohttp',
            inventoryUrl: 'https://docs.aiohttp.org/en/stable/objects.inv',
            baseUrl: 'https://docs.aiohttp.org/en/stable/'
        },
        // CLI
        {
            name: 'click',
            inventoryUrl: 'https://click.palletsprojects.com/en/stable/objects.inv',
            baseUrl: 'https://click.palletsprojects.com/en/stable/'
        },
    ];

    constructor(
        private cacheManager: CacheManager,
        private logger: Logger,
        private configManager?: ConfigurationManager,
        private packageDetector?: PackageDetector
    ) { }

    /**
     * Get all library configurations (hardcoded + custom)
     */
    private getAllLibraryConfigs(): LibraryInventoryConfig[] {
        const customLibs: LibraryInventoryConfig[] = this.configManager
            ? this.configManager.customLibraries
            : [];

        // Merge custom libraries with hardcoded ones
        // Custom libraries take precedence if there's a name collision
        const allLibs = [...InventoryManager.THIRD_PARTY_LIBRARIES];
        const validationErrors: string[] = [];

        for (const customLib of customLibs) {
            // Comprehensive validation of custom library config
            const errors = this.validateCustomLibrary(customLib);

            if (errors.length > 0) {
                const errorMsg = `Invalid custom library config for "${customLib.name || 'unknown'}": ${errors.join(', ')}`;
                this.logger.error(errorMsg);
                validationErrors.push(errorMsg);
                // Show user-friendly error notification
                if (typeof vscode !== 'undefined' && vscode.window) {
                    ErrorNotifier.showConfigError(
                        `custom library "${customLib.name || 'unknown'}"`,
                        errors[0],
                        'pythonHover.customLibraries'
                    );
                }
                continue;
            }

            // Check if library with same name exists
            const existingIndex = allLibs.findIndex(lib => lib.name === customLib.name);
            if (existingIndex !== -1) {
                // Replace existing with custom
                this.logger.info(`Overriding built-in config for library: ${customLib.name}`);
                allLibs[existingIndex] = customLib;
            } else {
                // Add new custom library
                this.logger.info(`Adding custom library: ${customLib.name}`);
                allLibs.push(customLib);
            }
        }

        // Log summary if there were validation errors
        if (validationErrors.length > 0) {
            this.logger.warn(`${validationErrors.length} custom library config(s) had validation errors and were skipped`);
        }

        return allLibs;
    }

    /**
     * Validate a custom library configuration
     * Returns array of error messages (empty if valid)
     */
    private validateCustomLibrary(lib: any): string[] {
        const errors: string[] = [];

        // Validate name
        const nameValidation = URLValidator.validateName(lib.name);
        if (!nameValidation.isValid) {
            errors.push(...nameValidation.errors);
        }
        // Log name warnings
        nameValidation.warnings.forEach(warning => {
            this.logger.warn(warning);
        });

        // Validate inventoryUrl
        if (!lib.inventoryUrl || typeof lib.inventoryUrl !== 'string' || lib.inventoryUrl.trim() === '') {
            errors.push('Missing or invalid "inventoryUrl" field');
        } else {
            const invValidation = URLValidator.validateInventoryURL(lib.inventoryUrl);
            if (!invValidation.isValid) {
                errors.push(...invValidation.errors);
            }
            // Log inventory URL warnings
            invValidation.warnings.forEach(warning => {
                this.logger.warn(`inventoryUrl "${lib.inventoryUrl}" - ${warning}`);
            });
        }

        // Validate baseUrl
        if (!lib.baseUrl || typeof lib.baseUrl !== 'string' || lib.baseUrl.trim() === '') {
            errors.push('Missing or invalid "baseUrl" field');
        } else {
            const baseValidation = URLValidator.validateBaseURL(lib.baseUrl);
            if (!baseValidation.isValid) {
                errors.push(...baseValidation.errors);
            }
            // Log base URL warnings
            baseValidation.warnings.forEach(warning => {
                this.logger.warn(`baseUrl "${lib.baseUrl}" - ${warning}`);
            });
        }

        return errors;
    }

    public async getInventory(version: string): Promise<Map<string, InventoryEntry>> {
        const cacheKey = `inventory-${version}-v8`; // v8 for enhanced cache invalidation support
        const maxAge = CacheManager.hoursToMs(24); // 24 hours

        this.logger.debug(`Getting inventory for version ${version}, cache key: ${cacheKey}`);

        try {
            // Check cache first
            const cached = await this.cacheManager.get<Record<string, InventoryEntry>>(cacheKey);
            this.logger.debug(`Cache lookup result: ${cached ? 'found' : 'not found'}`);

            if (cached) {
                const isExpired = await this.cacheManager.isExpired(cacheKey, maxAge);
                this.logger.debug(`Cache expired check: ${isExpired ? 'expired' : 'not expired'}`);
                this.logger.debug(`Cache timestamp: ${new Date(cached.timestamp)}`);
                this.logger.debug(`Max age: ${maxAge}ms (${maxAge / (1000 * 60 * 60)}h)`);

                if (!isExpired) {
                    this.logger.debug(`Using cached inventory for version ${version}`);
                    return new Map(Object.entries(cached.data));
                }
            }

            this.logger.debug(`Fetching fresh inventory for version ${version}`);
            const inventory = await this.fetchInventory(version);

            // Convert Map to Object for storage
            const inventoryObj: Record<string, InventoryEntry> = {};
            inventory.forEach((value, key) => {
                inventoryObj[key] = value;
            });

            await this.cacheManager.set(cacheKey, inventoryObj);
            return inventory;
        } catch (error) {
            this.logger.error(`Failed to get inventory for ${version}`, error as Error);
            // If fetch fails but we have cached data, use it
            const cached = await this.cacheManager.get<Record<string, InventoryEntry>>(cacheKey);
            if (cached) {
                this.logger.debug(`Using stale cached inventory due to fetch error`);
                return new Map(Object.entries(cached.data));
            }
            throw error;
        }
    }

    public async invalidateCache(): Promise<void> {
        this.logger.info('Invalidating inventory cache by incrementing version');

        // This forces cache refresh by incrementing the version number
        // Note: The actual cache key increment is handled by changing the version
        // in the getInventory method's cacheKey generation (currently at v8)
        this.logger.info(`Inventory cache will use new version: v8`);
    }

    /**
     * Get inventory for a third-party library with version awareness
     * If packageDetector is available, tries to use installed package version
     */
    public async getThirdPartyInventory(
        libraryName: string,
        pythonPath?: string
    ): Promise<Map<string, InventoryEntry> | null> {
        // Try version-aware lookup if package detector is available
        if (this.packageDetector && pythonPath) {
            const versionedConfig = await this.getVersionedLibraryConfig(libraryName, pythonPath);
            if (versionedConfig) {
                this.logger.debug(`Using ${versionedConfig.isExactMatch ? 'exact' : 'fallback'} version ${versionedConfig.version} for ${libraryName}`);
                return await this.fetchVersionedInventory(versionedConfig);
            }
        }

        // Fallback to standard lookup
        const allLibs = this.getAllLibraryConfigs();
        const config = allLibs.find(lib => lib.name === libraryName);

        if (!config) {
            this.logger.debug(`No inventory configuration for library: ${libraryName}`);
            return null;
        }

        const cacheKey = `inventory-${libraryName}-v1`;
        const maxAge = CacheManager.hoursToMs(24 * 7); // 7 days for third-party (more stable)

        this.logger.debug(`Getting third-party inventory for ${libraryName}`);

        try {
            // Check cache first
            const cached = await this.cacheManager.get<Record<string, InventoryEntry>>(cacheKey);

            if (cached) {
                const isExpired = await this.cacheManager.isExpired(cacheKey, maxAge);

                if (!isExpired) {
                    this.logger.debug(`Using cached inventory for ${libraryName}`);
                    return new Map(Object.entries(cached.data));
                }
            }

            this.logger.debug(`Fetching fresh inventory for ${libraryName}`);
            const inventory = await this.fetchThirdPartyInventory(config);

            // Convert Map to Object for storage
            const inventoryObj: Record<string, InventoryEntry> = {};
            inventory.forEach((value, key) => {
                inventoryObj[key] = value;
            });

            await this.cacheManager.set(cacheKey, inventoryObj);
            return inventory;
        } catch (error) {
            this.logger.error(`Failed to get inventory for ${libraryName}:`, error as Error);
            // If fetch fails but we have cached data, use it
            const cached = await this.cacheManager.get<Record<string, InventoryEntry>>(cacheKey);
            if (cached) {
                this.logger.debug(`Using stale cached inventory due to fetch error`);
                return new Map(Object.entries(cached.data));
            }
            return null; // Return null instead of throwing for third-party libraries
        }
    }

    private async fetchThirdPartyInventory(config: LibraryInventoryConfig): Promise<Map<string, InventoryEntry>> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        try {
            const response = await fetch(config.inventoryUrl, {
                signal: controller.signal,
                headers: { 'User-Agent': 'VSCode-Python-Hover-Extension' }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Failed to fetch inventory: ${response.status} ${response.statusText}`);
            }

            const buffer = await response.arrayBuffer();
            return this.parseThirdPartyInventory(new Uint8Array(buffer), config);
        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error(`Inventory fetch timed out after 10 seconds: ${config.inventoryUrl}`);
            }
            throw error;
        }
    }

    private async fetchInventory(version: string): Promise<Map<string, InventoryEntry>> {
        const inventoryUrl = `${InventoryManager.DOCS_BASE_URL}/${version}/objects.inv`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(inventoryUrl, {
                signal: controller.signal,
                headers: { 'User-Agent': 'VSCode-Python-Hover-Extension' }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Failed to fetch inventory: ${response.status} ${response.statusText}`);
            }

            const buffer = await response.arrayBuffer();
            return this.parseInventory(new Uint8Array(buffer), version);
        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error(`Inventory fetch timed out after 10 seconds: ${inventoryUrl}`);
            }
            throw error;
        }
    }

    private parseInventory(data: Uint8Array, version: string): Map<string, InventoryEntry> {
        const inventory = new Map<string, InventoryEntry>();

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
                if (line.trim() === '') continue;

                const entry = this.parseInventoryLine(line, version);
                if (entry) {
                    // Debug: Log entries we're storing to see if anchor replacement worked
                    if (entry.name === 'len' || entry.name === 'class' || entry.name === 'min') {
                        this.logger.debug(`Storing entry: ${entry.name} -> ${entry.uri}#${entry.anchor}`);
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
        } catch (error) {
            throw new Error(`Failed to parse inventory: ${error}`);
        }

        return inventory;
    }

    private parseThirdPartyInventory(data: Uint8Array, config: LibraryInventoryConfig): Map<string, InventoryEntry> {
        const inventory = new Map<string, InventoryEntry>();

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
            let entryCount = 0;
            for (const line of lines) {
                if (line.trim() === '') continue;

                const entry = this.parseThirdPartyInventoryLine(line, config);
                if (entry) {
                    // Store with the full qualified name from the inventory
                    // This preserves submodule structure (e.g., matplotlib.pyplot.plot)
                    inventory.set(entry.name, entry);

                    // Also store with domain:role qualified name
                    const domainRoleName = `${entry.name}:${entry.domain}:${entry.role}`;
                    inventory.set(domainRoleName, entry);

                    entryCount++;
                }
            }

            this.logger.debug(`Loaded ${entryCount} entries from ${config.name} inventory`);
        } catch (error) {
            throw new Error(`Failed to parse third-party inventory for ${config.name}: ${error}`);
        }

        return inventory;
    }

    private parseThirdPartyInventoryLine(line: string, config: LibraryInventoryConfig): InventoryEntry | null {
        // Intersphinx inventory format:
        // name domain:role priority uri anchor [display_name]

        const parts = line.split(/\s+/);
        if (parts.length < 5) {
            return null;
        }

        const name = parts[0];
        const [domain, role] = parts[1].split(':');
        const priority = parseInt(parts[2], 10);

        let uri = parts[3];
        let anchor = parts[4];

        // Check if URI contains # - if so, split it
        if (uri.includes('#')) {
            const uriParts = uri.split('#');
            uri = uriParts[0];
            if (uriParts.length > 1 && uriParts[1]) {
                anchor = uriParts[1];
            }
            if (parts[4] === '-' && uriParts[1]) {
                anchor = uriParts[1];
            }
        }

        // Skip if invalid
        if (!name || !domain || !role || isNaN(priority)) {
            return null;
        }

        // Handle special placeholders
        if (anchor.includes('$')) {
            anchor = anchor.replace(/\$/g, name);
        }

        // Resolve relative URIs to absolute using the base URL
        if (!uri.startsWith('http')) {
            uri = config.baseUrl + uri;
        }

        return {
            name,
            domain,
            role,
            priority,
            uri,
            anchor
        };
    }

    private shouldReplaceEntry(existing: InventoryEntry, newEntry: InventoryEntry): boolean {
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
        if (newPriority !== -1) return true;

        // Otherwise don't replace
        return false;
    }

    private parseInventoryLine(line: string, version: string): InventoryEntry | null {
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
            this.logger.debug(`Raw line: "${line}"`);
            this.logger.debug(`Parsed - name: "${name}", uri: "${uri}", anchor: "${anchor}"`);
        }

        // Skip if invalid
        if (!name || !domain || !role || isNaN(priority)) {
            return null;
        }

        // Handle special placeholders in intersphinx inventory
        // '$' is a placeholder for the object name in anchors
        if (name === 'for' || name === 'class' || name === 'len') {
            this.logger.debug(`Processing anchor for ${name}: "${anchor}"`);
        }
        if (anchor.includes('$')) {
            if (name === 'for' || name === 'class' || name === 'len') {
                this.logger.debug(`Anchor contains $, replacing...`);
            }
            // For some entries, we need to transform the name
            let replacementName = name;

            // Special cases for anchor replacement
            if (anchor.includes('term-$')) {
                // For glossary terms, use the name directly
                replacementName = name;
                anchor = anchor.replace(/\$/g, replacementName);
            } else if (domain === 'py' && role === 'class') {
                // For Python classes, use the class name
                replacementName = name;
                anchor = anchor.replace(/\$/g, replacementName);
            } else if (domain === 'py' && role === 'function') {
                // For Python functions, use the function name
                replacementName = name;
                anchor = anchor.replace(/\$/g, replacementName);
            } else if (domain === 'std' && role === 'label') {
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
                        this.logger.debug(`Special std:label processing: ${anchor}`);
                    }
                    // Skip the general replacement below
                } else {
                    anchor = anchor.replace(/\$/g, replacementName);
                }
            } else {
                anchor = anchor.replace(/\$/g, replacementName);
            }

            if (name === 'for' || name === 'class' || name === 'len') {
                this.logger.debug(`Final processed anchor: "${anchor}"`);
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

    public async resolveSymbol(
        symbol: string,
        version: string,
        context?: string,
        pythonPath?: string
    ): Promise<InventoryEntry | null> {
        // If we have a context (e.g., 'numpy'), check third-party library inventories first
        if (context) {
            const baseModule = context.split('.')[0];
            this.logger.debug(`Checking third-party library: ${baseModule} for symbol: ${symbol}`);

            const thirdPartyInventory = await this.getThirdPartyInventory(baseModule, pythonPath);
            if (thirdPartyInventory) {
                // Extract the method name from the symbol (in case it's already qualified like "torch.zeros")
                const methodName = symbol.includes('.') ? symbol.split('.').pop()! : symbol;

                // Try different qualified name variations
                const searchPatterns = [
                    symbol,                              // Try the symbol as-is first (e.g., "torch.zeros")
                    `${baseModule}.${methodName}`,       // e.g., numpy.ones
                    `${baseModule}.pyplot.${methodName}`, // e.g., matplotlib.pyplot.plot
                    methodName                           // Direct name from inventory
                ];

                // Special case for matplotlib - also try matplotlib.pyplot
                if (baseModule === 'matplotlib') {
                    searchPatterns.push(`matplotlib.pyplot.${methodName}`);
                }

                for (const pattern of searchPatterns) {
                    const entry = thirdPartyInventory.get(pattern);
                    if (entry) {
                        this.logger.debug(`Found third-party entry: ${pattern} -> ${entry.uri}#${entry.anchor}`);
                        return entry;
                    }
                }

                // If not found with exact names, search through all entries for partial matches
                for (const [key, entry] of thirdPartyInventory) {
                    // Skip domain:role entries
                    if (key.includes(':')) continue;

                    // Check if the entry name ends with the symbol we're looking for
                    if (entry.name.endsWith(`.${methodName}`) || entry.name === methodName) {
                        this.logger.debug(`Found third-party entry via partial match: ${entry.name} -> ${entry.uri}#${entry.anchor}`);
                        return entry;
                    }
                }

                this.logger.debug(`Symbol '${symbol}' not found in ${baseModule} inventory, falling back to stdlib`);
            }
        }

        // Fall back to standard library inventory
        const inventory = await this.getInventory(version);

        // Collect all matching entries by checking both simple names and qualified names
        const candidates: InventoryEntry[] = [];

        // First, find all entries for this symbol (including qualified names)
        for (const [key, inventoryEntry] of inventory) {
            if (key === symbol || (key.includes(':') && key.startsWith(`${symbol}:`))) {
                candidates.push(inventoryEntry);
                this.logger.debug(`Found entry: ${inventoryEntry.name} (${inventoryEntry.domain}:${inventoryEntry.role})`);
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
            this.logger.debug(`Looking for special method: ${symbol}`);

            // Try on object (base class for all Python objects)
            const objectEntry = inventory.get(`object.${symbol}`);
            if (objectEntry) {
                candidates.push(objectEntry);
                this.logger.debug(`Found ${symbol} on object`);
            }

            // Try without the prefix/suffix in case it's documented differently
            const baseMethodName = symbol.slice(2, -2); // Remove __ from both ends
            const baseEntry = inventory.get(baseMethodName);
            if (baseEntry) {
                candidates.push(baseEntry);
                this.logger.debug(`Found base method: ${baseMethodName}`);
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
                    this.logger.debug(`Found ${symbol} via ${key}`);
                }
            }

            // Search through all entries to find any that contain this special method
            for (const [key, inventoryEntry] of inventory) {
                if (key.endsWith(`.${symbol}`) && !candidates.includes(inventoryEntry)) {
                    candidates.push(inventoryEntry);
                    this.logger.debug(`Found ${symbol} on ${key.split('.')[0]}`);
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
            this.logger.debug(`Found ${candidates.length} candidates for "${symbol}": ${candidates.map(c => `${c.name} (${c.domain}:${c.role}) -> ${c.uri}#${c.anchor}`).join(', ')}`);
            const selected = this.selectBestCandidate(candidates, symbol);
            this.logger.debug(`Selected: ${selected.name} (${selected.domain}:${selected.role})`);
            return selected;
        }

        // Fallback: create synthetic entries for common Python keywords
        if (this.isPythonKeyword(symbol)) {
            this.logger.debug(`Creating fallback entry for keyword: ${symbol}`);
            return this.createKeywordFallback(symbol, version);
        }

        // Fallback: create synthetic entries for common special methods
        if (symbol.startsWith('__') && symbol.endsWith('__')) {
            this.logger.debug(`Creating fallback entry for special method: ${symbol}`);
            return this.createSpecialMethodFallback(symbol, version);
        }

        return null;
    }

    private createKeywordFallback(symbol: string, version: string): InventoryEntry | null {
        // Manual mapping for Python keywords to their documentation sections
        const keywordMappings: { [key: string]: { uri: string; anchor: string } } = {
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

    private createSpecialMethodFallback(symbol: string, version: string): InventoryEntry | null {
        // Manual mapping for common special methods to their documentation sections
        const specialMethodMappings: { [key: string]: { uri: string; anchor: string; description: string } } = {
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

    private isPythonKeyword(symbol: string): boolean {
        const keywords = [
            'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
            'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
            'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
            'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield'
        ];
        return keywords.includes(symbol);
    }

    private selectBestCandidate(candidates: InventoryEntry[], symbol: string): InventoryEntry {
        // Priority order for domain:role combinations
        const domainRolePriority = [
            'py:keyword',      // Python keywords like 'class', 'def', 'if'
            'py:stmt',         // Statement types like compound statements
            'py:function',     // Built-in functions like 'len', 'print'
            'py:method',       // Methods like 'str.split'
            'py:class',        // Classes like 'str', 'list'
            'py:exception',    // Exceptions like 'ValueError'
            'py:attribute',    // Attributes
            'py:module',       // Modules
            'py:data',         // Data/constants
            'std:doc',         // Documentation sections
            'std:label',       // Labels
            'std:term'         // Glossary terms (lowest priority)
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
            if (aPriority !== -1) return -1;
            if (bPriority !== -1) return 1;

            // If neither is in priority list, use inventory priority
            return a.priority - b.priority;
        });

        return candidates[0];
    }

    public async searchSymbols(query: string, version: string, limit = 10): Promise<InventoryEntry[]> {
        const inventory = await this.getInventory(version);
        const results: InventoryEntry[] = [];

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

    /**
     * Get version-aware library configuration based on installed package
     */
    private async getVersionedLibraryConfig(
        libraryName: string,
        pythonPath: string
    ): Promise<VersionedInventoryConfig | null> {
        if (!this.packageDetector) {
            return null;
        }

        try {
            // Get installed package version
            const installedVersion = await this.packageDetector.getPackageVersion(pythonPath, libraryName);

            if (!installedVersion) {
                this.logger.debug(`Package ${libraryName} not installed in environment`);
                return null;
            }

            this.logger.debug(`Found ${libraryName} version ${installedVersion} in environment`);

            // Try to build version-specific URL
            const versionedConfig = this.buildVersionedConfig(libraryName, installedVersion);

            if (versionedConfig) {
                // Test if the exact version inventory exists
                const exists = await this.testInventoryUrl(versionedConfig.inventoryUrl);
                if (exists) {
                    return {
                        name: versionedConfig.name,
                        inventoryUrl: versionedConfig.inventoryUrl,
                        baseUrl: versionedConfig.baseUrl,
                        version: installedVersion,
                        isExactMatch: true
                    };
                }

                // Try fallback to closest version
                const fallbackConfig = await this.findClosestVersion(libraryName, installedVersion);
                if (fallbackConfig && fallbackConfig.version) {
                    return {
                        name: fallbackConfig.name,
                        inventoryUrl: fallbackConfig.inventoryUrl,
                        baseUrl: fallbackConfig.baseUrl,
                        version: fallbackConfig.version,
                        isExactMatch: false
                    };
                }
            }
        } catch (error) {
            this.logger.error(`Error getting versioned config for ${libraryName}:`, error as Error);
        }

        return null;
    }

    /**
     * Build version-specific inventory configuration
     */
    private buildVersionedConfig(libraryName: string, version: string): LibraryInventoryConfig | null {
        // Known URL patterns for popular libraries
        const versionPatterns: Record<string, (v: string) => LibraryInventoryConfig> = {
            'numpy': (v) => ({
                name: 'numpy',
                inventoryUrl: `https://numpy.org/doc/${v}/objects.inv`,
                baseUrl: `https://numpy.org/doc/${v}/`,
                version: v
            }),
            'pandas': (v) => ({
                name: 'pandas',
                inventoryUrl: `https://pandas.pydata.org/pandas-docs/version/${v}/objects.inv`,
                baseUrl: `https://pandas.pydata.org/pandas-docs/version/${v}/`,
                version: v
            }),
            'scipy': (v) => ({
                name: 'scipy',
                inventoryUrl: `https://docs.scipy.org/doc/scipy-${v}/objects.inv`,
                baseUrl: `https://docs.scipy.org/doc/scipy-${v}/`,
                version: v
            }),
            'matplotlib': (v) => ({
                name: 'matplotlib',
                inventoryUrl: `https://matplotlib.org/${v}/objects.inv`,
                baseUrl: `https://matplotlib.org/${v}/`,
                version: v
            }),
            'requests': (v) => ({
                name: 'requests',
                inventoryUrl: `https://docs.python-requests.org/en/v${v}/objects.inv`,
                baseUrl: `https://docs.python-requests.org/en/v${v}/`,
                version: v
            }),
            'sklearn': (v) => ({
                name: 'sklearn',
                inventoryUrl: `https://scikit-learn.org/${v}/objects.inv`,
                baseUrl: `https://scikit-learn.org/${v}/`,
                version: v
            }),
            'torch': (v) => ({
                name: 'torch',
                inventoryUrl: `https://pytorch.org/docs/${v}/objects.inv`,
                baseUrl: `https://pytorch.org/docs/${v}/`,
                version: v
            }),
        };

        const pattern = versionPatterns[libraryName];
        if (pattern) {
            // Try full version first (e.g., "2.1.0")
            return pattern(version);
        }

        return null;
    }

    /**
     * Test if an inventory URL is accessible
     */
    private async testInventoryUrl(url: string): Promise<boolean> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

            const response = await fetch(url, {
                method: 'HEAD',
                signal: controller.signal,
                headers: { 'User-Agent': 'VSCode-Python-Hover-Extension' }
            });

            clearTimeout(timeoutId);
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Find closest available version if exact match not found
     */
    private async findClosestVersion(libraryName: string, installedVersion: string): Promise<LibraryInventoryConfig | null> {
        const [major, minor] = installedVersion.split('.').map(Number);

        // Try minor version variations (downgrade patch version)
        const tryVersions = [
            `${major}.${minor}.0`,
            `${major}.${minor}`,
            installedVersion.split('.').slice(0, 2).join('.'), // Major.Minor only
        ];

        // Also try "stable" or "latest" endpoints
        const fallbackPatterns: Record<string, LibraryInventoryConfig> = {
            'numpy': {
                name: 'numpy',
                inventoryUrl: 'https://numpy.org/doc/stable/objects.inv',
                baseUrl: 'https://numpy.org/doc/stable/',
                version: 'stable'
            },
            'pandas': {
                name: 'pandas',
                inventoryUrl: 'https://pandas.pydata.org/docs/objects.inv',
                baseUrl: 'https://pandas.pydata.org/docs/',
                version: 'latest'
            },
            'scipy': {
                name: 'scipy',
                inventoryUrl: 'https://docs.scipy.org/doc/scipy/objects.inv',
                baseUrl: 'https://docs.scipy.org/doc/scipy/',
                version: 'stable'
            },
            'torch': {
                name: 'torch',
                inventoryUrl: 'https://pytorch.org/docs/stable/objects.inv',
                baseUrl: 'https://pytorch.org/docs/stable/',
                version: 'stable'
            },
        };

        // Try specific versions first
        for (const tryVersion of tryVersions) {
            const config = this.buildVersionedConfig(libraryName, tryVersion);
            if (config && await this.testInventoryUrl(config.inventoryUrl)) {
                this.logger.debug(`Found fallback version ${tryVersion} for ${libraryName}`);
                return config;
            }
        }

        // Fall back to stable/latest
        const fallback = fallbackPatterns[libraryName];
        if (fallback && await this.testInventoryUrl(fallback.inventoryUrl)) {
            this.logger.debug(`Using fallback '${fallback.version}' docs for ${libraryName}`);
            return fallback;
        }

        return null;
    }

    /**
     * Fetch inventory for versioned configuration
     */
    private async fetchVersionedInventory(config: VersionedInventoryConfig): Promise<Map<string, InventoryEntry> | null> {
        const cacheKey = `inventory-${config.name}-${config.version}-v1`;
        const maxAge = CacheManager.hoursToMs(24 * 7); // 7 days

        try {
            // Check cache first
            const cached = await this.cacheManager.get<Record<string, InventoryEntry>>(cacheKey);

            if (cached) {
                const isExpired = await this.cacheManager.isExpired(cacheKey, maxAge);

                if (!isExpired) {
                    this.logger.debug(`Using cached versioned inventory for ${config.name} ${config.version}`);
                    return new Map(Object.entries(cached.data));
                }
            }

            this.logger.debug(`Fetching versioned inventory for ${config.name} ${config.version}`);
            const inventory = await this.fetchThirdPartyInventory(config);

            // Convert Map to Object for storage
            const inventoryObj: Record<string, InventoryEntry> = {};
            inventory.forEach((value, key) => {
                inventoryObj[key] = value;
            });

            await this.cacheManager.set(cacheKey, inventoryObj);
            return inventory;
        } catch (error) {
            this.logger.error(`Failed to fetch versioned inventory for ${config.name}:`, error as Error);
            // Fall back to cached data if available
            const cached = await this.cacheManager.get<Record<string, InventoryEntry>>(cacheKey);
            if (cached) {
                this.logger.debug(`Using stale cached inventory`);
                return new Map(Object.entries(cached.data));
            }
            return null;
        }
    }

    /**
     * Get all supported libraries (built-in + custom)
     */
    public getAllSupportedLibraries(): LibraryInventoryConfig[] {
        const builtIn = InventoryManager.THIRD_PARTY_LIBRARIES;
        const customLibs = this.configManager?.customLibraries ?? [];
        const custom = customLibs.map(lib => ({
            name: lib.name,
            inventoryUrl: lib.inventoryUrl,
            baseUrl: lib.baseUrl
        }));

        // Combine and deduplicate by name
        const allLibs = [...builtIn];
        const existingNames = new Set(builtIn.map(lib => lib.name));

        for (const lib of custom) {
            if (!existingNames.has(lib.name)) {
                allLibs.push(lib);
            }
        }

        return allLibs.sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Get count of supported libraries
     */
    public getSupportedLibrariesCount(): { builtIn: number; custom: number; total: number } {
        const builtIn = InventoryManager.THIRD_PARTY_LIBRARIES.length;
        const customLibs = this.configManager?.customLibraries ?? [];

        // Check for duplicates
        const builtInNames = new Set(InventoryManager.THIRD_PARTY_LIBRARIES.map(lib => lib.name));
        const uniqueCustom = customLibs.filter(lib => !builtInNames.has(lib.name)).length;

        return {
            builtIn,
            custom: customLibs.length,
            total: builtIn + uniqueCustom
        };
    }
}
