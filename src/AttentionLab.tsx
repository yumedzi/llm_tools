import { Fragment, useMemo, useState } from "react";
import { Eye, Grid2X2, Network, RotateCcw } from "lucide-react";
import { createTransformerTrace, transformerPresets } from "./transformerLogic";
import type { TransformerPresetId } from "./transformerLogic";
import { InfoTooltip, SectionLabel, TooltipNote, usePersistentState } from "./ui";

type Stored = { preset: TransformerPresetId; head: number };
const initial: Stored = { preset: "capital", head: 0 };
const valid = (value: unknown): value is Stored => typeof value === "object" && value !== null && ["capital", "agreement", "coreference", "three-relations"].includes((value as Stored).preset) && [0, 1, 2].includes((value as Stored).head);
const headLessons: Record<TransformerPresetId, string[]> = {
  capital: ["This head follows the country-to-capital relationship.", "This head follows the phrase structure in “of France”."],
  agreement: ["This head reaches back to the plural subject, “keys”.", "This head follows the nearby noun, “cabinet”, instead."],
  coreference: ["This head links “her” more strongly to the recent name, “Lina”.", "This head keeps the earlier name, “Maya”, in play instead."],
  "three-relations": ["This head reaches back to the plural subject, “keys”.", "This head follows the cabinet as the thing the keys belong to.", "This head follows the drawer as the location detail."],
};

export default function AttentionLab() {
  const [stored, setStored] = usePersistentState<Stored>("context-lab:attention:v1", initial, valid);
  const [view, setView] = useState<"weights" | "scores">("weights"); const [query, setQuery] = useState<number | null>(null);
  const trace = useMemo(() => createTransformerTrace(stored.preset), [stored.preset]);
  const selectedHead = Math.min(stored.head, trace.heads.length - 1);
  const head = trace.heads[selectedHead];
  const selected = query ?? trace.preset.tokens.length - 1;
  const visibleCells = head.cells[selected].map((cell, key) => ({ cell, key })).filter(({ cell }) => !cell.masked);
  const largestWeight = Math.max(...visibleCells.map(({ cell }) => cell.weight));
  return <>
    <div className="lab-toolbar"><div className="section-kicker"><span className="live-dot mint" /> CONTEXTUAL ROUTING</div><span className="badge">CAUSAL SELF-ATTENTION</span></div>
    <div className="attention-layout">
      <section className="panel attention-matrix-panel">
        <div className="panel-header"><SectionLabel icon={Grid2X2}>Who looks where?</SectionLabel><div className="attention-header-actions"><InfoTooltip label="Explain attention matrix"><div className="learning-popover"><h3>Reading this matrix</h3><p><strong>Rows are queries:</strong> the token currently gathering context.</p><p><strong>Columns are keys:</strong> earlier tokens it can look at. The cell value becomes a weight after softmax.</p><p><strong>Masked cells</strong> are future tokens. They are blocked so the model cannot peek ahead while generating.</p><p>Use <strong>Scores</strong> to see raw compatibility before softmax; use <strong>Weights</strong> to see the final shares that sum to $1$ in each allowed row.</p></div></InfoTooltip><div className="segmented" role="group" aria-label="Attention display"><button className={`btn ${view === "weights" ? "active" : ""}`} type="button" onClick={() => setView("weights")}>Weights</button><button className={`btn ${view === "scores" ? "active" : ""}`} type="button" onClick={() => setView("scores")}>Scores</button></div></div></div>
        <div className="attention-controls"><label><span className="attention-control-label">Trace</span><select aria-label="Attention teaching trace" value={stored.preset} onChange={event => { setStored(current => ({ preset: event.target.value as TransformerPresetId, head: 0 })); setQuery(null); }}>{transformerPresets.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select></label><div className="attention-head-control"><span className="attention-control-label attention-head-label">Head <InfoTooltip label="Explain attention heads"><div className="learning-popover"><h3>What is a head?</h3><p>A head is one small context-finding pattern. It gives every allowed earlier token a share, then makes a weighted mix of their information.</p><p><strong>Do not treat one head as the model’s final opinion.</strong> A layer combines all heads, then later layers transform the result.</p><p>In <strong>keys to the cabinet are</strong>, Head 1 favors <strong>keys</strong> for grammar while Head 2 favors nearby <strong>cabinet</strong>. Together, both ideas remain available.</p><p>In <strong>Maya gave Lina her notebook</strong>, one head favors <strong>Lina</strong> and another keeps <strong>Maya</strong> in play. The final <strong>notebook</strong> row also attends to <strong>her</strong>, which carries the unresolved link.</p><p>The <strong>Three relationships</strong> trace adds Head 3, which preserves a location detail alongside the subject and object relationship.</p></div></InfoTooltip></span><div className="segmented attention-head-switch" role="group" aria-label="Attention head">{trace.heads.map((_, index) => <button key={index} className={`btn ${selectedHead === index ? "active" : ""}`} type="button" aria-pressed={selectedHead === index} onClick={() => setStored(current => ({ ...current, head: index }))}>Head {index + 1}</button>)}</div></div></div>
        <div className="attention-scroll"><div className="attention-grid" style={{ gridTemplateColumns: `74px repeat(${trace.preset.tokens.length}, minmax(49px, 1fr))` }}><span className="attention-corner">Q \ K</span>{trace.preset.tokens.map((token, index) => <span className="attention-axis" key={`key-${index}`}>{token}</span>)}{head.cells.map((row, rowIndex) => <Fragment key={`row-${rowIndex}`}><button type="button" className={`attention-axis attention-query ${selected === rowIndex ? "selected" : ""}`} onClick={() => setQuery(rowIndex)}>{trace.preset.tokens[rowIndex]}</button>{row.map((cell, columnIndex) => { const amount = view === "weights" ? cell.weight : Math.max(0, (cell.score + 1.8) / 4); return <button key={`${rowIndex}-${columnIndex}`} type="button" aria-label={`${trace.preset.tokens[rowIndex]} attends to ${trace.preset.tokens[columnIndex]}: ${cell.masked ? "masked" : `${(cell.weight * 100).toFixed(1)} percent`}`} className={`attention-cell ${cell.masked ? "masked" : ""} ${selected === rowIndex ? "active-row" : ""}`} style={{ "--attention": amount } as React.CSSProperties} onFocus={() => setQuery(rowIndex)} onClick={() => setQuery(rowIndex)}>{cell.masked ? "×" : view === "weights" ? `${Math.round(cell.weight * 100)}` : cell.score.toFixed(1)}</button>; })}</Fragment>)}</div></div>
      </section>
      <section className="panel attention-explainer">
        <div className="panel-header"><SectionLabel icon={Network}>Inspect a query</SectionLabel><span className="badge badge-mint">{head.name.toUpperCase()}</span></div>
        <div className="attention-inspector"><p><b>{trace.preset.tokens[selected]}</b> is the query. Its row can only see itself and earlier keys.</p><p className="attention-head-lesson"><strong>This head's view:</strong> {headLessons[stored.preset][selectedHead]} Other heads contribute different context before the next layer combines them.</p><div className="attention-links">{visibleCells.map(({ cell, key }) => <div key={key} style={{ "--weight": Math.exp(cell.weight * 10) / Math.exp(largestWeight * 10) } as React.CSSProperties}><span>{trace.preset.tokens[key]}</span><i /><b>{(cell.weight * 100).toFixed(1)}%</b></div>)}</div><div className="attention-equation"><span>score</span><strong>Q · K / sqrt(d)</strong><span>then</span><strong>softmax</strong></div><button type="button" className="btn btn-ghost" onClick={() => setQuery(trace.preset.tokens.length - 1)}><RotateCcw size={14} /> Reset to final token</button></div>
      </section>
    </div>
    <section className="attention-takeaway">
      <Eye size={17} />
      <div>
        <strong>What is attention?</strong>
        <p>Imagine every word has a small desk of notes. Before a word does its next bit of work, it asks: <em>Which earlier notes would help me most right now?</em> Attention is the system for choosing how much of each earlier note to copy.</p>
        <div className="attention-article-grid">
          <div><b>Why does it help?</b><span>The same word can mean different things in different sentences. Attention lets a token use the surrounding words to work out the relevant meaning.</span></div>
          <div><b>What does a high number mean?</b><span>For this one head, more of that token's information was mixed into the current token. It is a routing decision, not proof that the token is the whole explanation.</span></div>
          <div><b>Why block future words?</b><span>When predicting the next token, the model must not peek at what comes later. The mask keeps the exercise honest, like covering the answer at the back of a book.</span></div>
        </div>
        <p className="attention-caution">Many heads do this at once, each with different patterns. Attention helps the model gather context; later layers still transform that gathered information before a next-token choice is made.</p>
      </div>
    </section>
    <TooltipNote>Rows are queries and columns are keys. The upper-right triangle is blocked by the causal mask, so a token cannot attend to future text while generating.</TooltipNote>
  </>;
}