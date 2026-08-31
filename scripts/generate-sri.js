#!/usr/bin/env node
/**
 * SRI Hash Generator
 * 
 * Generates Subresource Integrity (SRI) hashes for CDN scripts.
 * Run this script before building to generate integrity hashes.
 * 
 * Usage:
 *   node scripts/generate-sri.js
 *   node scripts/generate-sri.js --update
 * 
 * The --update flag will automatically update index.html and login.html
 */

const crypto = require('crypto');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const CDN_URLS = [
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js',
  'https://unpkg.com/swup@4',
  'https://ui-avatars.com/api/',
];

const OUTPUT_FILE = path.join(__dirname, 'sri-hashes.json');
const HTML_FILES = [
  path.join(__dirname, '..', 'index.html'),
  path.join(__dirname, '..', 'login.html'),
  path.join(__dirname, '..', 'home.html'),
];

function fetchHash(url) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    
    const client = url.startsWith('https') ? https : http;
    
    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        
        // Handle relative redirects
        if (!redirectUrl.startsWith('http')) {
          try {
            redirectUrl = new URL(redirectUrl, url).href;
          } catch (e) {
            return reject(new Error(`Invalid redirect URL: ${redirectUrl}`));
          }
        }
        
        fetchHash(redirectUrl)
          .then(result => {
            result.elapsed = Date.now() - start;
            resolve(result);
          })
          .catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      const hash = crypto.createHash('sha384');
      res.on('data', chunk => hash.update(chunk));
      res.on('end', () => {
        const elapsed = Date.now() - start;
        resolve({ url, hash: `sha384-${hash.digest('base64')}`, elapsed });
      });
    }).on('error', reject);
  });
}

async function generateHashes() {
  console.log('🔐 Generating SRI hashes...\n');
  
  const hashes = {};
  const results = [];
  
  for (const url of CDN_URLS) {
    try {
      const result = await fetchHash(url);
      hashes[url] = result.hash;
      results.push({ url, ...result, success: true });
      console.log(`✓ ${url}`);
      console.log(`  ${result.hash}`);
      console.log(`  ${result.elapsed}ms\n`);
    } catch (error) {
      results.push({ url, success: false, error: error.message });
      console.log(`✗ ${url}: ${error.message}\n`);
    }
  }

  // Save to JSON file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(hashes, null, 2) + '\n');
  console.log('✅ Saved hashes to: scripts/sri-hashes.json\n');

  // Generate JavaScript module
  const jsModule = `// Auto-generated SRI hashes - DO NOT EDIT MANUALLY
// Generated at: ${new Date().toISOString()}
// Run "node scripts/generate-sri.js" to regenerate

module.exports = ${JSON.stringify(hashes, null, 2)};
`;
  fs.writeFileSync(path.join(__dirname, 'sri-hashes.js'), jsModule);
  console.log('✅ Generated: scripts/sri-hashes.js\n');

  // Summary
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  console.log('📊 Summary:');
  console.log(`   Total: ${results.length}`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failCount}\n`);

  if (failCount > 0) {
    console.log('⚠️  Some URLs failed. Check your network connection.');
  }

  return hashes;
}

async function updateHtmlFiles(hashes) {
  console.log('📝 Updating HTML files with SRI hashes...\n');
  
  const updates = {
    'https://cdn.tailwindcss.com': hashes['https://cdn.tailwindcss.com'],
    'https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js': hashes['https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js'],
  };

  let updatedCount = 0;

  for (const htmlFile of HTML_FILES) {
    if (!fs.existsSync(htmlFile)) {
      console.log(`⚠️  Skipped: ${htmlFile} (not found)`);
      continue;
    }

    let content = fs.readFileSync(htmlFile, 'utf8');
    let modified = false;

    for (const [url, hash] of Object.entries(updates)) {
      if (!hash) continue;

      // Match script tags with this src
      const regex = new RegExp(`(<script[^>]*src=["']${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*)(>)`, 'g');
      
      if (regex.test(content)) {
        content = content.replace(regex, `$1 integrity="${hash}" crossorigin="anonymous"$2`);
        modified = true;
        console.log(`✓ Updated: ${path.basename(htmlFile)} - ${url}`);
      }
    }

    if (modified) {
      fs.writeFileSync(htmlFile, content);
      updatedCount++;
    }
  }

  console.log(`\n✅ Updated ${updatedCount} HTML files\n`);
}

async function main() {
  const shouldUpdate = process.argv.includes('--update');
  
  console.log('🔐 SRI Hash Generator\n');
  
  try {
    const hashes = await generateHashes();
    
    if (shouldUpdate) {
      await updateHtmlFiles(hashes);
    } else {
      console.log('💡 Run with --update flag to automatically update HTML files:');
      console.log('   node scripts/generate-sri.js --update\n');
    }
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

main();
