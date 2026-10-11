import { Tiktoken } from 'js-tiktoken/lite';
import o200kBase from 'js-tiktoken/ranks/o200k_base';
import vocabulary from './data/ctoc-vocab.json' with { type: 'json' };

export type TokenizerKind = 'ctoc' | 'claude5' | 'o200k_base';
export const ctocMetadata = {
  revision: vocabulary.revision,
  vocabularySize: vocabulary.verified.length,
  source: 'https://github.com/rohangpta/ctoc',
} as const;

// A display piece: `start`/`end` are UTF-16 offsets into the input, so pieces
// concatenate back to the exact source text. `tokens` > 1 only when byte-level
// tokens split one character and were merged for display.
export type TokenPiece = { id: number; text: string; start: number; end: number; tokens: number };

// The C++ ctoc CLI cannot run in the browser. This implements its byte-trie
// longest-match algorithm over the pinned upstream verified vocabulary
// (Claude 3–4.6 era: Haiku 4.5 still uses it).
// No BPE ranks, normalization, model multipliers, or API message overhead.
type TrieNode = { children: Map<number, TrieNode>; id: number };
const newNode = (): TrieNode => ({ children: new Map(), id: -1 });
const utf8 = new TextEncoder();
const tries = new Map<'ctoc' | 'claude5', TrieNode>();
let openai: Tiktoken | undefined;

// Claude 5 approximation. Anthropic publishes no vocabulary for the tokenizer
// introduced with Opus 4.7, only that it yields "approximately 30% more tokens"
// (pricing docs) or "roughly 1.0–1.35x depending on content type" (Opus 4.7
// launch); measured examples range 1.08x (PDF prose) to 1.46x (system prompt).
// We restrict the legacy vocabulary so greedy longest-match splits words into
// realistic shorter pieces. Calibrated on the lab samples: prose ≈1.28x,
// code ≈1.38x, multilingual ≈1.12x (see tests/logic.test.ts).
export const claude5Rules = {
  asciiLetters: 6, // max letters in a Latin word piece (leading space excluded)
  otherLetters: 2, // max characters in a non-Latin word piece
  digits: 2, // max digits per piece
  whitespace: 1, // max characters in a pure-whitespace piece
  symbolBytes: 2, // max bytes for punctuation / code-symbol pieces
} as const;

function keepForClaude5(token: string): boolean {
  const core = token.startsWith(' ') ? token.slice(1) : token;
  if (/^\p{L}+$/u.test(core)) {
    return /^[\x00-\x7f]+$/.test(core) ? core.length <= claude5Rules.asciiLetters : Array.from(core).length <= claude5Rules.otherLetters;
  }
  if (/^\d+$/.test(core)) return core.length <= claude5Rules.digits;
  if (/^\s+$/.test(token)) return token.length <= claude5Rules.whitespace;
  return utf8.encode(token).length <= claude5Rules.symbolBytes;
}

function trie(kind: 'ctoc' | 'claude5'): TrieNode {
  const cached = tries.get(kind);
  if (cached) return cached;
  const root = newNode();
  vocabulary.verified.forEach((token, id) => {
    if (kind === 'claude5' && !keepForClaude5(token)) return;
    let node = root;
    for (const byte of utf8.encode(token)) {
      let child = node.children.get(byte);
      if (!child) { child = newNode(); node.children.set(byte, child); }
      node = child;
    }
    node.id = id;
  });
  tries.set(kind, root);
  return root;
}

// Greedy longest match. Unknown bytes consume one token EACH (id -1), not one per character.
function trieTokens(text: string, kind: 'ctoc' | 'claude5', onToken?: (startByte: number, endByte: number, id: number) => boolean): number {
  if (!text) return 0;
  const root = trie(kind);
  const bytes = utf8.encode(text);
  let count = 0;
  for (let start = 0; start < bytes.length; count++) {
    let node = root;
    let end = start + 1;
    let id = -1;
    for (let cursor = start; cursor < bytes.length; cursor++) {
      const child = node.children.get(bytes[cursor]);
      if (!child) break;
      node = child;
      if (node.id >= 0) { end = cursor + 1; id = node.id; }
    }
    if (onToken && !onToken(start, end, id)) return count + 1;
    start = end;
  }
  return count;
}

// Maps each UTF-8 byte offset to the UTF-16 offset of the character containing it,
// and reports whether a byte offset falls on a character boundary.
function byteMap(text: string) {
  const charAt: number[] = [];
  const boundary = new Set<number>([0]);
  let offset = 0;
  for (const ch of text) {
    const length = utf8.encode(ch).length;
    for (let i = 0; i < length; i++) charAt.push(offset);
    offset += ch.length;
    boundary.add(charAt.length);
  }
  charAt.push(offset);
  return { charAt, boundary };
}

// Turns byte-range tokens into character-aligned display pieces.
function piecesFromByteTokens(text: string, tokens: Iterable<[number, number, number]>, limit: number): TokenPiece[] {
  const { charAt, boundary } = byteMap(text);
  const pieces: TokenPiece[] = [];
  let pending: { startByte: number; id: number; tokens: number } | undefined;
  for (const [startByte, endByte, id] of tokens) {
    if (pieces.length >= limit) break;
    pending ??= { startByte, id, tokens: 0 };
    pending.tokens += 1;
    if (!boundary.has(endByte)) continue;
    const start = charAt[pending.startByte];
    const end = charAt[endByte];
    pieces.push({ id: pending.tokens > 1 ? -1 : pending.id, text: text.slice(start, end), start, end, tokens: pending.tokens });
    pending = undefined;
  }
  return pieces;
}

function triePieces(text: string, kind: 'ctoc' | 'claude5', limit: number): TokenPiece[] {
  if (!text || limit <= 0) return [];
  const raw: [number, number, number][] = [];
  // Over-collect slightly: merged multi-byte characters consume several raw tokens.
  trieTokens(text, kind, (s, e, id) => { raw.push([s, e, id]); return raw.length < limit * 4; });
  return piecesFromByteTokens(text, raw, limit);
}

export const countClaudeTokens = (text: string): number => trieTokens(text, 'ctoc');
export const countClaude5Tokens = (text: string): number => trieTokens(text, 'claude5');
export const claudeLegacyPieces = (text: string, limit = 160): TokenPiece[] => triePieces(text, 'ctoc', limit);
export const claude5Pieces = (text: string, limit = 160): TokenPiece[] => triePieces(text, 'claude5', limit);

function o200k(): Tiktoken {
  openai ??= new Tiktoken(o200kBase);
  return openai;
}

export function countOpenAITokens(text: string): number {
  if (!text) return 0;
  // User input is ordinary text, including literal strings such as <|endoftext|>.
  // Explicit empty special-token sets avoid errors or counting these as controls.
  return o200k().encode(text, [], []).length;
}

export function openAITokenIds(text: string, limit = 160): number[] {
  if (!text || limit <= 0) return [];
  return Array.from(o200k().encode(text, [], []).slice(0, limit));
}

export function openAITokenPieces(text: string, limit = 160): TokenPiece[] {
  if (!text || limit <= 0) return [];
  const encoder = o200k();
  // js-tiktoken keeps each rank's raw bytes in a private map; fall back to
  // re-encoding the decoded text if that internal ever changes.
  const textMap = (encoder as unknown as { textMap?: Map<number, Uint8Array> }).textMap;
  const ids = encoder.encode(text, [], []).slice(0, limit * 4);
  let byte = 0;
  const raw = ids.map((id): [number, number, number] => {
    const length = textMap?.get(id)?.length ?? utf8.encode(encoder.decode([id])).length;
    const range: [number, number, number] = [byte, byte + length, id];
    byte += length;
    return range;
  });
  return piecesFromByteTokens(text, raw, limit);
}

export function countTokens(text: string, tokenizer: TokenizerKind): number {
  if (tokenizer === 'ctoc') return countClaudeTokens(text);
  if (tokenizer === 'claude5') return countClaude5Tokens(text);
  return countOpenAITokens(text);
}

export function tokenPieces(text: string, tokenizer: TokenizerKind, limit = 160): TokenPiece[] {
  if (tokenizer === 'ctoc') return claudeLegacyPieces(text, limit);
  if (tokenizer === 'claude5') return claude5Pieces(text, limit);
  return openAITokenPieces(text, limit);
}
