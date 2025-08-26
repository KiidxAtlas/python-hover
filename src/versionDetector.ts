import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigurationManager } from './config';

export class VersionDetector {
    constructor(private configManager: ConfigurationManager) { }

    public async detectPythonVersion(): Promise<string> {
        const configVersion = this.configManager.docsVersion;

        // If explicitly set, use it
        if (configVersion !== 'auto') {
            return configVersion;
        }

        // Try different detection strategies
        const version =
            await this.getFromPythonExtension() ||
            await this.getFromProjectFiles() ||
            this.getDefaultVersion();

        return this.normalizePythonVersion(version);
    }

    private async getFromPythonExtension(): Promise<string | null> {
        try {
            // Try to get the active Python interpreter from the Python extension
            const pythonExt = vscode.extensions.getExtension('ms-python.python');
            if (pythonExt && pythonExt.isActive) {
                // This would require the Python extension API
                // For now, we'll return null and implement this later
                return null;
            }
        } catch (error) {
            // Python extension not available
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
