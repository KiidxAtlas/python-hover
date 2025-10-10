#!/usr/bin/env node
/**
 * Script to replace console.* calls with this.logger.* calls in inventory.ts
 * Run with: node scripts/replace-console-logging.js
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/inventory.ts');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Track replacements
let replacements = 0;

// Replace patterns:
// 1. console.log with debug logging (most are debug level)
// 2. console.warn with logger.warn
// 3. console.error with logger.error

// Pattern 1: console.log(`[PythonHover] message`) → this.logger.debug(`message`)
content = content.replace(
    /console\.log\(`\[PythonHover\] ([^`]+)`\)/g,
    (match, message) => {
        replacements++;
        return `this.logger.debug(\`${message}\`)`;
    }
);

// Pattern 2: console.log with template literals (no prefix)
content = content.replace(
    /console\.log\((`[^`]+`)\)/g,
    (match, message) => {
        replacements++;
        return `this.logger.debug(${message})`;
    }
);

// Pattern 3: console.warn(`[PythonHover] message`) → this.logger.warn(`message`)
content = content.replace(
    /console\.warn\(`\[PythonHover\] ([^`]+)`\)/g,
    (match, message) => {
        replacements++;
        return `this.logger.warn(\`${message}\`)`;
    }
);

// Pattern 4: console.error(`[PythonHover] message`, error) → this.logger.error(`message`, error)
content = content.replace(
    /console\.error\(`\[PythonHover\] ([^`]+)`, (error)\)/g,
    (match, message, errorVar) => {
        replacements++;
        return `this.logger.error(\`${message}\`, ${errorVar} as Error)`;
    }
);

// Pattern 5: console.error(`[PythonHover] message:`, error) → this.logger.error(`message`, error)
content = content.replace(
    /console\.error\(`\[PythonHover\] ([^:]+):`, (error)\)/g,
    (match, message, errorVar) => {
        replacements++;
        return `this.logger.error(\`${message}\`, ${errorVar} as Error)`;
    }
);

// Write the file back
fs.writeFileSync(filePath, content, 'utf8');

console.log(`✅ Replaced ${replacements} console.* calls in inventory.ts`);
console.log(`📝 File updated: ${filePath}`);
