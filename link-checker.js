const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const excludeDirs = ['node_modules', 'dwd-next', '.git'];

function getFiles(dir, ext) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            if (!excludeDirs.some(ex => file.includes(ex))) {
                results = results.concat(getFiles(file, ext));
            }
        } else {
            if (file.endsWith(ext)) results.push(file);
        }
    });
    return results;
}

const htmlFiles = getFiles(rootDir, '.html');
let brokenLinks = [];

htmlFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const linkRegex = /(?:href|src)="([^"]+)"/g;
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
        let link = match[1];
        if (link.startsWith('http') || link.startsWith('mailto:') || link.startsWith('tel:') || link.startsWith('#') || link.startsWith('data:')) continue;
        
        let targetPath;
        if (link.startsWith('/')) {
            targetPath = path.join(rootDir, link);
        } else {
            targetPath = path.resolve(path.dirname(file), link);
        }
        
        targetPath = targetPath.split('?')[0].split('#')[0];
        
        if (!fs.existsSync(targetPath)) {
            brokenLinks.push(`[${path.basename(file)}] -> ${link}`);
        }
    }
});

if (brokenLinks.length > 0) {
    console.log(`Found ${brokenLinks.length} broken links:`);
    brokenLinks.slice(0, 30).forEach(l => console.log(l));
} else {
    console.log("All local links are valid!");
}
