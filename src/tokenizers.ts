import { Tiktoken } from 'js-tiktoken/lite';
import o200kBase from 'js-tiktoken/ranks/o200k_base';
import vocabulary from './data/ctoc-vocab.json' with { type: 'json' };

export type TokenizerKind = 'ctoc' | 'o200k_base';
export const ctocMetadata = {
  revision: vocabulary.revision,
  vocabularySize: vocabulary.verified.length,
  source: 'https://github.com/rohangpta/ctoc',
} as const;

// The C++ ctoc CLI cannot run in the browser. This implements its byte-trie
// longest-match algorithm over the pinned upstream verified vocabulary.
// No BPE ranks, normalization, model multipliers, or API message overhead.
type TrieNode = { children: Map<number, TrieNode>; terminal: boolean };
const newNode = (): TrieNode => ({ children: new Map(), terminal: false });
const utf8 = new TextEncoder();
let root: TrieNode | undefined;
let openai: Tiktoken | undefined;

function ctocTrie(): TrieNode {
  if (root) return root;
  root = newNode();
  for (const token of vocabulary.verified) {
    let node = root;
    for (const byte of utf8.encode(token)) {
      let child = node.children.get(byte);
      if (!child) { child = newNode(); node.children.set(byte, child); }
      node = child;
    }
    node.terminal = true;
  }
  return root;
}

export function countClaudeTokens(text: string): number {
  if (!text) return 0;
  const trie = ctocTrie();
  const bytes = utf8.encode(text);
  let count = 0;
  for (let start = 0; start < bytes.length; count++) {
    let node = trie;
    // Unknown bytes consume one token EACH, not one per Unicode character.
    let end = start + 1;
    for (let cursor = start; cursor < bytes.length; cursor++) {
      const child = node.children.get(bytes[cursor]);
      if (!child) break;
      node = child;
      if (node.terminal) end = cursor + 1;
    }
    start = end;
  }
  return count;
}

export function countOpenAITokens(text: string): number {
  if (!text) return 0;
  openai ??= new Tiktoken(o200kBase);
  // User input is ordinary text, including literal strings such as <|endoftext|>.
  // Explicit empty special-token sets avoid errors or counting these as controls.
  return openai.encode(text, [], []).length;
}

export function countTokens(text: string, tokenizer: TokenizerKind): number {
  return tokenizer === 'ctoc' ? countClaudeTokens(text) : countOpenAITokens(text);
}
