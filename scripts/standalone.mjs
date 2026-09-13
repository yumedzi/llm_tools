import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(resolve(root, file), 'utf8');
let html = read('dist/index.html');
// Bundle the production assets into a single self-contained local preview.
// Deployment still uses Vite's ordinary dist/ directory and strict Vercel headers.
html = html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, (_, path) => `<script type="module">${read(`dist${path}`).replace(/<\/script/gi, '<\\/script')}</script>`);
html = html.replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/g, (_, path) => `<style>${read(`dist${path}`)}</style>`);
html = html.replace('href="/favicon.svg"', `href="data:image/svg+xml,${encodeURIComponent(read('public/favicon.svg'))}"`);
mkdirSync(resolve(root, 'outputs'), { recursive: true });
writeFileSync(resolve(root, 'outputs/context-lab.html'), html);
console.log('Created outputs/context-lab.html — self-contained, no external assets.');
