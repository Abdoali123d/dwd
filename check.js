const fs = require('fs');
const html = fs.readFileSync('DWD/schedule/professor.html', 'utf8');
const regex = /<script>([\s\S]*?)<\/script>/g;
let match;
let i = 1;
while ((match = regex.exec(html)) !== null) {
  try {
    // new Function wrapper expects a function body. If the script contains top-level 'await' or is just a function declaration, it might not throw but it's a basic check.
    new Function(match[1]);
  } catch (e) {
    console.error(`Syntax error in script block ${i} at index ${match.index}:`, e);
    // Ignore top-level await errors which are expected in module/some environments
    if (!e.message.includes("await")) {
      process.exit(1);
    }
  }
  i++;
}
console.log("Syntax checks passed");
