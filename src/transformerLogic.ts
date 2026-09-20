export type TransformerPresetId = "capital" | "agreement" | "coreference";
export type TransformerPreset = {
  id: TransformerPresetId;
  label: string;
  tokens: string[];
  candidates: string[];
  expected: string;
  note: string;
};

export const transformerPresets: TransformerPreset[] = [
  {
    id: "capital",
    label: "Capital city",
    tokens: ["The", "capital", "of", "France", "is"],
    candidates: ["Paris", "France", "London", "a", "the"],
    expected: "Paris",
    note: "The final token can route strongly to France while preparing a city completion.",
  },
  {
    id: "agreement",
    label: "Subject agreement",
    tokens: ["The", "keys", "to", "the", "cabinet", "are"],
    candidates: ["missing", "are", "key", "cabinet", "is"],
    expected: "missing",
    note: "A head can connect the continuation to the plural subject instead of the nearest noun.",
  },
  {
    id: "coreference",
    label: "Coreference",
    tokens: ["Maya", "gave", "Lina", "her", "notebook"],
    candidates: ["because", "to", "Maya", "it", "Lina"],
    expected: "because",
    note: "Different heads can keep distinct possible links between names and pronouns.",
  },
];

export const transformerDimensions = { embedding: 4, heads: 2, layers: 2 } as const;
export type AttentionCell = { score: number; weight: number; masked: boolean };
export type AttentionHead = { name: string; cells: AttentionCell[][] };
export type Candidate = { token: string; logit: number; probability: number };
export type TransformerTrace = {
  preset: TransformerPreset;
  embeddings: number[][];
  positioned: number[][];
  heads: AttentionHead[];
  mixed: number[][];
  residual: number[][];
  candidates: Candidate[];
};

function hash(value: string): number {
  return Array.from(value).reduce((total, char, index) => (total * 31 + char.codePointAt(0)! * (index + 3)) >>> 0, 2166136261);
}
function vectorFor(token: string, position: number): number[] {
  const base = hash(token);
  return Array.from({ length: transformerDimensions.embedding }, (_, index) => (((base >>> (index * 7)) & 31) / 31 - 0.5) * 1.5 + Math.sin((position + 1) * (index + 1)) * 0.18);
}
export function dot(left: number[], right: number[]): number {
  return left.reduce((total, value, index) => total + value * (right[index] ?? 0), 0);
}
export function softmax(values: number[]): number[] {
  const maximum = Math.max(...values);
  const exponentials = values.map(value => Math.exp(value - maximum));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  return exponentials.map(value => value / total);
}
export function causalAttention(scores: number[][]): AttentionCell[][] {
  return scores.map((row, query) => {
    const visible = row.map((score, key) => key <= query ? score : Number.NEGATIVE_INFINITY);
    const weights = softmax(visible.slice(0, query + 1));
    return row.map((score, key) => ({ score, masked: key > query, weight: key > query ? 0 : weights[key] }));
  });
}
function project(vector: number[], head: number, kind: "q" | "k" | "v"): number[] {
  const offsets = { q: [1.1, 0.8, -0.3, 0.4], k: [0.5, 1.2, 0.3, -0.6], v: [0.9, -0.2, 1.1, 0.35] }[kind];
  return vector.map((value, index) => value * offsets[(index + head) % offsets.length] + vector[(index + head + 1) % vector.length] * 0.25);
}
function logitsFor(preset: TransformerPreset, finalVector: number[]): number[] {
  const expectedIndex = preset.candidates.indexOf(preset.expected);
  return preset.candidates.map((_, index) => (index === expectedIndex ? 3.2 : 0.7 - index * 0.32) + dot(finalVector, [0.3, -0.15, 0.12, 0.08]) * (index === expectedIndex ? 0.24 : 0.05));
}
export function createTransformerTrace(id: TransformerPresetId): TransformerTrace {
  const preset = transformerPresets.find(item => item.id === id) ?? transformerPresets[0];
  const embeddings = preset.tokens.map((token, index) => vectorFor(token, index));
  const positioned = embeddings.map((vector, position) => vector.map((value, index) => value + Math.sin((position + 1) / Math.pow(10000, index / transformerDimensions.embedding)) * 0.22));
  const heads = Array.from({ length: transformerDimensions.heads }, (_, head) => {
    const queries = positioned.map(vector => project(vector, head, "q"));
    const keys = positioned.map(vector => project(vector, head, "k"));
    const scores = queries.map(query => keys.map(key => dot(query, key) / Math.sqrt(transformerDimensions.embedding)));
    return { name: `Head ${head + 1}`, cells: causalAttention(scores) };
  });
  const values = positioned.map(vector => project(vector, 0, "v"));
  const mixed = positioned.map((_, query) => values[0].map((__, dimension) => heads.reduce((total, head) => total + head.cells[query].reduce((sum, cell, key) => sum + cell.weight * values[key][dimension], 0), 0) / heads.length));
  const residual = mixed.map((vector, index) => vector.map((value, dimension) => Math.tanh(value + positioned[index][dimension])));
  const candidates = preset.candidates.map((token, index) => ({ token, logit: logitsFor(preset, residual.at(-1)!)[index], probability: 0 }));
  const probabilities = softmax(candidates.map(candidate => candidate.logit));
  return { preset, embeddings, positioned, heads, mixed, residual, candidates: candidates.map((candidate, index) => ({ ...candidate, probability: probabilities[index] })) };
}

export function decodeCandidates(candidates: Candidate[], temperature = 1, topK = candidates.length): Candidate[] {
  const ranked = [...candidates].sort((left, right) => right.logit - left.logit).slice(0, Math.max(1, Math.min(topK, candidates.length)));
  const probabilities = softmax(ranked.map(candidate => candidate.logit / Math.max(0.1, temperature)));
  return ranked.map((candidate, index) => ({ ...candidate, probability: probabilities[index] }));
}
export function seededSample(candidates: Candidate[], seed: number): Candidate {
  const normalized = ((seed * 9301 + 49297) % 233280) / 233280;
  let cumulative = 0;
  return candidates.find(candidate => (cumulative += candidate.probability) >= normalized) ?? candidates.at(-1)!;
}