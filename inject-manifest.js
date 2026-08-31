const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const manifestFileName = 'manifest.json';

function getDepth(filePath) {
    const relativePath = path.relative(rootDir, filePath);
    const depth = relativePath.split(path.sep).length - 1;
    return depth;
}

function processHtmlFiles(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        // Skip node_modules, .git, etc
        if (stat.isDirectory()) {
            if (!['node_modules', '.git', 'dwd-next'].includes(file)) {
                processHtmlFiles(fullPath);
            }
        } else if (file.endsWith('.html')) {
            injectManifest(fullPath);
        }
    }
}

function injectManifest(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Check if it already has manifest
    if (content.includes('rel="manifest"') || content.includes("rel='manifest'")) {
        // console.log(`[SKIP] Already contains manifest: ${filePath}`);
        return;
    }

    const depth = getDepth(filePath);
    const prefix = depth === 0 ? './' : '../'.repeat(depth);
    const manifestLink = `<link rel="manifest" href="${prefix}${manifestFileName}">`;

    // Attempt to insert before </head> or <head>
    if (content.includes('</head>')) {
        content = content.replace('</head>', `    ${manifestLink}\n</head>`);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`[INJECTED] ${manifestLink} -> ${path.relative(rootDir, filePath)}`);
    } else {
        console.log(`[WARN] No </head> found in ${filePath}`);
    }
}

console.log('Starting PWA Manifest Injection...');
processHtmlFiles(rootDir);
console.log('Injection complete.');
