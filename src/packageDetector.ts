import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';

const execAsync = promisify(exec);

export interface InstalledPackage {
    name: string;
    version: string;
    location?: string;
}

export interface PythonEnvironment {
    path: string;
    type: 'venv' | 'conda' | 'system' | 'pyenv' | 'unknown';
    version: string;
}

export class PackageDetector {
    private packageCache: Map<string, { packages: InstalledPackage[]; timestamp: number }>;
    private readonly CACHE_TTL = 60000; // 1 minute cache

    constructor() {
        this.packageCache = new Map();
    }

    /**
     * Detect the active Python environment
     */
    public async detectPythonEnvironment(): Promise<PythonEnvironment | null> {
        try {
            // Try to get from Python extension first
            const pythonExt = vscode.extensions.getExtension('ms-python.python');
            if (pythonExt) {
                if (!pythonExt.isActive) {
                    await pythonExt.activate();
                }

                // Get the configured Python path
                const pythonPath = vscode.workspace.getConfiguration('python').get<string>('defaultInterpreterPath');

                if (pythonPath) {
                    const envType = this.detectEnvironmentType(pythonPath);
                    const version = await this.getPythonVersion(pythonPath);

                    console.log(`[PackageDetector] Detected environment: ${pythonPath} (${envType}) - Python ${version}`);

                    return {
                        path: pythonPath,
                        type: envType,
                        version: version
                    };
                }
            }

            // Fallback: try to find Python in workspace
            return await this.detectFromWorkspace();
        } catch (error) {
            console.error('[PackageDetector] Error detecting Python environment:', error);
            return null;
        }
    }

    /**
     * Detect environment type from path
     */
    private detectEnvironmentType(pythonPath: string): PythonEnvironment['type'] {
        const lowerPath = pythonPath.toLowerCase();

        if (lowerPath.includes('conda') || lowerPath.includes('anaconda') || lowerPath.includes('miniconda')) {
            return 'conda';
        }
        if (lowerPath.includes('venv') || lowerPath.includes('.venv') || lowerPath.includes('virtualenv')) {
            return 'venv';
        }
        if (lowerPath.includes('.pyenv') || lowerPath.includes('pyenv')) {
            return 'pyenv';
        }
        if (lowerPath.includes('/usr/') || lowerPath.includes('/System/') || lowerPath.startsWith('C:\\Python')) {
            return 'system';
        }

        return 'unknown';
    }

    /**
     * Get Python version from interpreter
     */
    private async getPythonVersion(pythonPath: string): Promise<string> {
        try {
            const { stdout } = await execAsync(`"${pythonPath}" --version`);
            const versionMatch = stdout.match(/Python (\d+\.\d+)/);
            if (versionMatch) {
                return versionMatch[1];
            }
        } catch (error) {
            console.error('[PackageDetector] Error getting Python version:', error);
        }
        return '3.12'; // fallback
    }

    /**
     * Detect Python environment from workspace
     */
    private async detectFromWorkspace(): Promise<PythonEnvironment | null> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return null;
        }

        for (const folder of workspaceFolders) {
            // Check for common venv locations
            const venvPaths = [
                path.join(folder.uri.fsPath, 'venv', 'bin', 'python'),
                path.join(folder.uri.fsPath, '.venv', 'bin', 'python'),
                path.join(folder.uri.fsPath, 'env', 'bin', 'python'),
                path.join(folder.uri.fsPath, 'venv', 'Scripts', 'python.exe'), // Windows
                path.join(folder.uri.fsPath, '.venv', 'Scripts', 'python.exe'),
            ];

            for (const venvPath of venvPaths) {
                try {
                    await fs.access(venvPath);
                    const version = await this.getPythonVersion(venvPath);
                    return {
                        path: venvPath,
                        type: 'venv',
                        version: version
                    };
                } catch {
                    // File doesn't exist, try next
                }
            }
        }

        return null;
    }

    /**
     * Get list of installed packages in the Python environment
     */
    public async getInstalledPackages(pythonPath: string): Promise<InstalledPackage[]> {
        const cacheKey = pythonPath;

        // Check cache first
        const cached = this.packageCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
            console.log(`[PackageDetector] Using cached package list (${cached.packages.length} packages)`);
            return cached.packages;
        }

        console.log(`[PackageDetector] Fetching installed packages from: ${pythonPath}`);

        try {
            // Use pip list --format json for reliable parsing
            const { stdout } = await execAsync(`"${pythonPath}" -m pip list --format json`, {
                timeout: 10000 // 10 second timeout
            });

            const packages: InstalledPackage[] = JSON.parse(stdout).map((pkg: any) => ({
                name: pkg.name.toLowerCase(),
                version: pkg.version,
                location: pkg.location
            }));

            console.log(`[PackageDetector] Found ${packages.length} installed packages`);

            // Cache the results
            this.packageCache.set(cacheKey, {
                packages: packages,
                timestamp: Date.now()
            });

            return packages;
        } catch (error) {
            console.error('[PackageDetector] Error fetching installed packages:', error);

            // Try alternative method: read site-packages directly
            return await this.getPackagesFromSitePackages(pythonPath);
        }
    }

    /**
     * Alternative method: read packages from site-packages directory
     */
    private async getPackagesFromSitePackages(pythonPath: string): Promise<InstalledPackage[]> {
        try {
            // Get site-packages location
            const { stdout } = await execAsync(`"${pythonPath}" -c "import site; print(site.getsitepackages()[0])"`);
            const sitePackagesPath = stdout.trim();

            const packages: InstalledPackage[] = [];
            const entries = await fs.readdir(sitePackagesPath);

            // Look for .dist-info directories
            for (const entry of entries) {
                if (entry.endsWith('.dist-info')) {
                    const packageName = entry.split('-')[0].toLowerCase();
                    const metadataPath = path.join(sitePackagesPath, entry, 'METADATA');

                    try {
                        const metadata = await fs.readFile(metadataPath, 'utf-8');
                        const versionMatch = metadata.match(/^Version:\s*(.+)$/m);

                        if (versionMatch) {
                            packages.push({
                                name: packageName,
                                version: versionMatch[1].trim(),
                                location: sitePackagesPath
                            });
                        }
                    } catch {
                        // Skip packages we can't read
                    }
                }
            }

            console.log(`[PackageDetector] Found ${packages.length} packages from site-packages`);
            return packages;
        } catch (error) {
            console.error('[PackageDetector] Error reading site-packages:', error);
            return [];
        }
    }

    /**
     * Check if a specific package is installed
     */
    public async isPackageInstalled(pythonPath: string, packageName: string): Promise<InstalledPackage | null> {
        const packages = await this.getInstalledPackages(pythonPath);
        return packages.find(pkg => pkg.name === packageName.toLowerCase()) || null;
    }

    /**
     * Get package version if installed
     */
    public async getPackageVersion(pythonPath: string, packageName: string): Promise<string | null> {
        const pkg = await this.isPackageInstalled(pythonPath, packageName);
        return pkg ? pkg.version : null;
    }

    /**
     * Clear package cache
     */
    public clearCache(): void {
        this.packageCache.clear();
        console.log('[PackageDetector] Package cache cleared');
    }

    /**
     * Get cache statistics
     */
    public getCacheStats(): { size: number; entries: string[] } {
        return {
            size: this.packageCache.size,
            entries: Array.from(this.packageCache.keys())
        };
    }
}
