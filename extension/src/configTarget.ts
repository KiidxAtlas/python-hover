import * as vscode from 'vscode';

function getSettingsResource(): vscode.Uri | undefined {
    return vscode.window.activeTextEditor?.document.uri ?? vscode.workspace.workspaceFolders?.[0]?.uri;
}

export async function updateSettingWithPreferredTarget(
    section: string,
    key: string,
    value: boolean | string | number,
): Promise<void> {
    const resource = getSettingsResource();
    const scopedConfig = vscode.workspace.getConfiguration(section, resource);
    const inspect = scopedConfig.inspect(key) ?? vscode.workspace.getConfiguration(section).inspect(key);

    if (inspect?.workspaceFolderValue !== undefined && resource && vscode.workspace.getWorkspaceFolder(resource)) {
        await scopedConfig.update(key, value, vscode.ConfigurationTarget.WorkspaceFolder);
        return;
    }

    if (inspect?.workspaceValue !== undefined) {
        await scopedConfig.update(key, value, vscode.ConfigurationTarget.Workspace);
        return;
    }

    if (inspect?.globalValue !== undefined) {
        await scopedConfig.update(key, value, vscode.ConfigurationTarget.Global);
        return;
    }

    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        await scopedConfig.update(key, value, vscode.ConfigurationTarget.Workspace);
        return;
    }

    await scopedConfig.update(key, value, vscode.ConfigurationTarget.Global);
}
