// After a build, version the islands entry in index.html by its content hash
// (the service worker caches ?v= URLs forever, so every build needs a new one).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const entry = readFileSync(resolve(root, 'assets/islands/islands.js'));
const hash = createHash('sha1').update(entry).digest('hex').slice(0, 10);
const page = resolve(root, 'index.html');
const html = readFileSync(page, 'utf8');
const next = html.replace(/assets\/islands\/islands\.js(\?v=[0-9a-f]+)?/, `assets/islands/islands.js?v=${hash}`);
if (next === html && !html.includes(`islands.js?v=${hash}`)) throw new Error('islands script tag not found in index.html');
writeFileSync(page, next);
console.log(`index.html -> assets/islands/islands.js?v=${hash}`);
