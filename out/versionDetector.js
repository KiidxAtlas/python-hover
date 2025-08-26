"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionDetector = void 0;
const fs = require("fs/promises");
const path = require("path");
const vscode = require("vscode");
class VersionDetector {
    constructor(configManager) {
        this.configManager = configManager;
    }
    async detectPythonVersion() {
        const configVersion = this.configManager.docsVersion;
        // If explicitly set, use it
        if (configVersion !== 'auto') {
            return configVersion;
        }
        // Try different detection strategies
        const version = await this.getFromPythonExtension() ||
            await this.getFromProjectFiles() ||
            this.getDefaultVersion();
        return this.normalizePythonVersion(version);
    }
    async getFromPythonExtension() {
        try {
            // Try to get the active Python interpreter from the Python extension
            const pythonExt = vscode.extensions.getExtension('ms-python.python');
            if (pythonExt && pythonExt.isActive) {
                // This would require the Python extension API
                // For now, we'll return null and implement this later
                return null;
            }
        }
        catch (error) {
            // Python extension not available
        }
        return null;
    }
    async getFromProjectFiles() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return null;
        }
        for (const folder of workspaceFolders) {
            const version = await this.checkPyprojectToml(folder.uri.fsPath) ||
                await this.checkPipfile(folder.uri.fsPath) ||
                await this.checkRuntimeTxt(folder.uri.fsPath);
            if (version) {
                return version;
            }
        }
        return null;
    }
    async checkPyprojectToml(workspaceRoot) {
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
        }
        catch (error) {
            // File doesn't exist or can't be read
        }
        return null;
    }
    async checkPipfile(workspaceRoot) {
        try {
            const pipfilePath = path.join(workspaceRoot, 'Pipfile');
            const content = await fs.readFile(pipfilePath, 'utf-8');
            const pythonVersionMatch = content.match(/python_version\s*=\s*"([^"]+)"/);
            if (pythonVersionMatch) {
                return pythonVersionMatch[1];
            }
        }
        catch (error) {
            // File doesn't exist or can't be read
        }
        return null;
    }
    async checkRuntimeTxt(workspaceRoot) {
        try {
            const runtimePath = path.join(workspaceRoot, 'runtime.txt');
            const content = await fs.readFile(runtimePath, 'utf-8');
            const pythonVersionMatch = content.match(/python-(\d+\.\d+)/);
            if (pythonVersionMatch) {
                return pythonVersionMatch[1];
            }
        }
        catch (error) {
            // File doesn't exist or can't be read
        }
        return null;
    }
    extractVersionFromRange(versionRange) {
        // Extract version from ranges like ">=3.8,<4.0" or "^3.9"
        const match = versionRange.match(/(\d+\.\d+)/);
        return match ? match[1] : '3.12';
    }
    normalizePythonVersion(version) {
        // Ensure we have a major.minor format
        const match = version.match(/^(\d+)\.(\d+)/);
        if (match) {
            return `${match[1]}.${match[2]}`;
        }
        return '3.12'; // fallback
    }
    getDefaultVersion() {
        // Default to latest stable Python version
        return '3.12';
    }
    getSupportedVersions() {
        return ['3.8', '3.9', '3.10', '3.11', '3.12', '3.13'];
    }
    isVersionSupported(version) {
        return this.getSupportedVersions().includes(version);
    }
}
exports.VersionDetector = VersionDetector;
//# sourceMappingURL=versionDetector.js.map