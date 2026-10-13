import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { allocationTotal, emulateLongConversation, flowMaxCapacity, characterCount, compactEntries, compareModelTokens, contextPreset, conversationImageInputTokens, conversationImageTokens, conversationInputTokens, conversationOutputTokens, conversationReasoningTokens, countModelTokens, estimateTokens, fitAllocations, fitAmounts, flowBase, flowBootEntries, flowCapacity, flowMcpTools, flowUsed, hasLoadedMcpSchema, inputCost, modelGroups, modelPriceOptions, models, priceAt, requestCost, reservedContextBuffer, retainCall, retainConversation, samples, turnCosts, visualChunks, wordCount } from '../src/logic.ts';
import { claude5Pieces, countClaude5Tokens, countClaudeTokens, countOpenAITokens, countTokens, openAITokenIds, openAITokenPieces, tokenPieces } from '../src/tokenizers.ts';
import type { FlowEntry } from '../src/logic.ts';
import { causalAttention, createTransformerTrace, decodeCandidates, seededSample, softmax } from '../src/transformerLogic.ts';
import { createTransformerBlockTrace } from '../src/transformerBlockLogic.ts';
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
  it('routes Claude 5 through the approximation, Haiku 4.5 through ctoc, others through o200k_base', () => {
    const text = samples.multilingual;
    const expected = models.map(model => countTokens(text, model.tokenizer));
    assert.deepEqual(compareModelTokens(text), expected);
    assert.equal(models[0].name, 'Fable 5.1');
    assert.deepEqual(modelGroups, ['Anthropic', 'OpenAI', 'Other']);
    assert.deepEqual(models.filter(model => model.group === 'OpenAI').map(model => model.name), ['GPT-6 Astra', 'GPT-6.1 Sol', 'GPT-6 Luna', 'GPT-5.6 Sol', 'GPT-5.6 Terra', 'GPT-5.6 Luna']);
    assert.deepEqual(models.filter(model => model.group === 'Other').map(model => model.name), ['Grok 4.7', 'Gemini 3.1 Pro', 'DeepSeek V4 Pro', 'DeepSeek V4.1 Flash', 'GLM-5.3', 'Kimi K3', 'Mistral Large 3']);
    const haiku45 = models.find(model => model.id === 'claude-haiku-4-5')!;
    const haiku55 = models.find(model => model.id === 'claude-haiku-5-5')!;
    assert.equal(countModelTokens(text, haiku45), countClaudeTokens(text));
    assert.equal(countModelTokens(text, haiku55), countClaude5Tokens(text));
    // Haiku 4.5: fewer tokens but a higher per-request cost than Haiku 5.5 at ≤100K.
    for (const sample of Object.values(samples)) {
      const old = countModelTokens(sample, haiku45), next = countModelTokens(sample, haiku55);
      assert.ok(old < next);
      assert.ok(inputCost(old, haiku45.pricing[0]) > inputCost(next, haiku55.pricing[0]));
    }
  });
  it('calibrates the Claude 5 approximation to the documented ~1.0–1.35x (code higher) range', () => {
    const ratio = (text: string) => countClaude5Tokens(text) / countClaudeTokens(text);
    assert.ok(ratio(samples.prose) >= 1.15 && ratio(samples.prose) <= 1.35, `prose ${ratio(samples.prose)}`);
    assert.ok(ratio(samples.code) >= 1.3 && ratio(samples.code) <= 1.5, `code ${ratio(samples.code)}`);
    assert.ok(ratio(samples.python) >= 1.15 && ratio(samples.python) <= 1.5, `python ${ratio(samples.python)}`);
    assert.ok(ratio(samples.multilingual) >= 1.05 && ratio(samples.multilingual) <= 1.4, `multilingual ${ratio(samples.multilingual)}`);
    const all = Object.values(samples).join('\n');
    assert.ok(ratio(all) >= 1.15 && ratio(all) <= 1.35, `all ${ratio(all)}`);
  });
  it('keeps the Python sample cheaper than the equivalent TypeScript sample', () => {
    for (const count of [countClaudeTokens, countClaude5Tokens, countOpenAITokens]) assert.ok(count(samples.python) < count(samples.code));
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
  it('maps every tokenizer\'s pieces back onto the exact source text, including emoji and CJK', () => {
    for (const tokenizer of ['ctoc', 'claude5', 'o200k_base'] as const) {
      for (const text of [...Object.values(samples), '🚀 café 你好 \t\n  x', 'Гей, десь там']) {
        const pieces = tokenPieces(text, tokenizer, 10000);
        assert.equal(pieces.map(piece => piece.text).join(''), text, tokenizer);
        pieces.forEach((piece, index) => {
          assert.equal(text.slice(piece.start, piece.end), piece.text);
          if (index) assert.equal(piece.start, pieces[index - 1].end);
        });
        assert.equal(pieces.reduce((sum, piece) => sum + piece.tokens, 0), countTokens(text, tokenizer), `${tokenizer} ${text}`);
      }
    }
    assert.equal(claude5Pieces(samples.prose, 5).length, 5);
  });
  it('uses checked-in pricing for every displayed model, with long-context tiers', () => {
    const byId = Object.fromEntries(models.map(model => [model.id, model]));
    assert.deepEqual(byId['fable-5-1'].pricing[0], { label: 'Standard', input: 10, cachedInput: 0.25, output: 50 });
    assert.deepEqual(byId['claude-opus-5-5'].pricing[0], { label: 'Standard', input: 4, cachedInput: 0.2, output: 20 });
    assert.deepEqual(byId['claude-sonnet-5-5'].pricing[0], { label: 'Standard', input: 2, cachedInput: 0.1, output: 10 });
    assert.deepEqual(byId['claude-haiku-4-5'].pricing[0], { label: 'Standard', input: 1, cachedInput: 0.1, output: 5 });
    assert.deepEqual(byId['claude-haiku-5-5'].pricing.map(price => [price.input, price.cachedInput, price.output]), [[0.1, 0.01, 0.5], [0.5, 0.05, 2.5]]);
    assert.deepEqual(byId['gpt-6-astra'].pricing.map(price => price.input), [10, 20]);
    assert.deepEqual(byId['gpt-5-6-luna'].pricing[0], { label: '≤272K', input: 0.2, cachedInput: 0.02, output: 1.2 });
    assert.deepEqual(byId['grok-4-7'].pricing[1], { label: '>200K', overContext: 200000, input: 4, cachedInput: 1, output: 12 });
    assert.equal(priceAt(byId['claude-haiku-5-5'].pricing, 100000).input, 0.1);
    assert.equal(priceAt(byId['claude-haiku-5-5'].pricing, 100001).input, 0.5);
    assert.equal(priceAt(byId['fable-5-1'].pricing, 900000).input, 10);
  });
  it('provides one selectable option per model and prices cached input independently', () => {
    assert.deepEqual(modelPriceOptions.map(option => option.id), models.map(model => model.id));
    const sonnet = modelPriceOptions.find(option => option.id === 'claude-sonnet-5-5')!;
    assert.equal(requestCost(1000000, 1000000, 1000000, sonnet.price, true), 12.1);
    assert.equal(requestCost(1000000, 1000000, 1000000, sonnet.price, false), 14);
  });
  it('preserves the full original text when visual pieces are joined', () => {
    for (const text of [...Object.values(samples), ' abc\n🚀déjà\t你好! ', '']) {
      assert.equal(visualChunks(text).join(''), text);
    }
  });
});

describe('Toy transformer teaching trace', () => {
  it('uses a strict causal mask and normalizes every visible attention row', () => {
    const cells = causalAttention([[3, 1, 2], [2, 4, 0], [1, 2, 5]]);
    assert.deepEqual(cells[0].map(cell => cell.weight), [1, 0, 0]);
    for (const row of cells) {
      assert.ok(Math.abs(row.reduce((total, cell) => total + cell.weight, 0) - 1) < 1e-12);
      row.forEach((cell, key) => { if (cell.masked) assert.equal(cell.weight, 0); });
    }
  });
  it('keeps the shared inference trace and sampling deterministic', () => {
    const trace = createTransformerTrace('capital');
    assert.equal(trace.preset.expected, 'Paris');
    assert.equal(trace.heads.length, 2);
    assert.equal(trace.candidates.reduce((total, candidate) => total + candidate.probability, 0).toFixed(8), '1.00000000');
    const topTwo = decodeCandidates(trace.candidates, 0.7, 2);
    assert.equal(topTwo.length, 2);
    assert.equal(seededSample(topTwo, 42).token, seededSample(topTwo, 42).token);
    assert.deepEqual(softmax([0, 0]), [0.5, 0.5]);
  });
  it('uses intentional attention relationships in the capital-city lesson', () => {
    const cells = createTransformerTrace('capital').heads[0].cells;
    const strongestKey = (query: number) => cells[query].reduce((best, cell, key) => cell.weight > cells[query][best].weight ? key : best, 0);
    assert.equal(strongestKey(3), 1);
    assert.equal(strongestKey(4), 3);
    assert.ok(cells[4][1].weight > 0.3);
    assert.ok(cells[4][3].weight > 0.3);
  });
  it('uses contrasting subject and nearby-noun heads in the agreement lesson', () => {
    const heads = createTransformerTrace('agreement').heads;
    assert.ok(heads[0].cells[5][1].weight > 0.6);
    assert.ok(heads[1].cells[5][4].weight > 0.6);
    assert.ok(heads[0].cells[5][1].weight > heads[0].cells[5][4].weight);
    assert.ok(heads[1].cells[5][4].weight > heads[1].cells[5][1].weight);
  });
  it('keeps alternate antecedents visible in the coreference lesson', () => {
    const heads = createTransformerTrace('coreference').heads;
    assert.ok(heads[0].cells[3][2].weight > 0.5 && heads[0].cells[3][2].weight < 0.7);
    assert.ok(heads[1].cells[3][0].weight > 0.5 && heads[1].cells[3][0].weight < 0.7);
    assert.ok(heads[0].cells[4][3].weight > 0.4);
    assert.ok(heads[1].cells[4][0].weight > 0.2);
    assert.ok(heads[1].cells[4][3].weight > 0.2);
  });
  it('uses three complementary heads in the three-relationships lesson', () => {
    const heads = createTransformerTrace('three-relations').heads;
    assert.equal(heads.length, 3);
    assert.ok(heads[0].cells[8][1].weight > 0.4);
    assert.ok(heads[1].cells[8][4].weight > 0.4);
    assert.ok(heads[2].cells[8][7].weight > 0.4);
  });
});

describe('Transformer block teaching trace', () => {
  it('keeps decoder-only attention causal and normalized', () => {
    const trace = createTransformerBlockTrace('decoder');
    trace.attention.forEach((row, query) => {
      assert.equal(row.reduce((total, cell) => total + cell.weight, 0).toFixed(8), '1.00000000');
      row.forEach((cell, key) => {
        if (key > query) assert.deepEqual(cell, { masked: true, weight: 0 });
      });
    });
  });
  it('lets encoder attention see both directions', () => {
    const row = createTransformerBlockTrace('encoder').attention[1];
    assert.equal(row.some((cell, key) => key > 1 && !cell.masked && cell.weight > 0), true);
  });
  it('adds branch outputs back to the residual stream', () => {
    const trace = createTransformerBlockTrace('decoder');
    trace.output.forEach((vector, token) => vector.forEach((value, dimension) => {
      assert.ok(Math.abs(value - (trace.firstResidual[token][dimension] + trace.mlpOutput[token][dimension])) < 1e-12);
    }));
  });
  it('expands then projects the MLP dimensions', () => {
    const trace = createTransformerBlockTrace('encoder');
    assert.equal(trace.input[0].length, 4);
    assert.equal(trace.mlpExpanded[0].length, 8);
    assert.equal(trace.mlpOutput[0].length, 4);
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
  it('uses fixed conversation sizes: 2K input, 4K output, 6K thinking', () => {
    assert.equal(conversationInputTokens, 2000);
    assert.equal(conversationOutputTokens, 4000);
    assert.equal(conversationReasoningTokens, 6000);
  });
  it('models a standard-tier 1080p image attachment as 1,560 visual tokens', () => {
    assert.equal(conversationImageTokens, 1560);
    assert.equal(conversationImageInputTokens, 3560);
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
  it('accepts a 1M window where the 64K default rejects', () => {
    const big = call(100000);
    assert.equal(retainCall([], big), null);
    assert.equal(flowUsed(retainCall([], big, flowMaxCapacity)!), flowBase + 100000);
  });
});

describe('long conversation emulation', () => {
  it('adds 50 rounds with tool calls, skills, and one schema per tool', () => {
    const { entries, turns } = emulateLongConversation([], { startId: 1 });
    assert.equal(turns, 50);
    const rounds = entries.filter(e => e.kind === 'message').map(e => e.round);
    assert.deepEqual(rounds, Array.from({ length: 50 }, (_, i) => i + 1));
    assert.equal(entries.filter(e => e.kind === 'mcp-schema').length, 2);
    assert.equal(entries.filter(e => e.kind === 'mcp-result').length, 9);
    assert.equal(entries.filter(e => e.kind === 'skill-result').length, 4);
    assert.equal(entries.at(-1)!.kind, 'message');
    assert.equal(entries.at(-2)!.kind, 'message');
    assert.ok(entries.filter(e => e.kind === 'message').every(e => e.inputTokens === 2000 && e.outputTokens === 4000));
    assert.equal(new Set(entries.map(e => e.id)).size, entries.length);
    assert.ok(flowUsed(entries) > 150000 && flowUsed(entries) < flowMaxCapacity);
    assert.equal(entries.at(-1)!.cached, false);
    assert.ok(entries.slice(0, -1).every(e => e.cached));
  });
  it('stops at whole turns when the window fills', () => {
    const { entries, turns } = emulateLongConversation([], { capacity: 64000, startId: 1 });
    assert.ok(turns > 0 && turns < 50);
    assert.ok(flowUsed(entries) <= 64000);
    assert.equal(entries.filter(e => e.kind === 'message').length, turns);
  });
  it('prices a cache miss as a 1.25x write of the whole prefix instead of a cheap read', () => {
    const pricing = [{ label: 'flat', input: 10, cachedInput: 0.25, output: 50 }];
    const { entries } = emulateLongConversation([], { startId: 1 });
    const missed = entries.map((entry, index) => index === 5 ? { ...entry, cacheMiss: true } : entry);
    const hit = turnCosts(entries, pricing, true)[5];
    const miss = turnCosts(missed, pricing, true)[5];
    assert.equal(miss.miss, true);
    assert.equal(miss.contextTokens, hit.contextTokens);
    assert.ok(Math.abs(miss.reread - hit.contextTokens * 12.5 / 1e6) < 1e-12);
    assert.ok(Math.abs(miss.reread / hit.reread - 50) < 1e-9);
    assert.equal(miss.write, hit.write);
    assert.equal(miss.output, hit.output);
  });
  it('writes the previous answer plus new input once (1.25x), then reads the prefix cheaply', () => {
    const pricing = [{ label: 'flat', input: 10, cachedInput: 0.25, output: 50 }];
    const { entries } = emulateLongConversation([], { startId: 1, reasoning: true });
    const turns = turnCosts(entries, pricing, true);
    assert.equal(turns.length, entries.length);
    const generated = (entry: typeof entries[number]) => (entry.outputTokens ?? 0) + (entry.reasoningTokens ?? 0);
    // First request: nothing generated before it, so the whole boot context is read.
    assert.equal(turns[0].contextTokens, flowBase);
    assert.equal(turns[0].writeTokens, entries[0].tokens - generated(entries[0]));
    assert.ok(Math.abs(turns[0].reread - flowBase * 0.25 / 1e6) < 1e-12);
    assert.ok(Math.abs(turns[0].write - turns[0].writeTokens * 12.5 / 1e6) < 1e-12);
    assert.ok(Math.abs(turns[0].output - generated(entries[0]) * 50 / 1e6) < 1e-12);
    // Next request writes the previous answer (first time it is cached) and reads the rest.
    assert.equal(turns[1].writeTokens, generated(entries[0]) + entries[1].tokens - generated(entries[1]));
    assert.equal(turns[1].contextTokens, flowBase + entries[0].tokens - generated(entries[0]));
    // Every token is written exactly once, except the latest answer which has not been sent back yet.
    const written = turns.reduce((sum, turn) => sum + turn.writeTokens, 0);
    assert.equal(flowBase + written + generated(entries.at(-1)!), flowBase + entries.reduce((sum, e) => sum + e.tokens, 0));
    const last = turns.at(-1)!;
    assert.ok(last.reread > 8 * turns[0].reread);
    assert.ok(Math.abs(last.cumulative - turns.reduce((sum, turn) => sum + turn.total, 0)) < 1e-12);
    assert.ok(turns.every((turn, index) => index === 0 || turn.reread > turns[index - 1].reread));
  });
  it('charges no cache premium or discount when caching is off', () => {
    const pricing = [{ label: 'flat', input: 10, cachedInput: 0.25, output: 50 }];
    const { entries } = emulateLongConversation([], { startId: 1 });
    const turn = turnCosts(entries, pricing, false)[3];
    assert.equal(turn.readRate, 10);
    assert.equal(turn.writeRate, 10);
  });
});
