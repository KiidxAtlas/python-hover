#!/usr/bin/env node
/**
 * Script to replace console.* calls with Logger calls in all source files
 * Run with: node scripts/replace-all-console-logging.js
 */

const fs = require('fs');
const path = require('path');

// Files to process with their logging strategy
const FILES_TO_PROCESS = [
    { file: 'src/symbolResolver.ts', strategy: 'static' },      // Use Logger.getInstance()
    { file: 'src/hoverProvider.ts', strategy: 'instance' },     // Pass via constructor
    { file: 'src/documentationFetcher.ts', strategy: 'instance' },
    { file: 'src/packageDetector.ts', strategy: 'instance' },
    { file: 'src/cache.ts', strategy: 'instance' },
    { file: 'src/versionDetector.ts', strategy: 'instance' },
    { file: 'src/extension.ts', strategy: 'static' },           // Already has logger
    { file: 'src/contextDetector.ts', strategy: 'static' },     // Utility function
    { file: 'src/customDocumentation.ts', strategy: 'static' }, // Utility function
    { file: 'src/thirdPartyLibraries.ts', strategy: 'static' }, // Utility function
    { file: 'src/methodResolver.ts', strategy: 'static' },      // Utility function
];

let totalReplacements = 0;
let filesUpdated = 0;

FILES_TO_PROCESS.forEach(({ file, strategy }) => {
    const filePath = path.join(__dirname, '..', file);
    
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  Skipping ${file} (not found)`);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let replacements = 0;
    const originalContent = content;

    // Determine logger reference based on strategy
    const loggerRef = strategy === 'static' ? 'Logger.getInstance()' : 'this.logger';
    const debugCall = strategy === 'static' ? 'Logger.getInstance().debug' : 'this.logger.debug';
    const infoCall = strategy === 'static' ? 'Logger.getInstance().info' : 'this.logger.info';
    const warnCall = strategy === 'static' ? 'Logger.getInstance().warn' : 'this.logger.warn';
    const errorCall = strategy === 'static' ? 'Logger.getInstance().error' : 'this.logger.error';

    // Pattern 1: console.log(`[PythonHover] message`) → logger.debug(`message`)
    content = content.replace(
        /console\.log\(`\[PythonHover\] ([^`]+)`\)/g,
        (match, message) => {
            replacements++;
            return `${debugCall}(\`${message}\`)`;
        }
    );

    // Pattern 2: console.log(`[SymbolResolver] message`) → logger.debug(`message`)
    content = content.replace(
        /console\.log\(`\[SymbolResolver\] ([^`]+)`\)/g,
        (match, message) => {
            replacements++;
            return `${debugCall}(\`${message}\`)`;
        }
    );

    // Pattern 3: console.log(`[PackageDetector] message`) → logger.debug(`message`)
    content = content.replace(
        /console\.log\(`\[PackageDetector\] ([^`]+)`\)/g,
        (match, message) => {
            replacements++;
            return `${debugCall}(\`${message}\`)`;
        }
    );

    // Pattern 4: console.log(`[MethodResolver] message`) → logger.debug(`message`)
    content = content.replace(
        /console\.log\(`\[MethodResolver\] ([^`]+)`\)/g,
        (match, message) => {
            replacements++;
            return `${debugCall}(\`${message}\`)`;
        }
    );

    // Pattern 5: console.log(`[VersionDetector] message`) → logger.debug(`message`)
    content = content.replace(
        /console\.log\(`\[VersionDetector\] ([^`]+)`\)/g,
        (match, message) => {
            replacements++;
            return `${debugCall}(\`${message}\`)`;
        }
    );

    // Pattern 6: console.log with template literals (no prefix) → logger.debug
    content = content.replace(
        /console\.log\((`[^`]+`)\)/g,
        (match, message) => {
            replacements++;
            return `${debugCall}(${message})`;
        }
    );

    // Pattern 7: console.log with string concat or multiple params
    content = content.replace(
        /console\.log\(\s*['"`]([^'"`]+)['"`]\s*,\s*([^)]+)\)/g,
        (match, message, args) => {
            replacements++;
            return `${debugCall}(\`${message}\`, ${args})`;
        }
    );

    // Pattern 8: console.warn(`[PythonHover] message`) → logger.warn(`message`)
    content = content.replace(
        /console\.warn\(`\[PythonHover\] ([^`]+)`\)/g,
        (match, message) => {
            replacements++;
            return `${warnCall}(\`${message}\`)`;
        }
    );

    // Pattern 9: console.warn(`[PackageDetector] message`) → logger.warn(`message`)
    content = content.replace(
        /console\.warn\(`\[PackageDetector\] ([^`]+)`\)/g,
        (match, message) => {
            replacements++;
            return `${warnCall}(\`${message}\`)`;
        }
    );

    // Pattern 10: console.error(`[PythonHover] message`, error) → logger.error(`message`, error)
    content = content.replace(
        /console\.error\(`\[PythonHover\] ([^`]+)`, (error)\)/g,
        (match, message, errorVar) => {
            replacements++;
            return `${errorCall}(\`${message}\`, ${errorVar} as Error)`;
        }
    );

    // Pattern 11: console.error(`[PythonHover] message:`, error) → logger.error(`message`, error)
    content = content.replace(
        /console\.error\(`\[PythonHover\] ([^:]+):`, (error)\)/g,
        (match, message, errorVar) => {
            replacements++;
            return `${errorCall}(\`${message}\`, ${errorVar} as Error)`;
        }
    );

    // Pattern 12: console.error(`[PackageDetector] message:`, error) → logger.error(`message`, error)
    content = content.replace(
        /console\.error\(\s*['"`]\[PackageDetector\] ([^:'"]+):?['"`]\s*,\s*(error)\s*\)/g,
        (match, message, errorVar) => {
            replacements++;
            return `${errorCall}(\`${message}\`, ${errorVar} as Error)`;
        }
    );

    // Pattern 13: console.error(`[VersionDetector] message:`, error) → logger.error(`message`, error)
    content = content.replace(
        /console\.error\(\s*['"`]\[VersionDetector\] ([^:'"]+):?['"`]\s*,\s*(error)\s*\)/g,
        (match, message, errorVar) => {
            replacements++;
            return `${errorCall}(\`${message}\`, ${errorVar} as Error)`;
        }
    );

    // Pattern 14: console.error with no error object
    content = content.replace(
        /console\.error\((`[^`]+`)\)/g,
        (match, message) => {
            replacements++;
            return `${errorCall}(${message})`;
        }
    );

    // Pattern 15: console.error('Invalid regex pattern:', ...) - special case
    content = content.replace(
        /console\.error\(\s*['"`]([^'"]+)['"`]\s*,\s*([^,]+),\s*(error)\s*\)/g,
        (match, message, arg1, errorVar) => {
            replacements++;
            return `${errorCall}(\`${message} \${${arg1}}\`, ${errorVar} as Error)`;
        }
    );

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        filesUpdated++;
        totalReplacements += replacements;
        console.log(`✅ ${file}: ${replacements} replacements`);
    } else {
        console.log(`⚪ ${file}: No changes needed`);
    }
});

console.log('');
console.log('═══════════════════════════════════════════');
console.log(`✅ Replaced ${totalReplacements} console.* calls`);
console.log(`📝 Updated ${filesUpdated} files`);
console.log('═══════════════════════════════════════════');
