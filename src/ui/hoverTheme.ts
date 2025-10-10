/**
 * Hover Theme System
 * Provides visual customization for hover tooltips
 */

import * as vscode from 'vscode';

export type FontSize = 'small' | 'medium' | 'large';

export interface ThemeConfig {
    fontSize: 'small' | 'medium' | 'large';
    showEmojis: boolean;
    showColors: boolean;
    showBorders: boolean;
}

export class HoverTheme {
    private config: ThemeConfig;

    constructor() {
        this.config = this.loadConfig();
    }

    private loadConfig(): ThemeConfig {
        const config = vscode.workspace.getConfiguration('pythonHover');
        return {
            fontSize: config.get<FontSize>('fontSize', 'medium'),
            showEmojis: config.get<boolean>('showEmojis', true),
            showColors: config.get<boolean>('showColors', true),
            showBorders: config.get<boolean>('showBorders', true)
        };
    }

    public refresh(): void {
        this.config = this.loadConfig();
    }

    public getConfig(): ThemeConfig {
        return { ...this.config };
    }

    /**
     * Create a themed markdown string
     */
    public createMarkdown(): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.supportHtml = true;
        md.supportThemeIcons = true;

        // Note: VS Code hover doesn't support custom CSS
        // We rely on markdown formatting and theme icons instead

        return md;
    }

    /**
     * Get emoji for symbol type
     */
    public getSymbolEmoji(type: string): string {
        if (!this.config.showEmojis) {
            return '';
        }

        const emojiMap: Record<string, string> = {
            'function': '🔧',
            'method': '⚙️',
            'class': '📦',
            'module': '📚',
            'keyword': '🔑',
            'builtin': '🐍',
            'exception': '⚠️',
            'constant': '💎',
            'variable': '📊',
            'typing': '🏷️',
            'decorator': '✨'
        };
        return emojiMap[type] || '📝';
    }

    /**
     * Get VS Code theme icon for symbol type
     */
    public getSymbolIcon(type: string): string {
        const iconMap: Record<string, string> = {
            'function': '$(symbol-function)',
            'method': '$(symbol-method)',
            'class': '$(symbol-class)',
            'module': '$(symbol-namespace)',
            'keyword': '$(symbol-keyword)',
            'builtin': '$(symbol-constant)',
            'exception': '$(error)',
            'constant': '$(symbol-constant)',
            'variable': '$(symbol-variable)',
            'typing': '$(symbol-interface)',
            'decorator': '$(symbol-event)'
        };
        return iconMap[type] || '$(symbol-misc)';
    }

    /**
     * Format header based on theme
     */
    public formatHeader(symbolName: string, symbolType: string): string {
        const icon = this.getSymbolIcon(symbolType);

        // Use only VS Code theme icon (not emoji) for clean look
        return `## ${icon} \`${symbolName}\`\n\n`;
    }    /**
     * Format section header
     */
    public formatSectionHeader(title: string, _icon?: string): string {
        // Map section types to VS Code theme icons
        const iconMap: Record<string, string> = {
            'Parameters': '$(symbol-parameter)',
            'Returns': '$(output)',
            'Example': '$(lightbulb)',
            'Signature': '$(code)',
            'Description': '$(book)',
            'Related': '$(link)',
            'Version': '$(info)'
        };

        // Use only VS Code theme icon (not emoji)
        const themeIcon = iconMap[title] || '$(chevron-right)';

        // Always use rich theme
        return `### ${themeIcon} ${title}\n\n`;
    }

    /**
     * Format divider/separator
     */
    public formatDivider(): string {
        if (!this.config.showBorders) {
            return '\n';
        }

        // Always use rich theme
        return '\n---\n\n';
    }

    /**
     * Format badge (for version info, etc.)
     */
    public formatBadge(text: string, type?: 'info' | 'success' | 'warning' | 'error'): string {
        // Use colored Unicode blocks for visual distinction
        if (this.config.showColors && type) {
            const colorMap: Record<string, string> = {
                'info': '🔵',      // Blue
                'success': '🟢',   // Green
                'warning': '🟡',   // Yellow
                'error': '🔴'      // Red
            };
            const colorIcon = colorMap[type] || '';
            return `${colorIcon} **\`${text}\`**`;
        }

        return `**\`${text}\`**`;
    }

    /**
     * Format code block
     */
    public formatCodeBlock(code: string, language: string = 'python'): string {
        return `\`\`\`${language}\n${code}\n\`\`\`\n\n`;
    }

    /**
     * Format link
     */
    public formatLink(text: string, url: string, icon?: string): string {
        // Use VS Code theme icon for links
        const linkIcon = icon || '$(link-external)';
        const displayIcon = this.config.showEmojis && icon ? icon : linkIcon;
        return `[${displayIcon} ${text}](${url})`;
    }

    /**
     * Format list item
     */
    public formatListItem(text: string, bullet?: string): string {
        // Use VS Code theme icons for bullets
        const bulletMap: Record<string, string> = {
            'required': '$(circle-filled)',
            'optional': '$(circle-outline)',
            'default': '$(chevron-right)'
        };

        const actualBullet = bullet && bulletMap[bullet]
            ? bulletMap[bullet]
            : (this.config.showEmojis && bullet ? bullet : '$(chevron-right)');

        return `${actualBullet} ${text}\n`;
    }

    /**
     * Format type hint
     */
    public formatTypeHint(type: string): string {
        const typeIcon = '$(symbol-interface)';
        const displayIcon = this.config.showEmojis ? `🏷️ ${typeIcon}` : typeIcon;
        return `${displayIcon} **Type:** \`${type}\``;
    }

    /**
     * Format a tip or note with blockquote
     */
    public formatTip(text: string, icon?: string): string {
        const tipIcon = icon || '💡';
        const displayIcon = this.config.showEmojis ? tipIcon : '';
        return `> ${displayIcon} **Tip:** ${text}\n\n`;
    }

    /**
     * Format a note with blockquote
     */
    public formatNote(text: string, icon?: string): string {
        const noteIcon = icon || '📝';
        const displayIcon = this.config.showEmojis ? noteIcon : '';
        return `> ${displayIcon} **Note:** ${text}\n\n`;
    }

    /**
     * Format a warning with blockquote
     */
    public formatWarning(text: string): string {
        const icon = this.config.showEmojis ? '⚠️' : '';
        return `> ${icon} **Warning:** ${text}\n\n`;
    }

    /**
     * Format action links (enhanced with icons)
     */
    public formatActionLinks(links: Array<{ text: string, url?: string, command?: string, icon?: string }>): string {
        const formattedLinks = links.map(link => {
            const icon = link.icon || '$(link)';
            if (link.command) {
                return `$(${icon.replace(/\$\(|\)/g, '')}) [${link.text}](${link.command})`;
            } else if (link.url) {
                return `$(link-external) [${link.text}](${link.url})`;
            }
            return `- ${link.text}`;
        });

        return formattedLinks.join(' · ') + '\n';
    }

    /**
     * Format a badge group (multiple badges in a row)
     */
    public formatBadgeGroup(badges: Array<{ text: string, type?: 'info' | 'success' | 'warning' | 'error' }>): string {
        const formattedBadges = badges.map(badge => this.formatBadge(badge.text, badge.type));
        return formattedBadges.join(' ') + '\n\n';
    }

    /**
     * Format a parameter list item
     */
    public formatParameter(name: string, description: string, required: boolean = true): string {
        const bullet = required ? 'required' : 'optional';
        const prefix = required ? '**Required:**' : '**Optional:**';
        return this.formatListItem(`${prefix} \`${name}\` — ${description}`, bullet);
    }

    /**
     * Format content with proper spacing
     */
    public formatContent(content: string): string {
        // Ensure consistent spacing - always end with double newline
        return content.trim() + '\n\n';
    }

    /**
     * Format a signature code block
     */
    public formatSignature(signature: string): string {
        return this.formatCodeBlock(signature, 'python');
    }

    /**
     * Format a parameter table (markdown table)
     */
    public formatParameterTable(params: Array<{
        name: string;
        type?: string;
        required?: boolean;
        description: string;
    }>): string {
        if (params.length === 0) {
            return '';
        }

        let table = '| Parameter | Type | Description |\n';
        table += '|-----------|------|-------------|\n';

        for (const param of params) {
            const nameDisplay = param.required !== false
                ? `\`${param.name}\` ✓`
                : `\`${param.name}\` ○`;
            const typeDisplay = param.type ? `\`${param.type}\`` : '—';
            const descDisplay = param.description || '—';

            table += `| ${nameDisplay} | ${typeDisplay} | ${descDisplay} |\n`;
        }

        return table + '\n';
    }

    /**
     * Format signature with prominent display
     */
    public formatSignatureBox(signature: string, symbolName: string): string {
        // Add section header
        let result = this.formatSectionHeader('Signature', '$(code)');

        // Add signature code block
        result += this.formatCodeBlock(signature, 'python');

        return result;
    }

    /**
     * Format deprecation warning with high visibility
     */
    public formatDeprecation(version: string, message: string, alternative?: string): string {
        const icon = this.config.showEmojis ? '⚠️' : '$(warning)';
        let result = `\n> ${icon} **DEPRECATED`;

        if (version) {
            result += ` (since ${version})`;
        }

        result += '**\n>\n';
        result += `> ${message}`;

        if (alternative) {
            result += `\n>\n> **Use instead:** \`${alternative}\``;
        }

        result += '\n\n';

        return result;
    }

    /**
     * Format return type with icon and description
     */
    public formatReturnType(returnType: string, description?: string): string {
        const icon = '$(output)';
        let result = `${icon} **Returns:** \`${returnType}\``;

        if (description) {
            result += ` — ${description}`;
        }

        return result + '\n\n';
    }

    /**
     * Format quick actions bar at top
     */
    public formatQuickActions(actions: Array<{
        text: string;
        icon: string;
        command?: string;
        url?: string;
    }>): string {
        const formattedActions = actions.map(action => {
            const icon = `$(${action.icon.replace(/\$\(|\)/g, '')})`;
            const target = action.command || action.url;
            return `[${icon} ${action.text}](${target})`;
        });

        return '🎯 ' + formattedActions.join(' · ') + '\n\n';
    }

    /**
     * Format See Also section with related symbols
     */
    public formatSeeAlso(related: Array<{
        name: string;
        description: string;
        type?: string;
    }>): string {
        if (related.length === 0) {
            return '';
        }

        let result = this.formatSectionHeader('See Also', '$(link)');

        for (const item of related) {
            const typeIcon = item.type ? this.getSymbolIcon(item.type) : '$(symbol-misc)';
            result += `- ${typeIcon} \`${item.name}\` — ${item.description}\n`;
        }

        return result + '\n';
    }

    /**
     * Format performance/complexity hint
     */
    public formatPerformance(complexity: string, note?: string): string {
        const icon = this.config.showEmojis ? '⚡' : '$(zap)';
        let result = `${icon} **Performance:** ${complexity}`;

        if (note) {
            result += ` — ${note}`;
        }

        return result + '\n\n';
    }

    /**
     * Format keyboard shortcut hint
     */
    public formatKeyboardHint(shortcuts: Array<{ keys: string; description: string }>): string {
        if (shortcuts.length === 0) {
            return '';
        }

        const icon = this.config.showEmojis ? '⌨️' : '$(keyboard)';
        const hints = shortcuts.map(s => `**${s.keys}**: ${s.description}`).join(' | ');

        return `\n---\n\n${icon} ${hints}\n`;
    }

    /**
     * Format content with smart truncation
     */
    public formatContentWithTruncation(content: string, maxLength: number, readMoreCommand?: string): string {
        if (content.length <= maxLength) {
            return this.formatContent(content);
        }

        // Find a good breaking point (end of sentence, paragraph)
        let truncated = content.substring(0, maxLength);
        const lastPeriod = truncated.lastIndexOf('. ');
        const lastNewline = truncated.lastIndexOf('\n');

        const breakPoint = Math.max(lastPeriod, lastNewline);
        if (breakPoint > maxLength * 0.7) {
            truncated = content.substring(0, breakPoint + 1);
        }

        let result = truncated.trim();

        if (readMoreCommand) {
            result += ` [...read more](${readMoreCommand})`;
        } else {
            result += ' [...]';
        }

        return this.formatContent(result);
    }
}
