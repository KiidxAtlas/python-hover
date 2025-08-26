"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheManager = void 0;
const fs = require("fs/promises");
const path = require("path");
class CacheManager {
    constructor(globalStorageUri) {
        this.cacheDir = path.join(globalStorageUri.fsPath, 'python-hover-cache');
    }
    async ensureCacheDir() {
        try {
            await fs.mkdir(this.cacheDir, { recursive: true });
        }
        catch (error) {
            // Directory might already exist
        }
    }
    getCacheFilePath(key) {
        // Sanitize key for file system
        const sanitized = key.replace(/[^a-zA-Z0-9.-]/g, '_');
        return path.join(this.cacheDir, `${sanitized}.json`);
    }
    async get(key) {
        try {
            const filePath = this.getCacheFilePath(key);
            const content = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(content);
        }
        catch (error) {
            return null;
        }
    }
    async set(key, data, etag, lastModified) {
        await this.ensureCacheDir();
        const entry = {
            data,
            timestamp: Date.now(),
            etag,
            lastModified
        };
        const filePath = this.getCacheFilePath(key);
        await fs.writeFile(filePath, JSON.stringify(entry, null, 2));
    }
    async isExpired(key, maxAgeMs) {
        const entry = await this.get(key);
        if (!entry) {
            return true;
        }
        return Date.now() - entry.timestamp > maxAgeMs;
    }
    async delete(key) {
        try {
            const filePath = this.getCacheFilePath(key);
            await fs.unlink(filePath);
        }
        catch (error) {
            // File might not exist
        }
    }
    async clear() {
        try {
            console.log(`[PythonHover] Clearing cache directory: ${this.cacheDir}`);
            const files = await fs.readdir(this.cacheDir);
            console.log(`[PythonHover] Found ${files.length} cache files to delete:`, files);
            if (files.length === 0) {
                console.log(`[PythonHover] No cache files to delete`);
                return { filesDeleted: 0, success: true };
            }
            await Promise.all(files.map(async (file) => {
                const filePath = path.join(this.cacheDir, file);
                console.log(`[PythonHover] Deleting cache file: ${filePath}`);
                return fs.unlink(filePath);
            }));
            console.log(`[PythonHover] Successfully deleted ${files.length} cache files`);
            return { filesDeleted: files.length, success: true };
        }
        catch (error) {
            console.error(`[PythonHover] Error clearing cache:`, error);
            // Directory might not exist - this is not necessarily an error
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                console.log(`[PythonHover] Cache directory does not exist, nothing to clear`);
                return { filesDeleted: 0, success: true };
            }
            return { filesDeleted: 0, success: false };
        }
    }
    // Helper methods for common cache duration calculations
    static daysToMs(days) {
        return days * 24 * 60 * 60 * 1000;
    }
    static hoursToMs(hours) {
        return hours * 60 * 60 * 1000;
    }
}
exports.CacheManager = CacheManager;
//# sourceMappingURL=cache.js.map