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
}
