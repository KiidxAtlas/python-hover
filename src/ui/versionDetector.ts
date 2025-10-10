import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigurationManager } from '../services/config';
import { Logger } from '../services/logger';

export interface PythonVersionInfo {
    version: string;
    pythonPath?: string;
}

export class VersionDetector {
    private logger: Logger;

    constructor(private configManager: ConfigurationManager) {
        this.logger = Logger.getInstance();
    }

    public async detectPythonVersion(): Promise<string> {
        const info = await this.detectPythonVersionInfo();
        return info.version;
    }

    public async detectPythonVersionInfo(): Promise<PythonVersionInfo> {
        const configVersion = this.configManager.docsVersion;

        // If explicitly set, use it (but still try to get Python path)
        if (configVersion !== 'auto') {
            const pythonPath = await this.getPythonPath();
            return {
                version: configVersion,
                pythonPath: pythonPath || undefined
            };
        }

        // Try different detection strategies
        const pythonPath = await this.getPythonPath();
        const version =
            await this.getFromPythonExtension() ||
            await this.getFromProjectFiles() ||
            this.getDefaultVersion();

        return {
            version: this.normalizePythonVersion(version),
            pythonPath: pythonPath || undefined
        };
    }

    /**
     * Get the Python executable path
     */
    private async getPythonPath(): Promise<string | null> {
        try {
            const pythonExt = vscode.extensions.getExtension('ms-python.python');
            if (pythonExt) {
                if (!pythonExt.isActive) {
                    await pythonExt.activate();
                }

                const pythonPath = vscode.workspace.getConfiguration('python').get<string>('defaultInterpreterPath');
                if (pythonPath) {
                    return pythonPath;
                }
            }
        } catch (error) {
            this.logger.error(`Error getting Python path`, error as Error);
        }
        return null;
    }

    private async getFromPythonExtension(): Promise<string | null> {
        try {
            // Try to get the active Python interpreter from the Python extension
            const pythonExt = vscode.extensions.getExtension('ms-python.python');
            if (pythonExt) {
                if (!pythonExt.isActive) {
                    await pythonExt.activate();
                }

                // Try to get the environment path from the Python extension
                const pythonPath = vscode.workspace.getConfiguration('python').get<string>('defaultInterpreterPath');

                if (pythonPath) {
                    this.logger.debug(`Found Python interpreter path: ${pythonPath}`);
                    // Extract version from path (e.g., python3.11, python3.12)
                    const versionMatch = pythonPath.match(/python(\d+)\.(\d+)/i);
                    if (versionMatch) {
                        return `${versionMatch[1]}.${versionMatch[2]}`;
                    }
                }

                // Try getting from the Python extension API (if available)
                const pythonApi = pythonExt.exports;
                if (pythonApi && pythonApi.settings) {
                    const activeEnv = await pythonApi.settings.getExecutionDetails?.();
                    if (activeEnv?.execCommand) {
                        const cmd = Array.isArray(activeEnv.execCommand)
                            ? activeEnv.execCommand[0]
                            : activeEnv.execCommand;
                        const versionMatch = cmd.match(/python(\d+)\.(\d+)/i);
                        if (versionMatch) {
                            return `${versionMatch[1]}.${versionMatch[2]}`;
                        }
                    }
                }
            }
        } catch (error) {
            this.logger.debug(`Could not get version from Python extension`, error);
        }
        return null;
    }

    private async getFromProjectFiles(): Promise<string | null> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return null;
        }

        for (const folder of workspaceFolders) {
            const version =
                await this.checkPyprojectToml(folder.uri.fsPath) ||
                await this.checkPipfile(folder.uri.fsPath) ||
                await this.checkRuntimeTxt(folder.uri.fsPath);

            if (version) {
                return version;
            }
        }

        return null;
    }

    private async checkPyprojectToml(workspaceRoot: string): Promise<string | null> {
        try {
            const pyprojectPath = path.join(workspaceRoot, 'pyproject.toml');
            const content = await fs.readFile(pyprojectPath, 'utf-8');

            // Look for python version requirements
            const pythonVersionMatch = content.match(/python\s*=\s*"([^"]+)"/);
            if (pythonVersionMatch) {
                return this.extractVersionFromRange(pythonVersionMatch[1]);
            }

            // Look for requires-python in poetry or setuptools
            const requiresPythonMatch = content.match(/requires-python\s*=\s*"([^"]+)"/);
            if (requiresPythonMatch) {
                return this.extractVersionFromRange(requiresPythonMatch[1]);
            }
        } catch (error) {
            // File doesn't exist or can't be read
        }
        return null;
    }

    private async checkPipfile(workspaceRoot: string): Promise<string | null> {
        try {
            const pipfilePath = path.join(workspaceRoot, 'Pipfile');
            const content = await fs.readFile(pipfilePath, 'utf-8');

            const pythonVersionMatch = content.match(/python_version\s*=\s*"([^"]+)"/);
            if (pythonVersionMatch) {
                return pythonVersionMatch[1];
            }
        } catch (error) {
            // File doesn't exist or can't be read
        }
        return null;
    }

    private async checkRuntimeTxt(workspaceRoot: string): Promise<string | null> {
        try {
            const runtimePath = path.join(workspaceRoot, 'runtime.txt');
            const content = await fs.readFile(runtimePath, 'utf-8');

            const pythonVersionMatch = content.match(/python-(\d+\.\d+)/);
            if (pythonVersionMatch) {
                return pythonVersionMatch[1];
            }
        } catch (error) {
            // File doesn't exist or can't be read
        }
        return null;
    }

    private extractVersionFromRange(versionRange: string): string {
        // Extract version from ranges like ">=3.8,<4.0" or "^3.9"
        const match = versionRange.match(/(\d+\.\d+)/);
        return match ? match[1] : '3.12';
    }

    private normalizePythonVersion(version: string): string {
        // Ensure we have a major.minor format
        const match = version.match(/^(\d+)\.(\d+)/);
        if (match) {
            return `${match[1]}.${match[2]}`;
        }
        return '3.12'; // fallback
    }

    private getDefaultVersion(): string {
        // Default to latest stable Python version
        return '3.12';
    }

    public getSupportedVersions(): string[] {
        return ['3.8', '3.9', '3.10', '3.11', '3.12', '3.13'];
    }

    public isVersionSupported(version: string): boolean {
        return this.getSupportedVersions().includes(version);
    }
}
