import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

export interface CacheEntry<T> {
    data: T;
    timestamp: number;
    etag?: string;
    lastModified?: string;
}

export class CacheManager {
    private cacheDir: string;

    constructor(globalStorageUri: vscode.Uri) {
        this.cacheDir = path.join(globalStorageUri.fsPath, 'python-hover-cache');
    }

    private async ensureCacheDir(): Promise<void> {
        try {
            await fs.mkdir(this.cacheDir, { recursive: true });
        } catch (error) {
            // Directory might already exist
        }
    }

    private getCacheFilePath(key: string): string {
        // Sanitize key for file system
        const sanitized = key.replace(/[^a-zA-Z0-9.-]/g, '_');
        return path.join(this.cacheDir, `${sanitized}.json`);
    }

    public async get<T>(key: string): Promise<CacheEntry<T> | null> {
        try {
            const filePath = this.getCacheFilePath(key);
            const content = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(content) as CacheEntry<T>;
        } catch (error) {
            return null;
        }
    }

    public async set<T>(
        key: string,
        data: T,
        etag?: string,
        lastModified?: string
    ): Promise<void> {
        await this.ensureCacheDir();

        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now(),
            etag,
            lastModified
        };

        const filePath = this.getCacheFilePath(key);
        await fs.writeFile(filePath, JSON.stringify(entry, null, 2));
    }

    public async isExpired(key: string, maxAgeMs: number): Promise<boolean> {
        const entry = await this.get(key);
        if (!entry) {
            return true;
        }

        return Date.now() - entry.timestamp > maxAgeMs;
    }

    public async delete(key: string): Promise<void> {
        try {
            const filePath = this.getCacheFilePath(key);
            await fs.unlink(filePath);
        } catch (error) {
            // File might not exist
        }
    }

    public async clear(): Promise<{ filesDeleted: number; success: boolean }> {
        try {
            console.log(`[PythonHover] Clearing cache directory: ${this.cacheDir}`);
            const files = await fs.readdir(this.cacheDir);
            console.log(`[PythonHover] Found ${files.length} cache files to delete:`, files);

            if (files.length === 0) {
                console.log(`[PythonHover] No cache files to delete`);
                return { filesDeleted: 0, success: true };
            }

            await Promise.all(
                files.map(async file => {
                    const filePath = path.join(this.cacheDir, file);
                    console.log(`[PythonHover] Deleting cache file: ${filePath}`);
                    return fs.unlink(filePath);
                })
            );
            console.log(`[PythonHover] Successfully deleted ${files.length} cache files`);
            return { filesDeleted: files.length, success: true };
        } catch (error) {
            console.error(`[PythonHover] Error clearing cache:`, error);
            // Directory might not exist - this is not necessarily an error
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                console.log(`[PythonHover] Cache directory does not exist, nothing to clear`);
                return { filesDeleted: 0, success: true };
            }
            return { filesDeleted: 0, success: false };
        }
    }

    public async getStats(): Promise<{
        fileCount: number;
        totalSize: number;
        cacheDir: string;
    }> {
        try {
            await this.ensureCacheDir();
            const files = await fs.readdir(this.cacheDir);
            let totalSize = 0;

            for (const file of files) {
                try {
                    const filePath = path.join(this.cacheDir, file);
                    const stats = await fs.stat(filePath);
                    totalSize += stats.size;
                } catch (error) {
                    // Skip files that can't be read
                }
            }

            return {
                fileCount: files.length,
                totalSize,
                cacheDir: this.cacheDir
            };
        } catch (error) {
            return {
                fileCount: 0,
                totalSize: 0,
                cacheDir: this.cacheDir
            };
        }
    }

    // Helper methods for common cache duration calculations
    public static daysToMs(days: number): number {
        return days * 24 * 60 * 60 * 1000;
    }

    public static hoursToMs(hours: number): number {
        return hours * 60 * 60 * 1000;
    }
}
