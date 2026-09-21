import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, CirclePlay, GitBranch, Pause, RotateCcw, Sparkles } from "lucide-react";
import { createTransformerBlockTrace, normalizeVector } from "./transformerBlockLogic";
import type { TransformerBlockTrace, TransformerMode } from "./transformerBlockLogic";
import { InfoTooltip, SectionLabel, TooltipNote, usePersistentState } from "./ui";

const stages = [
  ["Start with number cards", "INPUT EMBEDDINGS", "Words become tiny cards of numbers. The model works with the numbers, not letters."],
  ["Tidy the cards", "LAYER NORMALIZATION", "Put the numbers on a similar scale, like making every ruler start at zero."],
  ["Borrow useful notes", "CAUSAL SELF-ATTENTION", "Attention lets this word borrow a little information from allowed words."],
  ["Keep the old card", "RESIDUAL CONNECTION", "Add the borrowed notes without throwing away the original card."],
  ["Tidy again", "LAYER NORMALIZATION", "Put the updated card on a steady scale before the pattern machine uses it."],
  ["Try a new pattern", "FEED-FORWARD NETWORK (MLP)", "A small number machine stretches the card, changes it, then makes it short again."],
  ["Keep that result", "RESIDUAL CONNECTION", "Add the changed card too. That is this block's new answer."],
] as const;
type Stored = { mode: TransformerMode; token: number };
const initial: Stored = { mode: "decoder", token: 1 };
const valid = (value: unknown): value is Stored => typeof value === "object" && value !== null && ["encoder", "decoder"].includes((value as Stored).mode) && Number.isInteger((value as Stored).token) && (value as Stored).token >= 0 && (value as Stored).token < 5;
const vector = (values: number[]) => values.map(value => value.toFixed(1)).join("  ");

function NumberStrip({ values, tone = "plain" }: { values: number[]; tone?: "plain" | "mint" | "purple" | "peach" }) {
  return <span className={`number-strip ${tone}`}>{values.map((value, index) => <i key={index}>{value.toFixed(1)}</i>)}</span>;
}

function StageAnimation({ stage, trace, selected }: { stage: number; trace: TransformerBlockTrace; selected: number }) {
  const token = trace.tokens[selected];
  const base = trace.input[selected];
  const borrowed = trace.attentionOutput[selected];
  const afterAttention = trace.firstResidual[selected];
  const changed = trace.mlpOutput[selected];
  const final = trace.output[selected];
  if (stage === 0) return <div className="block-live-view data-live"><p><b>{token}</b> starts with this number card:</p><NumberStrip values={base} tone="mint" /><small>Each number is one tiny feature. Alone, it does not spell out a human-readable meaning.</small></div>;
  if (stage === 1 || stage === 4) {
    const source = stage === 1 ? base : afterAttention;
    return <div className="block-live-view data-live normalize-data"><p><b>{stage === 1 ? "Before attention" : "Before the pattern machine"}:</b> the four values have very different sizes.</p><div><NumberStrip values={source} tone="plain" /><b className="math-arrow">→</b><NumberStrip values={normalizeVector(source)} tone="purple" /></div><small>Normalization recenters and rescales this one card. It does not add words or remove information.</small></div>;
  }
  if (stage === 2) return <div className="block-live-view data-live attention-data"><p><b>{token}</b> collects small shares from the allowed cards:</p><div className="attention-shares">{trace.tokens.map((sourceToken, index) => <span key={sourceToken} className={trace.attention[selected][index].masked ? "masked" : ""}><b>{sourceToken}</b><i style={{ width: `${trace.attention[selected][index].weight * 100}%` }} /><em>{trace.attention[selected][index].masked ? "covered" : `${Math.round(trace.attention[selected][index].weight * 100)}%`}</em></span>)}</div><div className="attention-result"><span>mixed notes</span><NumberStrip values={borrowed} tone="purple" /></div><small>The percentages add to 100%. Each source card is multiplied by its share, then those pieces are added together.</small></div>;
  if (stage === 3) return <div className="block-live-view data-live add-data"><p><b>{token}</b> keeps its own card and adds the borrowed notes:</p><div><NumberStrip values={base} tone="mint" /><b className="math-plus">+</b><NumberStrip values={borrowed} tone="purple" /><b className="math-arrow">→</b><NumberStrip values={afterAttention} tone="peach" /></div><small>For the first slot: {base[0].toFixed(1)} + {borrowed[0].toFixed(1)} = {afterAttention[0].toFixed(1)}. This is why it is called a residual connection.</small></div>;
  if (stage === 5) return <div className="block-live-view data-live mlp-data"><p><b>{token}</b>'s card goes through the pattern machine alone:</p><div><span className="value-count">4 values in</span><NumberStrip values={afterAttention} tone="mint" /><b className="math-arrow">→</b><span className="value-count wide">8 hidden values</span><NumberStrip values={trace.mlpExpanded[selected]} tone="purple" /><b className="math-arrow">→</b><span className="value-count">4 values out</span><NumberStrip values={changed} tone="peach" /></div><small>The MLP tries combinations that attention did not make. It expands to eight working values, applies its rule, then returns four updates.</small></div>;
  return <div className="block-live-view data-live add-data"><p><b>{token}</b> keeps the attention result and adds the pattern-machine update:</p><div><NumberStrip values={afterAttention} tone="mint" /><b className="math-plus">+</b><NumberStrip values={changed} tone="purple" /><b className="math-arrow">→</b><NumberStrip values={final} tone="peach" /></div><small>For the first slot: {afterAttention[0].toFixed(1)} + {changed[0].toFixed(1)} = {final[0].toFixed(1)}. This final card goes to the next Transformer block.</small></div>;
}

function PipelineCard({ active, label, detail, help, onJump }: { active: boolean; label: string; detail: string; help?: ReactNode; onJump: () => void }) {
  return <div className={`block-module ${active ? "active" : ""}`} role="button" tabIndex={0} aria-pressed={active} onClick={onJump} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onJump(); } }}><b>{label}</b><small>{detail}</small>{help}</div>;
}

export default function TransformerBlockLab() {
  const [stored, setStored] = usePersistentState<Stored>("context-lab:transformer-block:v1", initial, valid);
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const trace = useMemo(() => createTransformerBlockTrace(stored.mode), [stored.mode]);
  const selected = Math.min(stored.token, trace.tokens.length - 1);
  const row = trace.attention[selected];
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setStage(current => {
      if (current >= stages.length - 1) { setPlaying(false); return current; }
      return current + 1;
    }), 2200);
    return () => window.clearInterval(timer);
  }, [playing]);
  const setMode = (mode: TransformerMode) => { setStored(current => ({ ...current, mode })); setStage(0); setPlaying(false); };
  const setToken = (token: number) => { setStored(current => ({ ...current, token })); setPlaying(false); };
  const jumpToStage = (nextStage: number) => { setPlaying(false); setStage(nextStage); };
  const shownVector = stage < 3 ? trace.input[selected] : stage < 6 ? trace.firstResidual[selected] : trace.output[selected];
  const officialStage = stage === 2 ? stored.mode === "decoder" ? "CAUSAL SELF-ATTENTION" : "BIDIRECTIONAL SELF-ATTENTION" : stages[stage][1];
  return <>
    <div className="lab-toolbar"><div className="section-kicker"><span className="live-dot mint" /> TRANSFORMER BLOCK</div><span className="badge">SMALL, HONEST EXAMPLE</span></div>
    <section className="transformer-block-stage" aria-label="Animated Transformer block">
      <div className="block-stage-header"><div><span className="field-label">How may a word look?</span><div className="segmented" role="group" aria-label="Transformer architecture"><button type="button" className={`btn ${stored.mode === "encoder" ? "active" : ""}`} aria-pressed={stored.mode === "encoder"} onClick={() => setMode("encoder")}>Encoder</button><button type="button" className={`btn ${stored.mode === "decoder" ? "active" : ""}`} aria-pressed={stored.mode === "decoder"} onClick={() => setMode("decoder")}>Decoder-only</button></div></div><InfoTooltip label="What is the difference?"><div className="learning-popover"><h3>Two ways to look</h3><p><strong>Encoder:</strong> like reading a full sentence at once. A word can use words before and after it.</p><p><strong>Decoder-only:</strong> like guessing the next word with part of a sentence covered up. A word can only use itself and earlier words.</p></div></InfoTooltip></div>
      <div className="block-token-picker" role="group" aria-label="Choose a word to inspect">{trace.tokens.map((token, index) => <button key={token} type="button" className={selected === index ? "selected" : ""} aria-pressed={selected === index} onClick={() => setToken(index)}>{token}</button>)}</div>
      <StageAnimation stage={stage} trace={trace} selected={selected} />
      <div className="transformer-diagram" data-stage={stage}><div className="residual-rail" aria-hidden="true"><span>click a card to jump to its step</span></div><PipelineCard active={stage === 0} label="Number card" detail={`for ${trace.tokens[selected]}`} onJump={() => jumpToStage(0)} /><PipelineCard active={stage === 1} label="Tidy" detail="normalization" onJump={() => jumpToStage(1)} help={<InfoTooltip label="What does tidy mean?"><div className="learning-popover"><h3>Tidy means normalize</h3><p>It makes the numbers in one card easier to compare, like using the same size of measuring cup.</p></div></InfoTooltip>} /><PipelineCard active={stage === 2} label="Borrow notes" detail="self-attention" onJump={() => jumpToStage(2)} help={<InfoTooltip label="What does borrow notes mean?"><div className="learning-popover"><h3>Borrow notes means attention</h3><p>The word gives allowed words a share, then mixes their number cards. It does not mean the model understands words like a person.</p></div></InfoTooltip>} /><PipelineCard active={stage === 3} label="Add" detail="old + new" onJump={() => jumpToStage(3)} help={<InfoTooltip label="Why add?"><div className="learning-popover"><h3>Add keeps a backup</h3><p>The original number card stays useful. The new notes are added instead of replacing it.</p></div></InfoTooltip>} /><PipelineCard active={stage === 4} label="Tidy again" detail="normalization" onJump={() => jumpToStage(4)} /><PipelineCard active={stage === 5} label="Pattern machine" detail="MLP" onJump={() => jumpToStage(5)} help={<InfoTooltip label="What is the pattern machine?"><div className="learning-popover"><h3>Pattern machine means MLP</h3><p>It looks at one number card at a time. It makes the card longer, changes the numbers, then makes it short again.</p></div></InfoTooltip>} /><PipelineCard active={stage === 6} label="Add" detail="new card" onJump={() => jumpToStage(6)} /></div>
      <div className="block-stage-controls"><button type="button" className="icon-btn" aria-label="Previous Transformer stage" title="Previous stage" onClick={() => { setPlaying(false); setStage(value => Math.max(0, value - 1)); }}><ChevronLeft size={16} /></button><button type="button" className="inference-play" aria-label={playing ? "Pause Transformer tour" : "Play Transformer tour"} onClick={() => { if (!playing && stage === stages.length - 1) setStage(0); setPlaying(value => !value); }}>{playing ? <Pause size={15} /> : <CirclePlay size={15} />}{playing ? "Pause tour" : "Play tour"}</button><button type="button" className="icon-btn" aria-label="Next Transformer stage" title="Next stage" onClick={() => { setPlaying(false); setStage(value => Math.min(stages.length - 1, value + 1)); }}><ChevronRight size={16} /></button><button type="button" className="icon-btn" aria-label="Restart Transformer tour" title="Restart tour" onClick={() => { setPlaying(false); setStage(0); }}><RotateCcw size={15} /></button></div>
      <div className="block-stage-copy"><span>STEP {String(stage + 1).padStart(2, "0")}</span><strong>{stages[stage][0]}</strong><em>{officialStage}</em><p>{stages[stage][2]}</p></div>
    </section>
    <div className="transformer-block-layout"><section className="panel block-inspector"><div className="panel-header"><SectionLabel icon={GitBranch}>What {trace.tokens[selected]} may borrow</SectionLabel><span className="badge badge-mint">{stored.mode === "encoder" ? "BOTH SIDES" : "EARLIER ONLY"}</span></div><div className="block-links">{trace.tokens.map((token, key) => <div key={token} className={row[key].masked ? "masked" : ""}><span>{token}</span><i style={{ width: `${row[key].weight * 100}%` }} /><b>{row[key].masked ? "covered" : `${Math.round(row[key].weight * 100)}%`}</b></div>)}</div><p className="inference-note">{stored.mode === "encoder" ? "This word may use words on either side. That helps when reading a whole sentence." : "Later words are covered. The model cannot see the answer before it guesses."}</p></section><section className="panel block-inspector"><div className="panel-header"><SectionLabel icon={Sparkles}>Number card now</SectionLabel><span className="badge">4 NUMBERS</span></div><div className="block-vector"><span>{stage < 3 ? "starting card" : stage < 5 ? "after borrowed notes" : "after pattern machine"}</span><b>{vector(shownVector)}</b></div><div className="block-facts"><span><b>Pattern machine:</b> 4 numbers → {trace.mlpExpanded[selected].length} numbers → 4 numbers</span><span><b>Real models:</b> much bigger cards and many repeated blocks.</span></div></section></div>
    <details className="transformer-deep-dive"><summary>Go deeper: the story behind each part</summary><div><p><strong>Before this block, tokenization already happened.</strong> Tokenization cuts text into small pieces and gives each piece an ID number. Then an embedding turns that ID into a number card. This lab starts at the embedding card so it can focus on one Transformer block.</p><p><strong>Then it can borrow notes.</strong> Attention is a way to decide how much each allowed word should contribute. A bigger percentage means more of that word's number card is mixed in. It is a useful routing signal, not proof of what the model "means."</p><p><strong>Sometimes future words are covered.</strong> An encoder reads the whole sentence, so it can use both sides. A decoder-only model predicts one next word at a time, so later words must stay hidden. Otherwise it could cheat.</p><p><strong>Old cards are kept on purpose.</strong> Each add step combines the old card with a new update. This gives the next block both the old information and the new information.</p><p><strong>The pattern machine works alone on each card.</strong> Its technical name is an MLP. It briefly expands the card, changes the numbers with a rule, then shrinks it back. A full model repeats attention, adds, and pattern machines many times.</p></div></details>
    <TooltipNote>This is a tiny teaching model, not a real model reading or thinking in words. Real Transformer weights are learned from examples and use far more than four numbers.</TooltipNote>
  </>;
}