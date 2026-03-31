import * as vscode from 'vscode';

function getSettingsResource(): vscode.Uri | undefined {
    const activeResource = vscode.window.activeTextEditor?.document.uri;
    if (activeResource) {
        const folder = vscode.workspace.getWorkspaceFolder(activeResource);
        return folder?.uri ?? activeResource;
    }

    return vscode.workspace.workspaceFolders?.[0]?.uri;
}

function isUnsupportedTargetError(error: unknown): boolean {
    return error instanceof Error
        && /does not support the (folder resource|workspace) scope/i.test(error.message);
}

export async function updateSettingWithPreferredTarget(
    section: string,
    key: string,
    value: boolean | string | number,
): Promise<void> {
    const resource = getSettingsResource();
    const scopedConfig = vscode.workspace.getConfiguration(section, resource);
    const inspect = scopedConfig.inspect(key) ?? vscode.workspace.getConfiguration(section).inspect(key);
    const hasWorkspaceFolder = !!(resource && vscode.workspace.getWorkspaceFolder(resource));
    const candidateTargets: vscode.ConfigurationTarget[] = [];

    if (inspect?.workspaceFolderValue !== undefined && hasWorkspaceFolder) {
        candidateTargets.push(vscode.ConfigurationTarget.WorkspaceFolder);
    }

    if (inspect?.workspaceValue !== undefined) {
        candidateTargets.push(vscode.ConfigurationTarget.Workspace);
    }

    if (inspect?.globalValue !== undefined) {
        candidateTargets.push(vscode.ConfigurationTarget.Global);
    }

    if (candidateTargets.length === 0) {
        if (hasWorkspaceFolder) {
            candidateTargets.push(vscode.ConfigurationTarget.WorkspaceFolder);
        }
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            candidateTargets.push(vscode.ConfigurationTarget.Workspace);
        }
        candidateTargets.push(vscode.ConfigurationTarget.Global);
    }

    const attempted = new Set<vscode.ConfigurationTarget>();
    for (const target of candidateTargets) {
        if (attempted.has(target)) {
            continue;
        }
        attempted.add(target);

        try {
            await scopedConfig.update(key, value, target);
            return;
        } catch (error) {
            if (isUnsupportedTargetError(error)) {
                continue;
            }
            throw error;
        }
    }

    await scopedConfig.update(key, value, vscode.ConfigurationTarget.Global);
}
