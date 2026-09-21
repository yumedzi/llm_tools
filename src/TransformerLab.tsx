import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight, CirclePlay, Cpu, Pause, RotateCcw, Sparkles } from "lucide-react";
import { createTransformerTrace, decodeCandidates, seededSample, transformerPresets } from "./transformerLogic";
import type { Candidate, TransformerPresetId } from "./transformerLogic";
import { InfoTooltip, SectionLabel, TooltipNote, usePersistentState } from "./ui";

const stages = [
  ["Tokenize", "Words become discrete IDs the network can process."],
  ["Embed", "Each ID becomes a compact vector, then receives position information."],
  ["Attend", "Each token routes information from earlier tokens through a causal mask."],
  ["Transform", "A small MLP and residual path refine the mixed representation."],
  ["Predict", "The final vector scores every vocabulary candidate as a logit."],
  ["Decode", "Temperature and top-k turn logits into a next-token distribution."],
] as const;
const stageDuration = 2800;
const stageHelp = [
  <><strong>Tokens are labels, not meanings.</strong><p>The model first turns each text piece into an integer ID. Here, <code>The</code> and <code>keys</code> are separate entries in a vocabulary table.</p><p>The IDs only identify rows. The next stage supplies useful numeric features.</p></>,
  <><strong>Embeddings give token IDs usable features.</strong><p>Each token ID selects a small vector of numbers. A position signal is added so the model can distinguish <code>keys are</code> from <code>are keys</code>.</p><p>Real models use far more dimensions; this lab keeps four visible.</p></>,
  <><strong>Attention lets each position collect earlier context.</strong><p>For a query position, the model scores every allowed earlier token, turns scores into weights, then mixes their value vectors.</p><p>The causal mask blocks future tokens. A token can always include itself.</p></>,
  <><strong>The MLP transforms what attention collected.</strong><p>Attention routes information between positions. This small feed-forward network transforms the features at each position independently.</p><p>The middle layer expands the vector, applies a non-linearity, then projects it back.</p></>,
  <><strong>Logits are unnormalized candidate scores.</strong><p>The final hidden state is compared against every vocabulary entry. Bigger logits mean the decoder currently prefers that candidate.</p><p>They are not probabilities yet; negative and positive values are both valid.</p></>,
  <><strong>Decoding chooses the next token.</strong><p>Softmax turns logits into probabilities. Temperature changes how sharp the distribution is, while top-k discards lower-ranked candidates.</p><p>The seed makes this toy sampler reproducible. A real model repeats this loop to generate more text.</p></>,
] as const;
type LabState = { preset: TransformerPresetId; temperature: number; topK: number; seed: number };
const initial: LabState = { preset: "capital", temperature: 0.8, topK: 3, seed: 42 };
const validState = (value: unknown): value is LabState => typeof value === "object" && value !== null && ["capital", "agreement", "coreference", "three-relations"].includes((value as LabState).preset) && Number.isFinite((value as LabState).temperature) && Number.isFinite((value as LabState).topK) && Number.isFinite((value as LabState).seed);

function InferenceCanvas({ stage, tokens, candidates }: { stage: number; tokens: string[]; candidates: Candidate[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const context = element.getContext("2d");
    if (!context) return;
    let frame = 0;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const draw = (time = 0) => {
      const box = element.getBoundingClientRect();
      const pixelRatio = Math.min(devicePixelRatio || 1, 2);
      element.width = Math.max(1, Math.round(box.width * pixelRatio)); element.height = Math.max(1, Math.round(box.height * pixelRatio));
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0); context.clearRect(0, 0, box.width, box.height);
      const headerY = 34;
      const contentTop = 78;
      const contentBottom = box.height - 14;
      const centerY = (contentTop + contentBottom) / 2;
      const leftX = Math.max(104, box.width * 0.22); const rightX = Math.min(box.width - 104, box.width * 0.78);
      const nodeY = (index: number) => contentTop + index * Math.min(31, (contentBottom - contentTop) / Math.max(1, tokens.length - 1));
      context.fillStyle = "rgba(139,175,251,.035)";
      for (let x = 0; x < box.width; x += 24) context.fillRect(x, 0, 1, box.height);
      for (let y = 0; y < box.height; y += 24) context.fillRect(0, y, box.width, 1);
      const chip = (x: number, y: number, label: string, color: string) => { context.fillStyle = color; context.fillRect(x - 29, y - 12, 58, 24); context.fillStyle = "#11131a"; context.font = "9px monospace"; context.textAlign = "center"; context.fillText(label, x, y + 3); };
      const particle = (x: number, y: number, color: string, radius = 2) => { context.fillStyle = color; context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill(); };
      if (stage === 0) {
        tokens.forEach((token, index) => { const x = 72 + index * ((box.width - 144) / Math.max(1, tokens.length - 1)); chip(x, centerY, token, index === tokens.length - 1 ? "#f3ba94" : "#90d9c1"); context.fillStyle = "#888c9e"; context.textAlign = "center"; context.font = "8px monospace"; context.fillText(`ID ${index + 1}`, x, centerY + 32); });
        context.fillStyle = "#9fa3b5"; context.textAlign = "center"; context.font = "11px monospace"; context.fillText("text pieces → token IDs", box.width / 2, headerY);
      } else if (stage === 1) {
        tokens.forEach((token, tokenIndex) => { const x = 74 + tokenIndex * ((box.width - 148) / Math.max(1, tokens.length - 1)); context.fillStyle = "#a4e6d1"; context.font = "9px monospace"; context.textAlign = "center"; context.fillText(token, x, contentTop); for (let dimension = 0; dimension < 4; dimension += 1) { const value = ((tokenIndex * 3 + dimension * 5) % 9) / 9; context.fillStyle = `rgba(139,175,251,${0.18 + value * 0.72})`; context.fillRect(x - 14 + dimension * 8, centerY - 20, 6, 40); } context.fillStyle = "#f3ba94"; context.fillRect(x - 18, centerY + 27, 36, 5); });
        context.fillStyle = "#9fa3b5"; context.textAlign = "center"; context.font = "11px monospace"; context.fillText("token embedding + position signal", box.width / 2, headerY);
      } else if (stage === 2) {
        for (let query = 0; query < tokens.length; query += 1) for (let key = 0; key <= query; key += 1) { const strength = key === query ? 0.85 : 0.18 + ((query * 7 + key * 3) % 7) / 18; context.strokeStyle = `rgba(${key === query ? "144,217,193" : "177,154,255"},${strength})`; context.lineWidth = key === query ? 1.8 : 0.8; context.beginPath(); context.moveTo(leftX + 13, nodeY(key)); context.lineTo(rightX - 13, nodeY(query)); context.stroke(); if (!reducedMotion && (query + key) % 2 === 0) { const progress = (time / 1500 + query * 0.19 + key * 0.11) % 1; particle(leftX + 13 + (rightX - leftX - 26) * progress, nodeY(key) + (nodeY(query) - nodeY(key)) * progress, key === query ? "#f3ba94" : "#b19aff", key === query ? 2.5 : 1.7); } }
        tokens.forEach((token, index) => { [[leftX, "#90d9c1"], [rightX, "#f3ba94"]].forEach(([x, color]) => { particle(x as number, nodeY(index), color as string, 11); context.fillStyle = "#11131a"; context.font = "9px monospace"; context.textAlign = "center"; context.fillText(String(index + 1).padStart(2, "0"), x as number, nodeY(index) + 3); context.fillStyle = color as string; context.textAlign = x === leftX ? "right" : "left"; context.fillText(token, (x as number) + (x === leftX ? -16 : 16), nodeY(index) + 3); }); });
        context.fillStyle = "#d7c6ff"; context.textAlign = "center"; context.font = "11px monospace"; context.fillText("each query mixes earlier token values", box.width / 2, headerY);
      } else if (stage === 3) {
        const columns = [box.width * 0.25, box.width * 0.5, box.width * 0.75]; const counts = [4, 7, 4];
        columns.forEach((x, column) => { for (let node = 0; node < counts[column]; node += 1) { const y = centerY + (node - (counts[column] - 1) / 2) * 24; if (column > 0) for (let prior = 0; prior < counts[column - 1]; prior += 1) { const priorY = centerY + (prior - (counts[column - 1] - 1) / 2) * 24; context.strokeStyle = "rgba(139,175,251,.18)"; context.lineWidth = .7; context.beginPath(); context.moveTo(columns[column - 1] + 6, priorY); context.lineTo(x - 6, y); context.stroke(); if (!reducedMotion && (node + prior + column) % 3 === 0) { const flow = (time / 1150 + node * .16 + prior * .09) % 1; particle(columns[column - 1] + 6 + (x - columns[column - 1] - 12) * flow, priorY + (y - priorY) * flow, column === 1 ? "#f3ba94" : "#90d9c1", 2.2); } } const pulse = column === 1 && !reducedMotion ? 5.5 + Math.sin(time / 260 + node) * 1.6 : 6; particle(x, y, column === 1 ? "#b19aff" : "#90d9c1", pulse); } });
        context.fillStyle = "#9fa3b5"; context.textAlign = "center"; context.font = "11px monospace"; context.fillText("MLP expands features, applies non-linearity, then projects back", box.width / 2, headerY);
      } else if (stage === 4) {
        const ranked = [...candidates].sort((left, right) => right.logit - left.logit); const maxLogit = ranked[0]?.logit ?? 1; ranked.forEach((candidate, index) => { const x = box.width * .28; const y = 76 + index * 29; const width = Math.max(26, (candidate.logit / maxLogit) * box.width * .36); context.fillStyle = index === 0 ? "#f3ba94" : "#8baffb"; context.fillRect(x, y, width, 15); context.fillStyle = "#e6e4ec"; context.textAlign = "right"; context.font = "10px monospace"; context.fillText(candidate.token, x - 10, y + 11); context.fillStyle = "#9fa3b5"; context.textAlign = "left"; context.fillText(candidate.logit.toFixed(1), x + width + 8, y + 11); });
        context.fillStyle = "#9fa3b5"; context.textAlign = "center"; context.font = "11px monospace"; context.fillText("final hidden state → vocabulary logits", box.width / 2, headerY);
      } else {
        const ranked = [...candidates].sort((left, right) => right.probability - left.probability).slice(0, 3); ranked.forEach((candidate, index) => { const x = box.width * .23 + index * box.width * .22; const height = candidate.probability * 105; context.fillStyle = index === 0 ? "#90d9c1" : "#b19aff"; context.fillRect(x, centerY + 50 - height, 58, height); context.fillStyle = "#e6e4ec"; context.font = "10px monospace"; context.textAlign = "center"; context.fillText(candidate.token, x + 29, centerY + 69); context.fillText(`${Math.round(candidate.probability * 100)}%`, x + 29, centerY + 42 - height); });
        context.fillStyle = "#9fa3b5"; context.textAlign = "center"; context.font = "11px monospace"; context.fillText("softmax distribution → sampled next token", box.width / 2, headerY);
      }
      if (!reducedMotion) frame = requestAnimationFrame(draw);
    };
    draw(); const observer = new ResizeObserver(() => draw()); observer.observe(element); return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [stage, tokens, candidates]);
  return <canvas ref={canvas} className="inference-canvas" aria-label={`Inference pipeline, stage ${stage + 1}: ${stages[stage][0]}`} role="img" />;
}

export default function TransformerLab() {
  const [settings, setSettings] = usePersistentState<LabState>("context-lab:transformer:v1", initial, validState);
  const [stage, setStage] = useState(0); const [playing, setPlaying] = useState(false); const [progress, setProgress] = useState(0);
  const trace = useMemo(() => createTransformerTrace(settings.preset), [settings.preset]);
  const decoded = useMemo(() => decodeCandidates(trace.candidates, settings.temperature, settings.topK), [trace, settings.temperature, settings.topK]);
  const chosen = seededSample(decoded, settings.seed);
  useEffect(() => {
    if (!playing) { setProgress(0); return; }
    let frame = 0;
    let startedAt = performance.now();
    const advance = (now: number) => {
      const elapsed = now - startedAt;
      setProgress(Math.min(1, elapsed / stageDuration));
      if (elapsed >= stageDuration) {
        setStage(current => {
          if (current >= stages.length - 1) { setPlaying(false); return current; }
          return current + 1;
        });
        startedAt = now;
        setProgress(0);
      }
      frame = requestAnimationFrame(advance);
    };
    frame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  return <>
    <div className="lab-toolbar"><div className="section-kicker"><span className="live-dot mint" /> DECODER TRANSFORMER</div><span className="badge">DETERMINISTIC TOY TRACE</span></div>
    <section className="inference-stage" aria-label="Next token inference pipeline">
      <InferenceCanvas stage={stage} tokens={trace.preset.tokens} candidates={decoded} />
      <div className="inference-stage-controls">
        <InfoTooltip label={`Explain ${stages[stage][0]}`}><div className="learning-popover"><h3>{stages[stage][0]}</h3>{stageHelp[stage]}</div></InfoTooltip>
        <button className="icon-btn" type="button" title="Previous stage" aria-label="Previous stage" onClick={() => setStage(value => Math.max(0, value - 1))}><ChevronLeft size={16} /></button>
        <button className="inference-play" type="button" aria-label={playing ? `Pause tour, ${Math.ceil((1 - progress) * stageDuration / 1000)} seconds to next stage` : "Play tour"} onClick={() => { if (!playing && stage >= stages.length - 1) setStage(0); setPlaying(value => !value); }}><span className="tour-progress" style={{ "--tour-progress": progress } as CSSProperties} />{playing ? <Pause size={15} /> : <CirclePlay size={15} />}{playing ? `Next in ${Math.ceil((1 - progress) * stageDuration / 1000)}s` : "Play tour"}</button>
        <button className="icon-btn" type="button" title="Next stage" aria-label="Next stage" onClick={() => setStage(value => Math.min(stages.length - 1, value + 1))}><ChevronRight size={16} /></button>
      </div>
      <div className="inference-stage-copy"><span>STAGE {String(stage + 1).padStart(2, "0")}</span><strong>{stages[stage][0]}</strong><p>{stages[stage][1]}</p></div>
      {stage === stages.length - 1 && <div className="generation-result"><span>GENERATED NEXT TOKEN</span><strong>{chosen.token}</strong><small>sample #{settings.seed} · top {settings.topK} · temperature {settings.temperature.toFixed(1)}</small></div>}
    </section>
    <div className="inference-layout">
      <section className="panel inference-panel">
        <div className="panel-header"><SectionLabel icon={Cpu}>The input stream</SectionLabel><span className="badge badge-mint">{trace.preset.tokens.length} TOKENS</span></div>
        <div className="inference-body">
          <label className="field-label">Teaching trace<select aria-label="Teaching trace" value={settings.preset} onChange={event => { setSettings(current => ({ ...current, preset: event.target.value as TransformerPresetId })); setStage(0); }}>{transformerPresets.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select></label>
          <div className="token-stream">{trace.preset.tokens.map((token, index) => <span key={`${token}-${index}`} className={index === trace.preset.tokens.length - 1 ? "current" : ""}><small>{index}</small>{token}</span>)}</div>
          <p className="inference-note">{trace.preset.note}</p>
          <div className="vector-preview"><span>final hidden state</span>{trace.residual.at(-1)!.map((value, index) => <b key={index}>{value.toFixed(2)}</b>)}</div>
        </div>
      </section>
      <section className="panel inference-panel">
        <div className="panel-header"><SectionLabel icon={Sparkles}>Decode the logits</SectionLabel><span className="badge">{chosen.token.toUpperCase()}</span></div>
        <div className="inference-body">
          <label className="field-label">Temperature <output>{settings.temperature.toFixed(1)}</output><input aria-label="Sampling temperature" type="range" min="0.2" max="1.6" step="0.1" value={settings.temperature} onChange={event => setSettings(current => ({ ...current, temperature: Number(event.target.value) }))} /></label>
          <label className="field-label">Top candidates <select aria-label="Top candidates" value={settings.topK} onChange={event => setSettings(current => ({ ...current, topK: Number(event.target.value) }))}>{[1, 2, 3, 5].map(value => <option key={value} value={value}>top {value}</option>)}</select></label>
          <div className="candidate-list">{decoded.map(candidate => <div key={candidate.token}><span>{candidate.token}</span><i style={{ width: `${candidate.probability * 100}%` }} /><b>{(candidate.probability * 100).toFixed(1)}%</b></div>)}</div>
          <button type="button" className="btn btn-ghost" onClick={() => setSettings(current => ({ ...current, seed: current.seed + 1 }))}><RotateCcw size={14} /> Sample again <span className="mono">#{settings.seed}</span></button>
        </div>
      </section>
    </div>
    <TooltipNote>This is a deliberately tiny, deterministic decoder transformer. The operations are real; its learned-looking weights and vocabulary are teaching data, not a trace from a production model.</TooltipNote>
  </>;
}