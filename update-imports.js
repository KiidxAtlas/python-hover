#!/usr/bin/env node

/**
 * Automated Import Path Updater
 * Updates all import paths after file structure refactoring
 */

const fs = require('fs');
const path = require('path');

function getRelativePath(from, to) {
    const fromParts = from.split('/');
    const toParts = to.split('/');

    // Remove filename from from path
    fromParts.pop();

    // Find common base
    let commonLength = 0;
    while (commonLength < fromParts.length &&
        commonLength < toParts.length &&
        fromParts[commonLength] === toParts[commonLength]) {
        commonLength++;
    }

    // Build relative path
    const upLevels = fromParts.length - commonLength;
    const downPath = toParts.slice(commonLength);

    let relativePath = '';
    if (upLevels > 0) {
        relativePath = Array(upLevels).fill('..').join('/');
    } else {
        relativePath = '.';
    }

    if (downPath.length > 0) {
        relativePath += '/' + downPath.join('/');
    }

    return relativePath;
}

// Map of module names to their new locations
const moduleLocations = {
    // Data files
    'staticExamples': 'src/data/staticExamples.ts',
    'enhancedExamples': 'src/data/enhancedExamples.ts',
    'specialMethods': 'src/data/specialMethods.ts',
    'typingConstructs': 'src/data/typingConstructs.ts',
    'documentationUrls': 'src/data/documentationUrls.ts',

    // Services
    'cache': 'src/services/cache.ts',
    'config': 'src/services/config.ts',
    'logger': 'src/services/logger.ts',
    'inventory': 'src/services/inventory.ts',
    'packageDetector': 'src/services/packageDetector.ts',
    'errorNotifier': 'src/services/errorNotifier.ts',
    'typeDetectionService': 'src/services/typeDetectionService.ts',

    // Resolvers
    'symbolResolver': 'src/resolvers/symbolResolver.ts',
    'methodResolver': 'src/resolvers/methodResolver.ts',
    'contextDetector': 'src/resolvers/contextDetector.ts',

    // Documentation
    'documentationFetcher': 'src/documentation/documentationFetcher.ts',
    'customDocumentation': 'src/documentation/customDocumentation.ts',
    'thirdPartyLibraries': 'src/documentation/thirdPartyLibraries.ts',
    'exampleEnricher': 'src/documentation/exampleEnricher.ts',

    // UI
    'hoverProvider': 'src/ui/hoverProvider.ts',
    'hoverTheme': 'src/ui/hoverTheme.ts',
    'smartSuggestions': 'src/ui/smartSuggestions.ts',
    'versionComparison': 'src/ui/versionComparison.ts',
    'versionDetector': 'src/ui/versionDetector.ts',

    // Utils
    'fetchWithTimeout': 'src/utils/fetchWithTimeout.ts',
    'urlValidator': 'src/utils/urlValidator.ts',

    // Root files
    'types': 'src/types.ts',
};

function updateImportsInFile(filePath, projectRoot) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Get relative path from project root
    const relativeFilePath = filePath.replace(projectRoot + '/', '');

    // Match import statements
    const importRegex = /from\s+['"](\.[^'"]+)['"]/g;

    content = content.replace(importRegex, (match, importPath) => {
        // Extract module name from import path
        const moduleName = importPath.replace(/^\.\//, '').replace(/^\.\.\//, '').replace(/\.\.\//g, '');

        // Check if this module has been moved
        if (moduleLocations[moduleName]) {
            const newLocation = moduleLocations[moduleName];
            const newRelativePath = getRelativePath(relativeFilePath, newLocation).replace('.ts', '');

            if (newRelativePath !== importPath) {
                modified = true;
                return `from '${newRelativePath}'`;
            }
        }

        return match;
    });

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✓ Updated: ${relativeFilePath}`);
        return 1;
    }

    return 0;
}

function findTypeScriptFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            if (!file.startsWith('.') && file !== 'node_modules' && file !== 'test') {
                findTypeScriptFiles(filePath, fileList);
            }
        } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
            fileList.push(filePath);
        }
    });

    return fileList;
}

// Main execution
const projectRoot = __dirname;
const srcDir = path.join(projectRoot, 'src');
console.log('🔄 Updating import paths after refactoring...\n');

const tsFiles = findTypeScriptFiles(srcDir);
let updatedCount = 0;

tsFiles.forEach(file => {
    updatedCount += updateImportsInFile(file, projectRoot);
});

console.log(`\n✅ Complete! Updated ${updatedCount} file(s).`);
console.log('\n🔨 Run "npm run compile" to verify changes.');
