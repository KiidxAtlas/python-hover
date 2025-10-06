/**
 * Custom Documentation Loader
 * Allows teams to add project-specific documentation
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface CustomDoc {
    symbol: string;
    description: string;
    example?: string;
    category?: string;
    tags?: string[];
    url?: string;
}

export interface CustomDocsConfig {
    version: string;
    docs: CustomDoc[];
}

export class CustomDocumentationLoader {
    private customDocs: Map<string, CustomDoc> = new Map();
    private configFiles = ['.python-hover.json', 'python-hover.json', '.vscode/python-hover.json'];

    /**
     * Load custom documentation from workspace
     */
    async loadCustomDocs(workspaceFolder?: vscode.WorkspaceFolder): Promise<void> {
        this.customDocs.clear();

        if (!workspaceFolder) {
            const folders = vscode.workspace.workspaceFolders;
            if (!folders || folders.length === 0) {
                return;
            }
            workspaceFolder = folders[0];
        }

        for (const configFile of this.configFiles) {
            const configPath = path.join(workspaceFolder.uri.fsPath, configFile);

            try {
                if (fs.existsSync(configPath)) {
                    const content = fs.readFileSync(configPath, 'utf-8');
                    const config: CustomDocsConfig = JSON.parse(content);

                    if (config.docs && Array.isArray(config.docs)) {
                        for (const doc of config.docs) {
                            this.customDocs.set(doc.symbol.toLowerCase(), doc);
                        }
                        console.log(`[PythonHover] Loaded ${config.docs.length} custom docs from ${configFile}`);
                        return; // Found config, stop searching
                    }
                }
            } catch (error) {
                console.error(`[PythonHover] Error loading custom docs from ${configFile}:`, error);
            }
        }
    }

    /**
     * Get custom documentation for a symbol
     */
    getCustomDoc(symbol: string): CustomDoc | null {
        return this.customDocs.get(symbol.toLowerCase()) || null;
    }

    /**
     * Check if custom docs are loaded
     */
    hasCustomDocs(): boolean {
        return this.customDocs.size > 0;
    }

    /**
     * Get all custom docs
     */
    getAllCustomDocs(): CustomDoc[] {
        return Array.from(this.customDocs.values());
    }

    /**
     * Create a sample configuration file
     */
    static createSampleConfig(): CustomDocsConfig {
        return {
            version: "1.0",
            docs: [
                {
                    symbol: "our_custom_decorator",
                    description: "Custom decorator used in our project for timing functions.",
                    example: `@our_custom_decorator
def my_function():
    # Your code here
    pass

# The decorator will automatically log execution time`,
                    category: "decorators",
                    tags: ["custom", "timing", "performance"]
                },
                {
                    symbol: "DatabaseConnection",
                    description: "Our custom database connection class with automatic retry logic.",
                    example: `from myproject import DatabaseConnection

# Create connection
db = DatabaseConnection(
    host='localhost',
    database='mydb',
    retry_count=3
)

# Use connection
with db.connection() as conn:
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users")
    results = cursor.fetchall()`,
                    category: "database",
                    tags: ["custom", "database", "connection"],
                    url: "https://internal-docs.company.com/database"
                }
            ]
        };
    }

    /**
     * Create a sample config file in workspace
     */
    static async createSampleConfigFile(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
        const configPath = path.join(workspaceFolder.uri.fsPath, '.python-hover.json');
        const sampleConfig = CustomDocumentationLoader.createSampleConfig();

        fs.writeFileSync(configPath, JSON.stringify(sampleConfig, null, 2), 'utf-8');

        const doc = await vscode.workspace.openTextDocument(configPath);
        await vscode.window.showTextDocument(doc);
    }
}

/**
 * Format custom documentation for display
 */
export function formatCustomDoc(doc: CustomDoc): string {
    const parts: string[] = [];

    parts.push(`### 📝 ${doc.symbol}`);

    if (doc.category) {
        parts.push(`**Category:** ${doc.category}`);
    }

    parts.push(`\n${doc.description}`);

    if (doc.example) {
        parts.push(`\n**Example:**\n\`\`\`python\n${doc.example}\n\`\`\``);
    }

    if (doc.tags && doc.tags.length > 0) {
        parts.push(`\n**Tags:** ${doc.tags.map(t => `\`${t}\``).join(', ')}`);
    }

    if (doc.url) {
        parts.push(`\n📚 [Documentation](${doc.url})`);
    }

    parts.push(`\n---\n*Custom documentation from project*`);

    return parts.join('\n');
}
