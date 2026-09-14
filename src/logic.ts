import { countClaudeTokens, countTokens } from './tokenizers.ts';

export const formatNumber = (n: number) => new Intl.NumberFormat('en-US').format(n);
export const compact = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `${n}`;

// The prompt sandbox uses the same offline ctoc approximation as Claude rows.
export const estimateTokens = countClaudeTokens;
export const wordCount = (s: string) => s.trim() ? (s.trim().match(/\S+/gu) ?? []).length : 0;
export const characterCount = (s: string) => Array.from(s).length;
export type ModelPrice = { label: string; input: number; cachedInput: number; output: number };
export const models = [
  { id: 'fable-5-1', name: 'Fable 5.1', family: 'Claude', color: '#b19aff', tokenizer: 'ctoc', countAdjustment: 1, pricing: [{ label: 'Standard', input: 10, cachedInput: 0.25, output: 50 }], note: 'ctoc proxy · newer-era calibration unavailable' },
  { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', family: 'Claude', color: '#f3ba94', tokenizer: 'ctoc', countAdjustment: 1, pricing: [{ label: 'Standard', input: 2, cachedInput: 0.2, output: 10 }], note: 'ctoc proxy · newer-era calibration unavailable' },
  { id: 'claude-haiku-4.5', name: 'Claude Haiku 4.5', family: 'Claude', color: '#eccba7', tokenizer: 'ctoc', countAdjustment: 0.7, pricing: [{ label: 'Standard', input: 1, cachedInput: 0.1, output: 5 }], note: 'ctoc base · illustrative 30% lower-token calibration' },
  { id: 'gpt-6-astra', name: 'GPT-6 Astra', family: 'OpenAI', color: '#74c5ff', tokenizer: 'o200k_base', countAdjustment: 1, pricing: [{ label: 'Standard', input: 10, cachedInput: 1, output: 50 }], note: 'js-tiktoken · o200k_base proxy · approximate' },
  { id: 'gpt-5-6-family', name: 'GPT 5.6 (Sol / Terra / Luna)', family: 'OpenAI', color: '#90d9c1', tokenizer: 'o200k_base', countAdjustment: 1, pricing: [{ label: 'Sol', input: 4, cachedInput: 0.4, output: 20 }, { label: 'Terra', input: 2, cachedInput: 0.2, output: 12 }, { label: 'Luna', input: 0.2, cachedInput: 0.02, output: 1.2 }], note: 'js-tiktoken · o200k_base · plain-text count' },
  { id: 'grok-4.6', name: 'Grok 4.6', family: 'Grok', color: '#8baffb', tokenizer: 'o200k_base', countAdjustment: 1, pricing: [{ label: 'Under 200K context', input: 2, cachedInput: 0.5, output: 6 }], note: 'js-tiktoken · o200k_base proxy · approximate' },
  // Disabled for now: only Claude, OpenAI, and Grok are shown.
  // { id: 'deepseek-flash-4.1', name: 'DeepSeek Flash 4.1', family: 'DeepSeek', color: '#8baffb', rate: 0.14 },
] as const;
export type Model = typeof models[number];
export const modelPriceOptions = models.flatMap((model) =>
  model.pricing.map((price) => ({
    id: `${model.id}-${price.label}`,
    name: model.pricing.length === 1 ? model.name : price.label,
    modelName: model.name,
    color: model.color,
    price,
  })),
);
export type ModelPriceOption = (typeof modelPriceOptions)[number];
export const countModelTokens = (text: string, model: Model): number => Math.ceil(countTokens(text, model.tokenizer) * model.countAdjustment);
export function compareModelTokens(text: string): number[] {
  // Shared backends are evaluated once per input, not once per model row.
  const counts = new Map<string, number>();
  return models.map(model => {
    if (!counts.has(model.tokenizer)) counts.set(model.tokenizer, countTokens(text, model.tokenizer));
    return Math.ceil(counts.get(model.tokenizer)! * model.countAdjustment);
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
  multilingual: 'Hello, world! Bonjour le monde! Hola, mundo!\nこんにちは、世界！ 你好，世界！\n\nThe same idea can take a different number of tokens in every language. Compare scripts, punctuation, and whitespace.',
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
  systemPrompt: '#46c289', systemTools: '#8baffb', memoryFiles: '#e4b342', skills: '#dc5c9a', mcpTools: '#ed7644', conversationHistory: '#a7a69f', toolResults: '#d3743a', customAgents: '#b19aff', freeSpace: '#292a37',
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
export const flowCapacity = 64000;
export const flowBase = flowBootEntries.reduce((total, entry) => total + entry.tokens, 0);
export type FlowEntryKind = 'mcp-schema' | 'mcp-result' | 'skill-result' | 'message';
export type FlowEntry = { id: number; kind: FlowEntryKind; name: string; tokens: number; originalTokens: number; summarized: boolean; toolId?: string; round?: number; cached?: boolean; inputTokens?: number; imageTokens?: number; outputTokens?: number; reasoningTokens?: number };
export const conversationInputTokens = 600;
export const conversationImageTokens = 1560;
export const conversationImageInputTokens = conversationInputTokens + conversationImageTokens;
export const conversationReasoningMinTokens = 800;
export const conversationReasoningMaxTokens = 1600;
export function conversationReasoningTokens(random = Math.random): number {
  return conversationReasoningMinTokens + Math.floor(
    Math.max(0, Math.min(0.999999, random())) *
      (conversationReasoningMaxTokens - conversationReasoningMinTokens + 1),
  );
}
export function conversationOutputTokens(random = Math.random): number {
  return 2000 + Math.floor(Math.max(0, Math.min(0.999999, random())) * 1001);
}
export const flowMcpTools = {
  search: { schemaTokens: 2400, resultTokens: 2400 },
  database: { schemaTokens: 4800, resultTokens: 4800 },
} as const;
export function flowUsed(entries: FlowEntry[]): number { return flowBase + entries.reduce((sum, e) => sum + e.tokens, 0); }
export function retainCall(entries: FlowEntry[], entry: FlowEntry): FlowEntry[] | null {
  return flowUsed(entries) + entry.tokens <= flowCapacity ? [...entries, entry] : null;
}
export function hasLoadedMcpSchema(entries: FlowEntry[], toolId: string): boolean {
  return entries.some(entry => entry.kind === 'mcp-schema' && entry.toolId === toolId);
}
export function retainConversation(entries: FlowEntry[], entry: FlowEntry): FlowEntry[] | null {
  const round = Math.max(0, ...entries.filter(item => item.kind === 'message').map(item => item.round ?? 0)) + 1;
  const next = entries.map(item => item.kind === 'message' ? { ...item, cached: true } : item);
  return retainCall(next, { ...entry, kind: 'message', round, cached: false });
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
