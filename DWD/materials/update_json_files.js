const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, 'json-lecture-files');

function crawl(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            crawl(filePath);
        } else if (file.endsWith('.json')) {
            updateJsonFile(filePath);
        }
    }
}

function updateJsonFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(content);

        let modified = false;

        if (!json.hasOwnProperty('audio')) {
            json.audio = "";
            modified = true;
        }

        if (!json.hasOwnProperty('video')) {
            json.video = "";
            modified = true;
        }

        if (modified) {
            fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf8');
            // console.log(`Updated: ${filePath}`);  [Security Fix]
        } else {
            // console.log(`Skipped (already up to date): ${filePath}`);  [Security Fix]
        }

    } catch (err) {
        console.error(`Error updating ${filePath}:`, err.message);
    }
}

// console.log(`Scanning directory: ${rootDir}`);  [Security Fix]
if (fs.existsSync(rootDir)) {
    crawl(rootDir);
    // console.log("Done.");  [Security Fix]
} else {
    console.error(`Directory not found: ${rootDir}`);
}
