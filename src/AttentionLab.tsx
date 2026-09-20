import { Fragment, useMemo, useState } from "react";
import { Eye, Grid2X2, Network, RotateCcw } from "lucide-react";
import { createTransformerTrace, transformerPresets } from "./transformerLogic";
import type { TransformerPresetId } from "./transformerLogic";
import { InfoTooltip, SectionLabel, TooltipNote, usePersistentState } from "./ui";

type Stored = { preset: TransformerPresetId; head: number };
const initial: Stored = { preset: "capital", head: 0 };
const valid = (value: unknown): value is Stored => typeof value === "object" && value !== null && ["capital", "agreement", "coreference"].includes((value as Stored).preset) && [0, 1].includes((value as Stored).head);

export default function AttentionLab() {
  const [stored, setStored] = usePersistentState<Stored>("context-lab:attention:v1", initial, valid);
  const [view, setView] = useState<"weights" | "scores">("weights"); const [query, setQuery] = useState<number | null>(null);
  const trace = useMemo(() => createTransformerTrace(stored.preset), [stored.preset]);
  const head = trace.heads[stored.head];
  const selected = query ?? trace.preset.tokens.length - 1;
  return <>
    <div className="lab-toolbar"><div className="section-kicker"><span className="live-dot mint" /> CONTEXTUAL ROUTING</div><span className="badge">CAUSAL SELF-ATTENTION</span></div>
    <div className="attention-layout">
      <section className="panel attention-matrix-panel">
        <div className="panel-header"><SectionLabel icon={Grid2X2}>Who looks where?</SectionLabel><div className="attention-header-actions"><InfoTooltip label="Explain attention matrix"><div className="learning-popover"><h3>Reading this matrix</h3><p><strong>Rows are queries:</strong> the token currently gathering context.</p><p><strong>Columns are keys:</strong> earlier tokens it can look at. The cell value becomes a weight after softmax.</p><p><strong>Masked cells</strong> are future tokens. They are blocked so the model cannot peek ahead while generating.</p><p>Use <strong>Scores</strong> to see raw compatibility before softmax; use <strong>Weights</strong> to see the final shares that sum to $1$ in each allowed row.</p></div></InfoTooltip><div className="segmented" role="group" aria-label="Attention display"><button className={`btn ${view === "weights" ? "active" : ""}`} type="button" onClick={() => setView("weights")}>Weights</button><button className={`btn ${view === "scores" ? "active" : ""}`} type="button" onClick={() => setView("scores")}>Scores</button></div></div></div>
        <div className="attention-controls"><label>Trace<select aria-label="Attention teaching trace" value={stored.preset} onChange={event => { setStored(current => ({ ...current, preset: event.target.value as TransformerPresetId })); setQuery(null); }}>{transformerPresets.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select></label><label>Head<select aria-label="Attention head" value={stored.head} onChange={event => setStored(current => ({ ...current, head: Number(event.target.value) }))}><option value={0}>Head 1</option><option value={1}>Head 2</option></select></label></div>
        <div className="attention-scroll"><div className="attention-grid" style={{ gridTemplateColumns: `74px repeat(${trace.preset.tokens.length}, minmax(49px, 1fr))` }}><span className="attention-corner">Q \ K</span>{trace.preset.tokens.map((token, index) => <span className="attention-axis" key={`key-${index}`}>{token}</span>)}{head.cells.map((row, rowIndex) => <Fragment key={`row-${rowIndex}`}><button type="button" className={`attention-axis attention-query ${selected === rowIndex ? "selected" : ""}`} onClick={() => setQuery(rowIndex)}>{trace.preset.tokens[rowIndex]}</button>{row.map((cell, columnIndex) => { const amount = view === "weights" ? cell.weight : Math.max(0, (cell.score + 1.8) / 4); return <button key={`${rowIndex}-${columnIndex}`} type="button" aria-label={`${trace.preset.tokens[rowIndex]} attends to ${trace.preset.tokens[columnIndex]}: ${cell.masked ? "masked" : `${(cell.weight * 100).toFixed(1)} percent`}`} className={`attention-cell ${cell.masked ? "masked" : ""} ${selected === rowIndex ? "active-row" : ""}`} style={{ "--attention": amount } as React.CSSProperties} onFocus={() => setQuery(rowIndex)} onClick={() => setQuery(rowIndex)}>{cell.masked ? "×" : view === "weights" ? `${Math.round(cell.weight * 100)}` : cell.score.toFixed(1)}</button>; })}</Fragment>)}</div></div>
      </section>
      <section className="panel attention-explainer">
        <div className="panel-header"><SectionLabel icon={Network}>Inspect a query</SectionLabel><span className="badge badge-mint">{head.name.toUpperCase()}</span></div>
        <div className="attention-inspector"><p><b>{trace.preset.tokens[selected]}</b> is the query. Its row can only see itself and earlier keys.</p><div className="attention-links">{head.cells[selected].map((cell, key) => !cell.masked && <div key={key} style={{ "--weight": cell.weight } as React.CSSProperties}><span>{trace.preset.tokens[key]}</span><i /><b>{(cell.weight * 100).toFixed(1)}%</b></div>)}</div><div className="attention-equation"><span>score</span><strong>Q · K / sqrt(d)</strong><span>then</span><strong>softmax</strong></div><button type="button" className="btn btn-ghost" onClick={() => setQuery(trace.preset.tokens.length - 1)}><RotateCcw size={14} /> Reset to final token</button></div>
      </section>
    </div>
    <section className="attention-takeaway"><Eye size={17} /><div><strong>Attention is routing, not a verdict.</strong><p>A high cell says this head mixed more of one token's value into another token's representation. Other heads and later MLPs can change what happens next.</p></div></section>
    <TooltipNote>Rows are queries and columns are keys. The upper-right triangle is blocked by the causal mask, so a token cannot attend to future text while generating.</TooltipNote>
  </>;
}