import { countClaude5Tokens, countTokens, type TokenizerKind } from './tokenizers.ts';

export const formatNumber = (n: number) => new Intl.NumberFormat('en-US').format(n);
export const compact = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `${n}`;

// The prompt sandbox uses the same offline Claude 5 approximation as Claude rows.
export const estimateTokens = countClaude5Tokens;
export const wordCount = (s: string) => s.trim() ? (s.trim().match(/\S+/gu) ?? []).length : 0;
export const characterCount = (s: string) => Array.from(s).length;
// `overContext`: this tier bills the WHOLE request when the prompt exceeds that many tokens.
export type ModelPrice = { label: string; input: number; cachedInput: number; output: number; overContext?: number };
export type ModelGroup = 'Anthropic' | 'OpenAI' | 'Other';
export type ModelFamily = 'Claude' | 'OpenAI' | 'Grok' | 'DeepSeek' | 'GLM' | 'Gemini' | 'Kimi' | 'Mistral';
export type ModelSpec = { id: string; name: string; group: ModelGroup; family: ModelFamily; color: string; tokenizer: TokenizerKind; pricing: readonly ModelPrice[]; note: string };
const tier = (label: string, overContext: number, input: number, cachedInput: number, output: number): ModelPrice => ({ label, overContext, input, cachedInput, output });
const flat = (input: number, cachedInput: number, output: number): ModelPrice[] => [{ label: 'Standard', input, cachedInput, output }];
// USD per 1M tokens, checked on vendor pages 2026-10-11. Non-Claude/OpenAI rows use o200k_base as a proxy.
export const models: readonly ModelSpec[] = [
  { id: 'fable-5-1', name: 'Fable 5.1', group: 'Anthropic', family: 'Claude', color: '#b19aff', tokenizer: 'claude5', pricing: flat(10, 0.25, 50), note: 'Claude 5 tokenizer approximation' },
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', group: 'Anthropic', family: 'Claude', color: '#e79bc6', tokenizer: 'claude5', pricing: flat(4, 0.2, 20), note: 'Claude 5 tokenizer approximation' },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', group: 'Anthropic', family: 'Claude', color: '#f3ba94', tokenizer: 'claude5', pricing: flat(2, 0.1, 10), note: 'Claude 5 tokenizer approximation' },
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', group: 'Anthropic', family: 'Claude', color: '#9fd8a8', tokenizer: 'claude5', pricing: [{ label: '≤100K', input: 0.1, cachedInput: 0.01, output: 0.5 }, tier('>100K', 100000, 0.5, 0.05, 2.5)], note: 'Claude 5 tokenizer approximation' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', group: 'Anthropic', family: 'Claude', color: '#eccba7', tokenizer: 'ctoc', pricing: flat(1, 0.1, 5), note: 'Legacy Claude 3–4.6 tokenizer (ctoc)' },
  { id: 'gpt-6-astra', name: 'GPT-6 Astra', group: 'OpenAI', family: 'OpenAI', color: '#74c5ff', tokenizer: 'o200k_base', pricing: [{ label: '≤272K', input: 10, cachedInput: 1, output: 50 }, tier('>272K', 272000, 20, 2, 75)], note: 'js-tiktoken · o200k_base' },
  { id: 'gpt-6-1-sol', name: 'GPT-6.1 Sol', group: 'OpenAI', family: 'OpenAI', color: '#90d9c1', tokenizer: 'o200k_base', pricing: [{ label: '≤272K', input: 2, cachedInput: 0.1, output: 10 }, tier('>272K', 272000, 4, 0.2, 15)], note: 'js-tiktoken · o200k_base' },
  { id: 'gpt-6-luna', name: 'GPT-6 Luna', group: 'OpenAI', family: 'OpenAI', color: '#b8e986', tokenizer: 'o200k_base', pricing: [{ label: '≤272K', input: 0.1, cachedInput: 0.01, output: 0.5 }, tier('>272K', 272000, 0.2, 0.02, 0.75)], note: 'js-tiktoken · o200k_base' },
  { id: 'gpt-5-6-sol', name: 'GPT-5.6 Sol', group: 'OpenAI', family: 'OpenAI', color: '#5fb8a0', tokenizer: 'o200k_base', pricing: [{ label: '≤272K', input: 4, cachedInput: 0.4, output: 20 }, tier('>272K', 272000, 8, 0.8, 30)], note: 'js-tiktoken · o200k_base · promotional price' },
  { id: 'gpt-5-6-terra', name: 'GPT-5.6 Terra', group: 'OpenAI', family: 'OpenAI', color: '#7fc8d8', tokenizer: 'o200k_base', pricing: [{ label: '≤272K', input: 2, cachedInput: 0.2, output: 12 }, tier('>272K', 272000, 4, 0.4, 18)], note: 'js-tiktoken · o200k_base' },
  { id: 'gpt-5-6-luna', name: 'GPT-5.6 Luna', group: 'OpenAI', family: 'OpenAI', color: '#a5b4fc', tokenizer: 'o200k_base', pricing: [{ label: '≤272K', input: 0.2, cachedInput: 0.02, output: 1.2 }, tier('>272K', 272000, 0.4, 0.04, 1.8)], note: 'js-tiktoken · o200k_base' },
  { id: 'grok-4-7', name: 'Grok 4.7', group: 'Other', family: 'Grok', color: '#8baffb', tokenizer: 'o200k_base', pricing: [{ label: '≤200K', input: 2, cachedInput: 0.5, output: 6 }, tier('>200K', 200000, 4, 1, 12)], note: 'o200k_base proxy · approximate' },
  { id: 'gemini-3-1-pro', name: 'Gemini 3.1 Pro', group: 'Other', family: 'Gemini', color: '#7aa7ff', tokenizer: 'o200k_base', pricing: [{ label: '≤200K', input: 2, cachedInput: 0.2, output: 12 }, tier('>200K', 200000, 4, 0.4, 18)], note: 'o200k_base proxy · preview pricing' },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', group: 'Other', family: 'DeepSeek', color: '#6f8cff', tokenizer: 'o200k_base', pricing: flat(1.32, 0.044, 3.96), note: 'o200k_base proxy · peak-hour price' },
  { id: 'deepseek-v4-1-flash', name: 'DeepSeek V4.1 Flash', group: 'Other', family: 'DeepSeek', color: '#9fb4ff', tokenizer: 'o200k_base', pricing: flat(0.3, 0.006, 1.2), note: 'o200k_base proxy · peak-hour price' },
  { id: 'glm-5-3', name: 'GLM-5.3', group: 'Other', family: 'GLM', color: '#c4a7ff', tokenizer: 'o200k_base', pricing: flat(1.4, 0.26, 4.4), note: 'o200k_base proxy · approximate' },
  { id: 'kimi-k3', name: 'Kimi K3', group: 'Other', family: 'Kimi', color: '#f0a3ff', tokenizer: 'o200k_base', pricing: flat(3, 0.3, 15), note: 'o200k_base proxy · approximate' },
  { id: 'mistral-large-3', name: 'Mistral Large 3', group: 'Other', family: 'Mistral', color: '#ffb36b', tokenizer: 'o200k_base', pricing: flat(0.5, 0.05, 1.5), note: 'o200k_base proxy · approximate' },
];
export type Model = ModelSpec;
export const modelGroups: readonly ModelGroup[] = ['Anthropic', 'OpenAI', 'Other'];
// The tier that bills a prompt of `contextTokens`: the highest threshold it exceeds.
export function priceAt(pricing: readonly ModelPrice[], contextTokens: number): ModelPrice {
  return pricing.reduce((best, price) => (price.overContext ?? 0) < contextTokens && (price.overContext ?? 0) >= (best.overContext ?? 0) ? price : best, pricing[0]);
}
export const modelPriceOptions = models.map((model) => ({
  id: model.id,
  name: model.name,
  modelName: model.name,
  color: model.color,
  price: model.pricing[0],
  pricing: model.pricing,
}));
export type ModelPriceOption = (typeof modelPriceOptions)[number];
export const countModelTokens = (text: string, model: Model): number => countTokens(text, model.tokenizer);
export function compareModelTokens(text: string): number[] {
  // Shared backends are evaluated once per input, not once per model row.
  const counts = new Map<TokenizerKind, number>();
  return models.map(model => {
    if (!counts.has(model.tokenizer)) counts.set(model.tokenizer, countTokens(text, model.tokenizer));
    return counts.get(model.tokenizer)!;
  });
}
export const inputCost = (tokens: number, price: ModelPrice): number => tokens * price.input / 1000000;
export function requestCost(
  inputTokens: number,
  cachedInputTokens: number,
  outputTokens: number,
  price: ModelPrice,
  useCachedInputRate: boolean,
): number {
  const cachedRate = useCachedInputRate ? price.cachedInput : price.input;
  return (
    (inputTokens * price.input + cachedInputTokens * cachedRate + outputTokens * price.output) /
    1000000
  );
}
export const samples = {
  prose: 'You are a thoughtful AI assistant. Explain how large language models turn text into tokens, and why every token matters.\n\nUse a simple analogy, keep your answer concise, and include one practical example. Make it something a curious beginner would understand.',
  code: 'async function summarize(document: string) {\n  const sentences = document.split(".");\n  return {\n    summary: sentences.slice(0, 3).join("."),\n    wordCount: document.trim().split(/\\s+/).length,\n  };\n}',
  python: 'async def summarize(document: str):\n  sentences = document.split(".")\n  return {\n    "summary": ".".join(sentences[:3]),\n    "word_count": len(document.split()),\n  }',
  multilingual: 'Hello, world! Bonjour le monde! Hola, mundo!\nこんにちは、世界！ 你好，世界！\n\nГей, десь там, де чорні води\n\nHej sokoły! Omijajcie góry, lasy, doły.',
};
export function visualChunks(text: string): string[] {
  return (text.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) ?? []).flatMap(piece => {
    if (/^\s+$/u.test(piece)) return [piece];
    const chars = Array.from(piece);
    const parts: string[] = [];
    while (chars.length) parts.push(chars.splice(0, 5).join(''));
    return parts;
  });
}
export const contextCapacityOptions = [200000, 500000, 1000000] as const;
export type ContextCapacity = typeof contextCapacityOptions[number];
export const contextReservedBufferRatio = 0.03;
export const reservedContextBuffer = (capacity: number): number => Math.round(capacity * contextReservedBufferRatio);
export const contextAllocationKeys = ['systemPrompt', 'systemTools', 'memoryFiles', 'skills', 'mcpTools', 'conversationHistory', 'toolResults', 'customAgents'] as const;
export type ContextAllocationKey = typeof contextAllocationKeys[number];
export type ContextAllocations = Record<ContextAllocationKey, number>;
export const contextPreset: ContextAllocations = {
  systemPrompt: 7600,
  systemTools: 22800,
  memoryFiles: 4300,
  skills: 2100,
  mcpTools: 10600,
  conversationHistory: 409,
  toolResults: 0,
  customAgents: 281,
};
export const contextColors: Record<ContextAllocationKey | 'freeSpace' | 'reservedBuffer', string> = {
  systemPrompt: '#46c289', systemTools: '#8baffb', memoryFiles: '#e4b342', skills: '#dc5c9a', mcpTools: '#ed7644', conversationHistory: '#a7a69f', toolResults: '#d3743a', customAgents: '#b19aff', freeSpace: 'light-dark(#e6e8f4, #292a37)',
  reservedBuffer: '#858796',
};
export const allocationTotal = (amounts: ContextAllocations): number => contextAllocationKeys.reduce((total, key) => total + amounts[key], 0);
export function fitAllocations(amounts: ContextAllocations, capacity: number): ContextAllocations {
  const values = fitAmounts(contextAllocationKeys.map(key => amounts[key]), capacity);
  return Object.fromEntries(contextAllocationKeys.map((key, index) => [key, values[index]])) as ContextAllocations;
}
export function fitAmounts(amounts: number[], capacity: number): number[] {
  let left = capacity;
  return amounts.map(n => { const next = Math.max(0, Math.min(left, Math.round(Number.isFinite(n) ? n : 0))); left -= next; return next; });
}
export type FlowBootEntry = { id: string; name: string; detail: string; tokens: number; kind: 'observed' | 'system' | 'mcp-catalog' | 'skill-header' };
export const flowBootEntries: FlowBootEntry[] = [
  { id: 'claude-system-prompt', name: 'Claude Code system prompt', detail: 'Observed in this session', tokens: 7800, kind: 'observed' },
  { id: 'system-tools', name: 'System tool headers', detail: 'Simulated active tool definitions', tokens: 10000, kind: 'system' },
  { id: 'mcp-catalog', name: 'MCP tools (deferred)', detail: 'Claude teaching-model catalog header', tokens: 600, kind: 'mcp-catalog' },
  { id: 'code-review-header', name: 'Code review skill header', detail: 'Simulated loaded skill instruction', tokens: 240, kind: 'skill-header' },
  { id: 'summarizer-header', name: 'Summarizer skill header', detail: 'Simulated loaded skill instruction', tokens: 160, kind: 'skill-header' },
];
export const flowCapacityOptions = [64000, 1000000] as const;
export type FlowCapacity = typeof flowCapacityOptions[number];
export const flowCapacity: FlowCapacity = 64000;
export const flowMaxCapacity: FlowCapacity = 1000000;
export const flowBase = flowBootEntries.reduce((total, entry) => total + entry.tokens, 0);
export type FlowEntryKind = 'mcp-schema' | 'mcp-result' | 'skill-result' | 'message';
export type FlowEntry = { id: number; kind: FlowEntryKind; name: string; tokens: number; originalTokens: number; summarized: boolean; toolId?: string; round?: number; cached?: boolean; inputTokens?: number; imageTokens?: number; outputTokens?: number; reasoningTokens?: number; cacheMiss?: boolean };
// Fixed sizes keep the demo repeatable: a 2K prompt (code or logs pasted in), 6K of thinking and a 4K answer.
export const conversationInputTokens = 2000;
export const conversationImageTokens = 1560;
export const conversationImageInputTokens = conversationInputTokens + conversationImageTokens;
export const conversationOutputTokens = 4000;
export const conversationReasoningTokens = 6000;
export const flowMcpTools = {
  search: { schemaTokens: 2400, resultTokens: 1200 },
  database: { schemaTokens: 4800, resultTokens: 2200 },
} as const;
export function flowUsed(entries: FlowEntry[]): number { return flowBase + entries.reduce((sum, e) => sum + e.tokens, 0); }
export function retainCall(entries: FlowEntry[], entry: FlowEntry, capacity: number = flowCapacity): FlowEntry[] | null {
  const next = entries.map(item => ({ ...item, cached: true }));
  return flowUsed(next) + entry.tokens <= capacity ? [...next, { ...entry, cached: false }] : null;
}
export function hasLoadedMcpSchema(entries: FlowEntry[], toolId: string): boolean {
  return entries.some(entry => entry.kind === 'mcp-schema' && entry.toolId === toolId);
}
export function retainConversation(entries: FlowEntry[], entry: FlowEntry, capacity: number = flowCapacity): FlowEntry[] | null {
  const round = Math.max(0, ...entries.filter(item => item.kind === 'message').map(item => item.round ?? 0)) + 1;
  return retainCall(entries, { ...entry, kind: 'message', round, cached: false }, capacity);
}
export type EmulationOptions = { turns?: number; capacity?: number; reasoning?: boolean; startId?: number };
export const emulatedConversationTurns = 50;
// Fast-forwards a session: one conversation round per turn, an MCP call every
// 5th turn (alternating search/database) and a skill result every 10th turn.
// The final turn is a plain conversation round, so the session ends on a message.
export function emulateLongConversation(entries: FlowEntry[], options: EmulationOptions = {}): { entries: FlowEntry[]; turns: number } {
  const { turns = emulatedConversationTurns, capacity = flowMaxCapacity, reasoning = false, startId = Date.now() } = options;
  let next = entries;
  let id = startId;
  let completed = 0;
  const add = (entry: Omit<FlowEntry, 'id' | 'originalTokens' | 'summarized'>, conversation = false): boolean => {
    const full: FlowEntry = { ...entry, id: id++, originalTokens: entry.tokens, summarized: false };
    const result = conversation ? retainConversation(next, full, capacity) : retainCall(next, full, capacity);
    if (!result) return false;
    next = result;
    return true;
  };
  for (let turn = 1; turn <= turns; turn += 1) {
    const snapshot = next;
    if (turn % 5 === 0 && turn < turns) {
      const toolId = (turn / 5) % 2 === 1 ? 'search' : 'database';
      const tool = flowMcpTools[toolId];
      const name = toolId === 'search' ? 'Search documents' : 'Query database';
      if (!hasLoadedMcpSchema(next, toolId) && !add({ kind: 'mcp-schema', name: `${name} schema loaded`, tokens: tool.schemaTokens, toolId })) { next = snapshot; break; }
      if (!add({ kind: 'mcp-result', name, tokens: tool.resultTokens, toolId })) { next = snapshot; break; }
    }
    if (turn % 10 === 0 && turn < turns) {
      const review = (turn / 10) % 2 === 1;
      if (!add({ kind: 'skill-result', name: review ? 'Code review skill' : 'Summarizer skill', tokens: review ? 1800 : 900 })) { next = snapshot; break; }
    }
    const outputTokens = conversationOutputTokens;
    const reasoningTokens = reasoning ? conversationReasoningTokens : 0;
    if (!add({ kind: 'message', name: 'Continue conversation', tokens: conversationInputTokens + outputTokens + reasoningTokens, inputTokens: conversationInputTokens, outputTokens, reasoningTokens: reasoningTokens || undefined }, true)) { next = snapshot; break; }
    completed = turn;
  }
  return { entries: next, turns: completed };
}
// Cache writes cost 1.25x the input rate for the 5-minute TTL (2x for the 1-hour TTL).
export const cacheWriteMultiplier = 1.25;
export type TurnCost = { miss: boolean; contextTokens: number; writeTokens: number; generatedTokens: number; price: ModelPrice; readRate: number; writeRate: number; reread: number; write: number; output: number; total: number; cumulative: number };
// Each retained entry was produced by one request. In a healthy cached loop that request reads the
// prefix already in cache (the snowballing part), writes only the delta (the previous answer plus
// the newly appended input), and generates its own output. A cache miss rewrites the whole prefix.
export function turnCosts(entries: FlowEntry[], pricing: readonly ModelPrice[], useCachedInputRate: boolean): TurnCost[] {
  let retained = flowBase;
  let previousGenerated = 0;
  let cumulative = 0;
  return entries.map(entry => {
    const generated = (entry.outputTokens ?? 0) + (entry.reasoningTokens ?? 0);
    const freshTokens = entry.tokens - generated;
    const price = priceAt(pricing, retained + freshTokens);
    const miss = !!entry.cacheMiss && useCachedInputRate;
    const writeRate = useCachedInputRate ? price.input * cacheWriteMultiplier : price.input;
    const readRate = !useCachedInputRate ? price.input : miss ? writeRate : price.cachedInput;
    const contextTokens = retained - previousGenerated;
    const writeTokens = previousGenerated + freshTokens;
    const reread = contextTokens * readRate / 1000000;
    const write = writeTokens * writeRate / 1000000;
    const output = generated * price.output / 1000000;
    const total = reread + write + output;
    cumulative += total;
    const turn = { miss, contextTokens, writeTokens, generatedTokens: generated, price, readRate, writeRate, reread, write, output, total, cumulative };
    retained += entry.tokens;
    previousGenerated = generated;
    return turn;
  });
}
export function compactEntries(entries: FlowEntry[]): FlowEntry[] {
  if (!entries.length || (entries.length === 1 && entries[0].summarized)) {
    return entries;
  }
  const originalTokens = entries.reduce((total, entry) => total + entry.originalTokens, 0);
  return [{
    id: Date.now(),
    kind: 'skill-result',
    name: 'Session summary',
    tokens: Math.ceil(entries.reduce((total, entry) => total + entry.tokens, 0) * 0.25),
    originalTokens,
    summarized: true,
  }];
}
