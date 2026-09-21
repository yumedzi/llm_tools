import { softmax } from "./transformerLogic.ts";

export type TransformerMode = "encoder" | "decoder";
export type BlockAttentionCell = { weight: number; masked: boolean };
export type TransformerBlockTrace = {
  mode: TransformerMode;
  tokens: string[];
  input: number[][];
  attention: BlockAttentionCell[][];
  attentionOutput: number[][];
  firstResidual: number[][];
  mlpExpanded: number[][];
  mlpOutput: number[][];
  output: number[][];
};

export const blockTokens = ["The", "bat", "flew", "at", "night"];

const input = [
  [0.4, -0.3, 0.2, 0.6],
  [0.8, 0.1, -0.5, 0.3],
  [-0.2, 0.7, 0.4, -0.1],
  [0.1, -0.6, 0.6, 0.2],
  [-0.4, 0.3, 0.1, 0.7],
];

export function normalizeVector(vector: number[]) {
  const mean = vector.reduce((total, value) => total + value, 0) / vector.length;
  const variance = vector.reduce((total, value) => total + (value - mean) ** 2, 0) / vector.length;
  return vector.map(value => (value - mean) / Math.sqrt(variance + 0.01));
}

function attentionFor(mode: TransformerMode): BlockAttentionCell[][] {
  return input.map((vector, query) => {
    const scores = input.map((key, keyIndex) => normalizeVector(vector).reduce((total, value, dimension) => total + value * normalizeVector(key)[dimension], 0) / 4 + (query === keyIndex ? 0.35 : 0));
    const visibleIndexes = scores.map((_, key) => key).filter(key => mode === "encoder" || key <= query);
    const weights = softmax(visibleIndexes.map(key => scores[key]));
    return scores.map((_, key) => {
      const visibleIndex = visibleIndexes.indexOf(key);
      return { masked: visibleIndex === -1, weight: visibleIndex === -1 ? 0 : weights[visibleIndex] };
    });
  });
}

function add(left: number[], right: number[]) {
  return left.map((value, index) => value + right[index]);
}

export function createTransformerBlockTrace(mode: TransformerMode): TransformerBlockTrace {
  const attention = attentionFor(mode);
  const attentionOutput = input.map((_, query) => input[0].map((__, dimension) => attention[query].reduce((total, cell, key) => total + cell.weight * input[key][dimension], 0)));
  const firstResidual = input.map((vector, index) => add(vector, attentionOutput[index]));
  const mlpExpanded = firstResidual.map(vector => normalizeVector(vector).flatMap(value => [Math.max(0, value * 0.7 + 0.2), Math.max(0, value * -0.45 + 0.35)]));
  const mlpOutput = mlpExpanded.map(vector => Array.from({ length: 4 }, (_, dimension) => vector.reduce((total, value, index) => total + value * (((index + dimension * 3) % 5) - 2) * 0.12, 0)));
  return {
    mode,
    tokens: blockTokens,
    input,
    attention,
    attentionOutput,
    firstResidual,
    mlpExpanded,
    mlpOutput,
    output: firstResidual.map((vector, index) => add(vector, mlpOutput[index])),
  };
}