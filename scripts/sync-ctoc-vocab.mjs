import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

// Pinned upstream data; run explicitly, never during app startup or npm install.
const revision = '5aec316bddbcc388df7b3e6d186739b8f1f02247';
const source = `https://raw.githubusercontent.com/rohangpta/ctoc/${revision}/vocab.json`;
const response = await fetch(source);
if (!response.ok) throw new Error(`ctoc vocabulary download failed: ${response.status}`);
const raw = await response.text();
const { verified } = JSON.parse(raw);
if (!Array.isArray(verified) || verified.length !== 38360
    || verified.some(token => typeof token !== 'string' || !token.length)
    || new Set(verified).size !== verified.length) {
  throw new Error('Unexpected ctoc vocabulary: refusing to overwrite bundled data.');
}
const directory = new URL('../src/data/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('ctoc-vocab.json', directory), JSON.stringify({
  source, revision, sourceSha256: createHash('sha256').update(raw).digest('hex'),
  scope: 'Reverse-engineered Claude 3–4.6 vocabulary; not an official tokenizer or a model-specific calibration.',
  license: 'No license declared in upstream repository at the pinned revision. Review permission before redistribution.',
  verified,
}) + '\n');
console.log(`Bundled ${verified.length} verified ctoc tokens from ${revision}.`);
