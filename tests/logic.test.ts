import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { allocationTotal, characterCount, compactEntries, compareModelTokens, contextPreset, conversationImageInputTokens, conversationImageTokens, conversationOutputTokens, conversationReasoningMaxTokens, conversationReasoningMinTokens, conversationReasoningTokens, countModelTokens, estimateTokens, fitAllocations, fitAmounts, flowBase, flowBootEntries, flowCapacity, flowMcpTools, flowUsed, hasLoadedMcpSchema, inputCost, modelPriceOptions, models, requestCost, reservedContextBuffer, retainCall, retainConversation, samples, visualChunks, wordCount } from '../src/logic.ts';
import { countClaudeTokens, countOpenAITokens, openAITokenIds, openAITokenPieces } from '../src/tokenizers.ts';
import type { FlowEntry } from '../src/logic.ts';
const call = (tokens = 2400, id = 1): FlowEntry => ({ id, kind: 'mcp-result', name: 'Search', tokens, originalTokens: tokens, summarized: false, toolId: 'search' });

describe('Token estimates and counters', () => {
  it('returns zero for empty input for every model', () => {
    assert.equal(estimateTokens(''), 0);
    assert.deepEqual(compareModelTokens(''), models.map(() => 0));
  });
  it('estimates prose, code, whitespace, and multilingual text deterministically', () => {
    for (const text of [...Object.values(samples), '   ', '\n\n', '你好', 'こんにちは', 'café', '🚀']) {
      const count = estimateTokens(text);
      assert.ok(Number.isSafeInteger(count) && count > 0);
      assert.equal(estimateTokens(text), count);
    }
  });
  it('counts code points rather than surrogate halves as characters', () => {
    assert.equal(characterCount('a🚀é'), 3);
    assert.equal(characterCount(''), 0);
  });
  it('uses transparent whitespace-separated word counts', () => {
    assert.equal(wordCount(''), 0);
    assert.equal(wordCount(' \n '), 0);
    assert.equal(wordCount('one\n two\tthree'), 3);
  });
  it('handles 100,000 characters without invalid counts', () => {
    assert.ok(estimateTokens('a'.repeat(100000)) > 0);
  });
  it('routes Claude through ctoc and OpenAI and Grok through o200k_base', () => {
    const text = samples.multilingual;
    const expected = models.map(model => Math.ceil((model.tokenizer === 'ctoc' ? countClaudeTokens(text) : countOpenAITokens(text)) * model.countAdjustment));
    assert.deepEqual(compareModelTokens(text), expected);
    assert.equal(models[0].name, 'Fable 5.1');
    assert.deepEqual(models.filter(model => model.family === 'OpenAI').map(model => model.name), ['GPT-6 Astra', 'GPT 5.6 (Sol / Terra / Luna)']);
    assert.equal(models.at(-1)?.name, 'Grok 4.6');
    const haiku = models.find(model => model.name === 'Claude Haiku 4.5')!;
    assert.equal(haiku.countAdjustment, 0.7);
    assert.equal(countModelTokens(text, haiku), Math.ceil(countClaudeTokens(text) * 0.7));
  });
  it('exposes exact OpenAI token IDs for the o200k_base visualization', () => {
    const text = 'Hello, world!';
    const ids = openAITokenIds(text);
    assert.equal(ids.length, countOpenAITokens(text));
    assert.ok(ids.every(id => Number.isSafeInteger(id) && id >= 0));
    assert.equal(openAITokenIds(text, 1).length, 1);
    assert.deepEqual(openAITokenIds('', 20), []);
    const pieces = openAITokenPieces(text);
    assert.deepEqual(pieces.map(piece => piece.id), ids);
    assert.equal(pieces.map(piece => piece.text).join(''), text);
  });
  it('uses checked-in standard input pricing for every displayed model', () => {
    const byId = Object.fromEntries(models.map(model => [model.id, model]));
    assert.deepEqual(byId['fable-5-1'].pricing[0], { label: 'Standard', input: 10, cachedInput: 0.25, output: 50 });
    assert.deepEqual(byId['claude-sonnet-5'].pricing[0], { label: 'Standard', input: 2, cachedInput: 0.2, output: 10 });
    assert.deepEqual(byId['claude-haiku-4.5'].pricing[0], { label: 'Standard', input: 1, cachedInput: 0.1, output: 5 });
    assert.deepEqual(byId['gpt-6-astra'].pricing[0], { label: 'Standard', input: 10, cachedInput: 1, output: 50 });
    assert.deepEqual(byId['gpt-5-6-family'].pricing.map(price => price.input), [4, 2, 0.2]);
    assert.deepEqual(byId['grok-4.6'].pricing[0], { label: 'Under 200K context', input: 2, cachedInput: 0.5, output: 6 });
    assert.equal(inputCost(1000000, byId['gpt-5-6-family'].pricing[2]), 0.2);
  });
  it('provides individual selectable tiers and prices cached input independently', () => {
    assert.deepEqual(modelPriceOptions.map(option => option.name), [
      'Fable 5.1', 'Claude Sonnet 5', 'Claude Haiku 4.5', 'GPT-6 Astra', 'Sol', 'Terra', 'Luna', 'Grok 4.6',
    ]);
    const sonnet = modelPriceOptions.find(option => option.id === 'claude-sonnet-5-Standard')!;
    assert.equal(requestCost(1000000, 1000000, 1000000, sonnet.price, true), 12.2);
    assert.equal(requestCost(1000000, 1000000, 1000000, sonnet.price, false), 14);
  });
  it('preserves the full original text when visual pieces are joined', () => {
    for (const text of [...Object.values(samples), ' abc\n🚀déjà\t你好! ', '']) {
      assert.equal(visualChunks(text).join(''), text);
    }
  });
});

describe('Context allocations', () => {
  it('keeps the shared teaching profile within its window', () => {
    const amounts = fitAllocations(contextPreset, 200000);
    assert.deepEqual(amounts, contextPreset);
    assert.ok(allocationTotal(amounts) < 200000);
  });
  it('keeps a three-percent compaction buffer outside available context', () => {
    assert.equal(reservedContextBuffer(200000), 6000);
    assert.equal(200000 - allocationTotal(contextPreset) - reservedContextBuffer(200000), 145910);
  });
  it('clamps overflow and negative allocations', () => {
    assert.deepEqual(fitAmounts([-50, 80, 80, 5], 100), [0, 80, 20, 0]);
  });
  it('sanitizes nonfinite values and supports zero capacity', () => {
    assert.deepEqual(fitAmounts([NaN, Infinity, 5], 10), [0, 0, 5]);
    assert.deepEqual(fitAmounts([10, 20], 0), [0, 0]);
  });
});

describe('Retained tool and skill context', () => {
  it('starts with an explicit 18.8K Claude Code teaching baseline', () => {
    assert.equal(flowUsed([]), flowBase);
    assert.equal(flowBase, 18800);
    assert.deepEqual(flowBootEntries.map(entry => entry.tokens), [7800, 10000, 600, 240, 160]);
  });
  it('generates assistant outputs between 2K and 3K tokens', () => {
    assert.equal(conversationOutputTokens(() => 0), 2000);
    assert.equal(conversationOutputTokens(() => 0.999999), 3000);
    assert.equal(conversationOutputTokens(() => 1), 3000);
  });
  it('models a standard-tier 1080p image attachment as 1,560 visual tokens', () => {
    assert.equal(conversationImageTokens, 1560);
    assert.equal(conversationImageInputTokens, 2160);
  });
  it('varies reasoning tokens between 800 and 1,600 in addition to visible output', () => {
    assert.equal(conversationReasoningMinTokens, 800);
    assert.equal(conversationReasoningMaxTokens, 1600);
    assert.equal(conversationReasoningTokens(() => 0), 800);
    assert.equal(conversationReasoningTokens(() => 0.999999), 1600);
    assert.equal(conversationReasoningTokens(() => 1), 1600);
  });
  it('accumulates identical calls as separate retained responses', () => {
    const first = retainCall([], call())!;
    const second = retainCall(first, call(2400, 2))!;
    assert.equal(second.length, 2);
    assert.equal(flowUsed(second), flowBase + 4800);
    assert.equal(first.length, 1);
  });
  it('allows exact capacity and rejects overflow without partial entries', () => {
    const full = retainCall([], call(flowCapacity - flowBase))!;
    assert.equal(flowUsed(full), flowCapacity);
    assert.equal(retainCall(full, call(1, 2)), null);
    assert.equal(full.length, 1);
  });
  it('compacts retained history into one summary without repeatedly shrinking it', () => {
    const original = [call(2400), call(900, 2)];
    const compacted = compactEntries(original);
    assert.equal(compacted.length, 1);
    assert.equal(compacted[0].name, 'Session summary');
    assert.equal(compacted[0].tokens, 825);
    assert.equal(compacted[0].originalTokens, 3300);
    assert.ok(compacted[0].summarized);
    assert.deepEqual(compactEntries(compacted), compacted);
    assert.equal(original[0].tokens, 2400);
  });
  it('allows new calls after compaction and folds them into the next summary', () => {
    const first = compactEntries([call(2400)]);
    const next = retainCall(first, call(900, 2))!;
    const result = compactEntries(next);
    assert.equal(result.length, 1);
    assert.equal(result[0].tokens, 375);
    assert.equal(result[0].originalTokens, 3300);
  });
  it("tracks one full MCP schema before each tool's retained results", () => {
    const schema: FlowEntry = { id: 1, kind: 'mcp-schema', name: 'Search schema loaded', tokens: flowMcpTools.search.schemaTokens, originalTokens: flowMcpTools.search.schemaTokens, summarized: false, toolId: 'search' };
    const withSchema = retainCall([], schema)!;
    assert.equal(hasLoadedMcpSchema(withSchema, 'search'), true);
    assert.equal(hasLoadedMcpSchema(withSchema, 'database'), false);
  });
  it('marks every prior retained entry cached without reducing its tokens', () => {
    const schema: FlowEntry = { id: 1, kind: 'mcp-schema', name: 'Search schema loaded', tokens: 2400, originalTokens: 2400, summarized: false, toolId: 'search' };
    const result = retainCall([schema], call(2400, 2))!;
    const conversation = retainConversation(result, { id: 3, kind: 'message', name: 'Conversation round', tokens: 600, originalTokens: 600, summarized: false })!;
    assert.deepEqual(conversation.map(entry => [entry.kind, entry.cached]), [
      ['mcp-schema', true], ['mcp-result', true], ['message', false],
    ]);
    assert.equal(flowUsed(conversation), flowBase + 5400);
  });
});
