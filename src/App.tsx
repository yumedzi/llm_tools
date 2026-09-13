import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { RiAnthropicFill, RiGrokAiFill, RiOpenaiFill } from "react-icons/ri";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  Bot,
  Braces,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Code2,
  Copy,
  Database,
  Download,
  Eraser,
  Expand,
  FileCode2,
  FileText,
  FlaskConical,
  Gauge,
  Globe2,
  History,
  Info,
  Layers3,
  Lightbulb,
  LockKeyhole,
  MessageSquare,
  Minus,
  PanelLeftClose,
  Plus,
  Rocket,
  RotateCcw,
  ScanText,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Trash2,
  WandSparkles,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { ContextLabView, FlowLabView } from "./ContextFlowLabs";
import PromptLab from "./PromptLab";
import {
  characterCount,
  compact,
  compactEntries,
  compareModelTokens,
  contextColors,
  fitAmounts,
  flowBase,
  flowCapacity,
  flowUsed,
  formatNumber,
  inputCost,
  models,
  retainCall,
  samples,
  visualChunks,
  wordCount,
} from "./logic";
import type { FlowEntry } from "./logic";
import {
  IconButton,
  SectionLabel,
  TooltipNote,
  usePersistentState,
} from "./ui";

const tabs = [
  {
    id: "tokenizer",
    name: "Tokenizer",
    short: "Tokens",
    icon: ScanText,
    title: "Small pieces. Big possibilities.",
    subtitle: "See how your words become the building blocks of AI.",
    label: "Understand the language of language models",
    step: "01",
    accent: "#b19aff",
  },
  {
    id: "context",
    name: "Context window",
    short: "Context",
    icon: Gauge,
    title: "Every conversation has a limit.",
    subtitle: "Explore what lives inside a model’s working memory.",
    label: "Make the invisible visible",
    step: "02",
    accent: "#90d9c1",
  },
  {
    id: "flow",
    name: "MCP & skill flow",
    short: "Tool flow",
    icon: Workflow,
    title: "One call. A lasting footprint.",
    subtitle:
      "Follow the tools, trace the tokens, and watch context accumulate.",
    label: "Tools have a context cost",
    step: "03",
    accent: "#8baffb",
  },
  {
    id: "prompt",
    name: "Prompt sandbox",
    short: "Prompts",
    icon: Braces,
    title: "A better prompt starts here.",
    subtitle: "Build with intent. Compare iterations. Make every token count.",
    label: "Turn instructions into understanding",
    step: "04",
    accent: "#f3ba94",
  },
] as const;
type TabId = (typeof tabs)[number]["id"];
const tabIsValid = (value: unknown): value is TabId =>
  tabs.some((t) => t.id === value);

export default function App() {
  const [tab, setTab] = usePersistentState<TabId>(
    "context-lab:tab",
    "tokenizer",
    tabIsValid,
  );
  const [guide, setGuide] = useState(false);
  const [present, setPresent] = useState(false);
  const [visited, setVisited] = usePersistentState<string[]>(
    "context-lab:visited",
    ["tokenizer"],
    (v): v is string[] =>
      Array.isArray(v) &&
      v.every((x) => typeof x === "string" && tabs.some((t) => t.id === x)),
  );
  const active = tabs.find((t) => t.id === tab)!;
  const navigate = (next: TabId) => {
    setTab(next);
    setVisited((v) => Array.from(new Set([...v, next])));
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  useEffect(() => {
    document.title = `${active.name} — Context Lab`;
  }, [active.name]);
  return (
    <div className={`app-shell ${present ? "presentation-mode" : ""}`}>
      <aside className="sidebar" aria-label="Main navigation">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("tokenizer");
          }}
        >
          <span className="brand-mark">
            <Layers3 size={23} strokeWidth={1.65} />
          </span>
          <span>
            context<span className="brand-light">lab</span>
            <span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace-label">
          <span className="tiny-icon">
            <FlaskConical size={14} />
          </span>{" "}
          Your learning workspace <ChevronDown size={13} />
        </div>
        <div className="nav-eyebrow">
          THE PLAYGROUND <span>04</span>
        </div>
        <nav className="nav-list">
          {tabs.map((t) => (
            <button
              type="button"
              key={t.id}
              className={`nav-item ${tab === t.id ? "selected" : ""}`}
              onClick={() => navigate(t.id)}
              aria-label={`${t.name} ${t.step}`}
              aria-current={tab === t.id ? "page" : undefined}
            >
              <t.icon size={19} strokeWidth={1.65} />
              <span>{t.name}</span>
              <span className="nav-index">{t.step}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-lesson">
          <div className="lesson-icon">
            <Sparkles size={19} />
          </div>
          <h3>
            A little context.
            <br />A lot of clarity.
          </h3>
          <p>No black boxes. Just hands-on experiments.</p>
          <div className="lesson-progress">
            {tabs.map((t) => (
              <span
                key={t.id}
                className={visited.includes(t.id) ? "done" : ""}
              />
            ))}
          </div>
          <div className="lesson-count">
            {visited.length} of 4 labs explored <ArrowUpRight size={13} />
          </div>
        </div>
        <div className="sidebar-bottom">
          <button
            type="button"
            className="nav-item"
            onClick={() => setGuide(true)}
          >
            <BookOpen size={18} />
            <span>Field guide</span>
            <ArrowUpRight size={14} />
          </button>
          <div className="local-status">
            <span className="status-dot" />
            <div>
              All systems local<span>Your data stays in your browser</span>
            </div>
            <ShieldCheck size={17} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span className="mobile-brand">
              <Layers3 size={20} /> contextlab.
            </span>
            <span className="desktop-breadcrumb">
              Playground <span>/</span> <strong>{active.name}</strong>
            </span>
          </div>
          <div className="topbar-actions">
            <span className="offline-pill">
              <span className="status-dot" /> No API keys needed
            </span>
            <IconButton
              icon={present ? PanelLeftClose : Expand}
              className={`btn-ghost presentation-btn ${present ? "is-on" : ""}`}
              onClick={() => setPresent((v) => !v)}
              title="Toggle presentation mode"
            >
              {present ? "Exit focus" : "Present"}
            </IconButton>
            <IconButton
              icon={CircleHelp}
              aria-label="Open field guide"
              onClick={() => setGuide(true)}
            />
          </div>
        </header>
        <div className="mobile-tabs" role="navigation" aria-label="Labs">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? "active" : ""}
              onClick={() => navigate(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
            >
              <t.icon size={18} />
              {t.short}
            </button>
          ))}
        </div>
        <main id="main-content" className="main-content">
          <section className="hero" key={`hero-${tab}`}>
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="eyebrow-line" />
                LAB {active.step} <span className="eyebrow-divider">/</span>{" "}
                {active.label}
              </div>
              <h1>{active.title}</h1>
              <p>{active.subtitle}</p>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="orbit-core" style={{ color: active.accent }}>
                <active.icon size={36} strokeWidth={1.1} />
              </div>
              <span className="orbit-node node-one" />
              <span className="orbit-node node-two" />
              <span className="orbit-star">+</span>
            </div>
          </section>
          <div className="lab-content" key={tab}>
            {tab === "tokenizer" && <Tokenizer />}
            {tab === "context" && <ContextLabView />}
            {tab === "flow" && <FlowLabView />}
            {tab === "prompt" && <PromptLab />}
          </div>
          <footer className="page-footer">
            <span className="footer-curiosity">
              <Rocket size={13} /> Built for curiosity.
            </span>
            <span className="footer-attribution">
              <span>© 2016-2026</span>
              <a href="https://onpy.dev" target="_blank" rel="noreferrer">
                Viktor Moyseyenko
              </a>
            </span>
            <span className="footer-mantra">
              CONTEXT LAB <span className="footer-dot">·</span> EXPERIMENT.
              UNDERSTAND. REPEAT.
            </span>
          </footer>
        </main>
      </div>
      {guide && <Guide onClose={() => setGuide(false)} />}
    </div>
  );
}

function Tokenizer() {
  const [text, setText] = usePersistentState(
    "context-lab:text",
    samples.prose,
    (v): v is string => typeof v === "string" && v.length <= 100000,
  );
  const [metric, setMetric] = useState<"tokens" | "cost">("tokens");
  const [costMultiplier, setCostMultiplier] = useState<1 | 1000>(1);
  const [showRates, setShowRates] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  useEffect(() => {
    setCopyMessage("");
  }, [text]);
  const [sample, setSample] = useState<keyof typeof samples>("prose");
  const [inspect, setInspect] = useState(true);
  const counts = useMemo(() => compareModelTokens(text), [text]);
  const costs = useMemo(
    () =>
      models.map((model, index) =>
        model.pricing.map((price) => inputCost(counts[index], price)),
      ),
    [counts],
  );
  const values =
    metric === "tokens"
      ? counts
      : costs.map((modelCosts) => Math.max(...modelCosts) * costMultiplier);
  const peak = Math.max(...values, 0);
  const magnitude = peak > 0 ? 10 ** Math.floor(Math.log10(peak)) : 1;
  const max =
    peak > 0
      ? ([1, 2, 5, 10].find((tick) => tick * magnitude >= peak) ?? 10) *
        magnitude
      : metric === "tokens"
        ? 100
        : 0.001;
  const tokens = counts[2];
  const chunks = useMemo(() => visualChunks(text.slice(0, 1800)), [text]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopyMessage("Input copied.");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      const input = document.querySelector<HTMLTextAreaElement>(
        '[aria-label="Text to tokenize"]',
      );
      input?.focus();
      input?.select();
      setCopyMessage(
        "Clipboard unavailable. Text selected: use Ctrl/Cmd+C to copy.",
      );
    }
  }
  return (
    <>
      <div className="lab-toolbar">
        <div className="section-kicker">
          <span className="live-dot" />
          LIVE TOKEN EXPLORER
        </div>
        <span className="muted toolbar-hint">
          <ShieldCheck size={14} /> 100% client-side processing
        </span>
      </div>
      <div className="tokenizer-grid">
        <section className="panel input-panel">
          <div className="panel-header">
            <SectionLabel icon={FileText}>Your input</SectionLabel>
            <span className="badge">PLAIN TEXT</span>
          </div>
          <div className="sample-toolbar">
            <span>Start with a sample</span>
            <div className="sample-buttons">
              <IconButton
                icon={FileText}
                className={`btn-small btn-ghost ${sample === "prose" && text === samples.prose ? "chosen" : ""}`}
                onClick={() => {
                  setText(samples.prose);
                  setSample("prose");
                }}
              >
                Prose
              </IconButton>
              <IconButton
                icon={Code2}
                className={`btn-small btn-ghost ${sample === "code" && text === samples.code ? "chosen" : ""}`}
                onClick={() => {
                  setText(samples.code);
                  setSample("code");
                }}
              >
                Code
              </IconButton>
              <IconButton
                icon={Globe2}
                className={`btn-small btn-ghost ${sample === "multilingual" && text === samples.multilingual ? "chosen" : ""}`}
                onClick={() => {
                  setText(samples.multilingual);
                  setSample("multilingual");
                }}
              >
                Multilingual
              </IconButton>
            </div>
          </div>
          <div className="text-editor">
            <span className="editor-gutter" aria-hidden="true">
              01
            </span>
            <textarea
              aria-label="Text to tokenize"
              maxLength={100000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="A thought, a paragraph, a little code… Start typing to see what happens."
              spellCheck={false}
            />
            <span className="editor-corner">
              <IconButton
                icon={copied ? Check : Copy}
                aria-label={copied ? "Copied text" : "Copy input text"}
                onClick={copy}
                disabled={!text}
              />
              <IconButton
                icon={Trash2}
                aria-label="Clear input text"
                onClick={() => setText("")}
                disabled={!text}
              />
            </span>
          </div>
          <div className="input-stats" aria-live="polite">
            <div>
              <strong>{formatNumber(wordCount(text))}</strong>
              <span>
                words <Info size={11} aria-label="Whitespace-separated words" />
              </span>
            </div>
            <div>
              <strong>{formatNumber(characterCount(text))}</strong>
              <span>characters</span>
            </div>
            <div className="highlight-stat">
              <strong>~{formatNumber(tokens)}</strong>
              <span>Claude · ctoc estimate</span>
            </div>
          </div>
          <div className="input-footer" role="status">
            <span className="status-dot" />
            {copyMessage ||
              (text.length >= 100000
                ? "100,000 character input limit reached"
                : "Changes update instantly")}
            <span className="mono">UTF-8</span>
          </div>
        </section>
        <section className="panel chart-panel">
          <div className="panel-header">
            <SectionLabel icon={AudioLines}>Model comparison</SectionLabel>
            <div className="segmented">
              <IconButton
                icon={ScanText}
                className={metric === "tokens" ? "active" : ""}
                onClick={() => setMetric("tokens")}
                aria-pressed={metric === "tokens"}
              >
                Tokens
              </IconButton>
              <IconButton
                icon={Gauge}
                className={metric === "cost" ? "active" : ""}
                onClick={() => setMetric("cost")}
                aria-pressed={metric === "cost"}
              >
                Cost
              </IconButton>
              {metric === "cost" && (
                <IconButton
                  icon={Layers3}
                  className={costMultiplier === 1000 ? "active" : ""}
                  onClick={() =>
                    setCostMultiplier((value) => (value === 1 ? 1000 : 1))
                  }
                  aria-pressed={costMultiplier === 1000}
                >
                  x1000
                </IconButton>
              )}
            </div>
          </div>
          <div className="chart-description">
            <span>
              {metric === "tokens"
                ? "One input. Different token footprints."
                : `Standard short-context input cost for ${costMultiplier.toLocaleString()} input${costMultiplier === 1 ? "" : "s"}.`}
            </span>
            <span className="badge badge-purple">LOCAL TOKENIZERS</span>
          </div>
          <div className="model-chart">
            {models.map((m, i) => {
              const modelCosts = costs[i].map((cost) => cost * costMultiplier);
              const lowCost = Math.min(...modelCosts);
              const highCost = Math.max(...modelCosts);
              return (
                <div className="model-row" key={m.name}>
                  <div className="model-heading">
                    <div className="model-name">
                      <span
                        className="model-icon"
                        style={{ color: m.color, background: `${m.color}13` }}
                      >
                        {m.family === "Claude" ? (
                          <RiAnthropicFill size={14} />
                        ) : m.family === "OpenAI" ? (
                          <RiOpenaiFill size={14} />
                        ) : (
                          <RiGrokAiFill size={14} />
                        )}
                      </span>
                      {m.name}
                    </div>
                    <span
                      className={`model-value ${metric === "cost" && m.pricing.length > 1 ? "tiered-model-value" : ""}`}
                      style={{ color: m.color }}
                    >
                      {metric === "tokens"
                        ? formatNumber(counts[i])
                        : lowCost === highCost
                          ? `$${highCost.toFixed(6)}`
                          : m.pricing.map((price, index) => (
                              <span className="tiered-cost" key={price.label}>
                                <small>{price.label}</small>
                                ${modelCosts[index].toFixed(6)}
                              </span>
                            ))}
                      <small>{metric === "tokens" ? "tokens" : "USD"}</small>
                    </span>
                  </div>
                  <div
                    className="bar-track"
                    role="meter"
                    aria-label={`${m.name} ${metric}`}
                    aria-valuemin={0}
                    aria-valuemax={max}
                    aria-valuenow={values[i]}
                  >
                    <div
                      className="bar-fill"
                      style={
                        {
                          width: `${(values[i] / max) * 100}%`,
                          "--bar-color": m.color,
                        } as CSSProperties
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="chart-axis">
            <span>0</span>
            <span>
              {metric === "tokens"
                ? `${formatNumber(max)} tokens`
                : `$${max < 1e-8 ? "0" : max.toFixed(6)}`}
            </span>
          </div>
          <div className="chart-bottom">
            <span>
              <Info size={14} />
              Standard API list prices, retrieved 2026-09-13.
            </span>
            <IconButton
              icon={SlidersHorizontal}
              className="btn-ghost btn-small"
              onClick={() => setShowRates((v) => !v)}
              aria-expanded={showRates}
            >
              Pricing
            </IconButton>
          </div>
        </section>
      </div>
      {showRates && (
        <section className="panel assumptions-panel pricing-panel">
          <SectionLabel icon={SlidersHorizontal}>
            API pricing reference{" "}
            <span className="muted section-subtitle">USD per 1M tokens</span>
          </SectionLabel>
          <p>
            Cost mode uses each model's standard short-context input price. The
            grouped GPT row shows Sol, Terra, and Luna separately in that
            order. Cached input and output prices are listed for reference and
            are not included in the chart calculation.
          </p>
          <div
            className="pricing-table"
            role="table"
            aria-label="Standard API model pricing"
          >
            <div className="pricing-table-head" role="row">
              <span>Model</span>
              <span>Input</span>
              <span>Cached</span>
              <span>Output</span>
            </div>
            {models.flatMap((model) =>
              model.pricing.map((price) => (
                <div
                  className="pricing-table-row"
                  role="row"
                  key={`${model.id}-${price.label}`}
                >
                  <span>
                    <strong>{model.name}</strong>
                    {model.pricing.length > 1 && <small>{price.label}</small>}
                  </span>
                  <span>${price.input.toFixed(2)}</span>
                  <span>${price.cachedInput.toFixed(2)}</span>
                  <span>${price.output.toFixed(2)}</span>
                </div>
              )),
            )}
          </div>
          <p className="pricing-sources">
            Sources: Anthropic API pricing, OpenAI API pricing, and xAI model
            pricing, retrieved 2026-09-13. Grok 4.6 uses the under-200K-context
            tier; pricing can change.
          </p>
        </section>
      )}
      <section className="panel token-view">
        <div className="panel-header">
          <SectionLabel icon={Braces}>
            Under the hood{" "}
            <span className="muted section-subtitle">A look at the pieces</span>
          </SectionLabel>
          <IconButton
            icon={inspect ? Minus : Plus}
            className="btn-ghost btn-small"
            onClick={() => setInspect((v) => !v)}
            aria-expanded={inspect}
          >
            {inspect ? "Hide" : "Show"} visualization
          </IconButton>
        </div>
        {inspect && (
          <>
            <div className="token-chunks" aria-label="Illustrative text chunks">
              {chunks.length ? (
                chunks.map((chunk, i) =>
                  /^\s+$/.test(chunk) ? (
                    <span className="token-space" key={i}>
                      {chunk}
                    </span>
                  ) : (
                    <span
                      className={`token-chunk token-color-${i % 6}`}
                      key={i}
                    >
                      {chunk}
                    </span>
                  ),
                )
              ) : (
                <span className="muted">
                  Your text will appear here as illustrative chunks.
                </span>
              )}
              {text.length > 1800 && (
                <span className="muted">
                  {" "}
                  … preview limited to 1,800 characters
                </span>
              )}
            </div>
            <div className="token-view-footer">
              <span>
                <span className="mini-swatch" /> Each color marks a chunk, not a
                word.
              </span>
              <span>Illustrative segmentation · not exact token IDs</span>
            </div>
          </>
        )}
      </section>
      <div className="learning-callout">
        <div className="callout-icon">
          <Lightbulb size={20} />
        </div>
        <div>
          <h3>Words aren’t tokens.</h3>
          <p>
            A token can be a word, part of a word, or a punctuation mark.
            Language, code, and even spaces change the count. Try switching
            samples to see the difference.
          </p>
        </div>
        <span className="callout-label">
          THE TAKEAWAY <ArrowUpRight size={14} />
        </span>
      </div>
    </>
  );
}

/* Legacy ContextLab and FlowLab retained during the transition from positional to typed context data.
function ContextLab() {
  const [provider, setProvider] = usePersistentState<Provider>('context-lab:provider', 'Claude', (v): v is Provider => v === 'Claude' || v === 'OpenAI' || v === 'Copilot');
  const [overrides, setOverrides] = useState<number[] | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const preset = presets[provider];
  const amounts = fitAmounts(overrides ?? preset.amounts, preset.capacity);
  const used = amounts.reduce((a, b) => a + b, 0);
  const all = [...amounts, preset.capacity - used];
  const labels = [preset.file, 'System prompt', 'Skills & MCP', 'Message history', 'Free space'];
  const desc = ['Project guidance included by the host', 'Baseline instructions and model behavior', 'Loaded definitions, tool results & skill output', 'User messages and assistant responses', 'Room for more input and generated output'];
  const icons = [FileCode2, Settings2, Workflow, History, Expand];
  const radius = 116;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return <>
    <div className="lab-toolbar"><div className="section-kicker"><span className="live-dot mint" />CONTEXT ANATOMY</div><span className="badge">ILLUSTRATIVE PRESETS</span></div>
    <div className="context-layout"><section className="panel context-dial-panel"><div className="panel-header"><SectionLabel icon={Gauge}>Inside the window</SectionLabel><span className="badge badge-mint">{compact(preset.capacity)} CAPACITY</span></div><div className="provider-tabs segmented" role="group" aria-label="Provider preset">{(Object.keys(presets) as Provider[]).map(p => <IconButton key={p} icon={p === 'Claude' ? Sparkles : p === 'OpenAI' ? Layers3 : Bot} className={p === provider ? 'active' : ''} onClick={() => { setProvider(p); setOverrides(null); setFocused(null); }} aria-pressed={provider === p}>{p}</IconButton>)}</div><div className="context-dial"><svg viewBox="0 0 320 320" role="img" aria-label={`${provider}: ${formatNumber(used)} of ${formatNumber(preset.capacity)} context tokens used`}><circle cx="160" cy="160" r="142" fill="none" stroke="#292a37" strokeWidth="1" strokeDasharray="2 7" /><circle cx="160" cy="160" r="116" fill="none" stroke="#21222d" strokeWidth="36" />{all.map((n, i) => { const start = offset; const length = n / preset.capacity * circumference; offset += length; return <circle key={i} cx="160" cy="160" r={radius} fill="none" stroke={contextColors[i]} strokeWidth={focused === i ? 42 : 34} strokeDasharray={`${Math.max(0, length - 5)} ${circumference - Math.max(0, length - 5)}`} strokeDashoffset={-start} transform="rotate(-90 160 160)" className="context-segment" style={{ opacity: focused === null || focused === i ? 1 : 0.35 }} onMouseEnter={() => setFocused(i)} onMouseLeave={() => setFocused(null)} />; })}<circle cx="160" cy="160" r="87" fill="none" stroke="#292a37" strokeWidth="1" /></svg><div className="dial-center"><span>{focused === null ? 'CONTEXT USED' : labels[focused]}</span><strong>{compact(focused === null ? used : all[focused])}<small>tokens</small></strong><span className="dial-percent">{Math.round((focused === null ? used : all[focused]) / preset.capacity * 100)}% of {compact(preset.capacity)}</span></div></div><div className="context-summary"><div><span className="status-dot" /> Available for what’s next</div><strong>{formatNumber(preset.capacity - used)} <small>tokens</small></strong></div></section>
    <section className="panel allocation-panel"><div className="panel-header"><SectionLabel icon={Layers3}>What’s taking up space?</SectionLabel><IconButton icon={RotateCcw} className="btn-ghost btn-small" onClick={() => setOverrides(null)}>Reset</IconButton></div><div className="allocation-intro"><h3>{provider} <span>· {preset.subtitle}</span></h3><p>Adjust the ingredients. Watch your available space change.</p></div><div className="allocation-list">{all.map((n, i) => { const Icon = icons[i]; return <div key={i} className={`allocation-item ${focused === i ? 'focused' : ''}`} onMouseEnter={() => setFocused(i)} onMouseLeave={() => setFocused(null)}><div className="allocation-title"><span className="allocation-icon" style={{ color: i === 4 ? '#737589' : contextColors[i] }}><Icon size={18} /></span><strong>{labels[i]}</strong><span className="mono">{formatNumber(n)}<small>{(n / preset.capacity * 100).toFixed(1)}%</small></span></div><p>{desc[i]}</p>{i < 4 && <input type="range" aria-label={`${labels[i]} tokens`} min={0} max={preset.capacity - used + n} step={1000} value={n} style={{ accentColor: contextColors[i] }} onFocus={() => setFocused(i)} onBlur={() => setFocused(null)} onChange={e => setOverrides(amounts.map((v, j) => j === i ? Number(e.target.value) : v))} />}</div>; })}</div></section></div>
    <div className="learning-callout mint-callout"><div className="callout-icon"><Lightbulb size={20} /></div><div><h3>It’s a working memory, not a hard drive.</h3><p>Instructions, messages, and retained tool results share a finite budget. Leave room for the answer, too. Applications can truncate or summarize history; the model doesn’t remember outside the context it receives.</p></div></div><TooltipNote>These capacities and allocations are teaching presets, not verified product limits. Actual windows depend on the model and host. Instruction filenames describe host conventions; files are only included when the application loads them. Some systems use a shared input/output budget and may reserve output space separately.</TooltipNote>
  </>;
}

const callTypes = [
  { id: 'search', kind: 'mcp' as const, name: 'Search documents', detail: '6 retrieved passages', tokens: 2400, icon: Search, color: '#8baffb' },
  { id: 'database', kind: 'mcp' as const, name: 'Query database', detail: '20 structured records', tokens: 4800, icon: Database, color: '#8baffb' },
  { id: 'review', kind: 'skill' as const, name: 'Code review skill', detail: 'Instructions + review output', tokens: 1800, icon: Code2, color: '#b19aff' },
  { id: 'brief', kind: 'skill' as const, name: 'Summarizer skill', detail: 'Instructions + summary output', tokens: 900, icon: WandSparkles, color: '#b19aff' },
  { id: 'message', kind: 'message' as const, name: 'Continue conversation', detail: 'One user + assistant exchange', tokens: 600, icon: MessageSquare, color: '#90d9c1' },
];
const validEntries = (v: unknown): v is FlowEntry[] => Array.isArray(v) && v.length <= 200 && v.every(e => e && typeof e === 'object' && ['mcp', 'skill', 'message'].includes(e.kind) && typeof e.name === 'string' && e.name.length < 120 && Number.isFinite(e.id) && Number.isFinite(e.tokens) && e.tokens > 0 && e.tokens <= 4800 && Number.isFinite(e.originalTokens) && e.originalTokens >= e.tokens && typeof e.summarized === 'boolean') && flowUsed(v) <= flowCapacity;
function FlowLab() {
  const [entries, setEntries] = usePersistentState<FlowEntry[]>('context-lab:flow', [], validEntries);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState('Choose an action to see what stays in context.');
  const [resetConfirm, setResetConfirm] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const used = flowUsed(entries);
  const percent = used / flowCapacity * 100;
  const mcp = entries.filter(e => e.kind === 'mcp').reduce((s, e) => s + e.tokens, 0);
  const skills = entries.filter(e => e.kind === 'skill').reduce((s, e) => s + e.tokens, 0);
  function trigger(call: typeof callTypes[number]) {
    if (pending) return;
    if (used + call.tokens > flowCapacity) { setNotice('Not enough context. Compact retained results or start a fresh session.'); return; }
    setPending(call.id); setNotice(`Simulating ${call.name.toLowerCase()}…`);
    timer.current = setTimeout(() => {
      const entry: FlowEntry = { id: Date.now(), name: call.name, kind: call.kind, tokens: call.tokens, originalTokens: call.tokens, summarized: false };
      setEntries(old => retainCall(old, entry) ?? old);
      setPending(null); setNotice(`${call.name}: ${formatNumber(call.tokens)} tokens added and retained in this session.`);
    }, 700);
  }
  return <>
    <div className="lab-toolbar"><div className="section-kicker"><span className="live-dot blue" />THE CONTEXT FOOTPRINT</div><span className="badge">SIMULATION · NO REAL CALLS</span></div>
    <section className="panel flow-meter-panel"><div className="flow-meter-heading"><div><span className="eyebrow">SESSION CONTEXT</span><h2>{formatNumber(used)} <span>/ {formatNumber(flowCapacity)} tokens</span></h2></div><div className={`meter-percentage ${percent > 85 ? 'warning' : ''}`}>{percent.toFixed(1)}%<span>occupied</span></div></div><div className="retention-meter" role="meter" aria-label="Session context used" aria-valuemin={0} aria-valuemax={flowCapacity} aria-valuenow={used}><span style={{ width: `${flowBase / flowCapacity * 100}%`, background: '#6e7088' }} />{entries.map(e => <span key={e.id} title={`${e.name}: ${formatNumber(e.tokens)} tokens`} style={{ width: `${e.tokens / flowCapacity * 100}%`, background: e.kind === 'mcp' ? '#8baffb' : e.kind === 'skill' ? '#b19aff' : '#90d9c1' }} />)}</div><div className="meter-legend"><span><i style={{ background: '#6e7088' }} />Baseline {compact(flowBase)}</span><span><i style={{ background: '#8baffb' }} />MCP results {compact(mcp)}</span><span><i style={{ background: '#b19aff' }} />Skills {compact(skills)}</span><span><i style={{ background: '#90d9c1' }} />Conversation</span><strong>{formatNumber(flowCapacity - used)} free</strong></div></section>
    <div className="flow-layout"><section className="panel flow-controls"><div className="panel-header"><SectionLabel icon={Terminal}>Make a move</SectionLabel><span className="badge badge-purple">INTERACTIVE</span></div><div className="call-list">{callTypes.map((call, i) => <div key={call.id}>{(i === 0 || i === 2 || i === 4) && <div className="call-group-label">{i === 0 ? 'MCP TOOL CALLS' : i === 2 ? 'SKILL INVOCATIONS' : 'CONVERSATION'}</div>}<button type="button" className={`call-button ${pending === call.id ? 'pending' : ''}`} disabled={!!pending || used + call.tokens > flowCapacity} onClick={() => trigger(call)}><span className="call-icon" style={{ color: call.color }}><call.icon size={20} /></span><span><strong>{call.name}</strong><small>{call.detail}</small></span><span className="call-token">+{compact(call.tokens)}<Plus size={14} /></span></button></div>)}</div><div className="flow-actions"><IconButton icon={Eraser} className="btn-ghost btn-small" disabled={!!pending || !entries.some(e => !e.summarized)} onClick={() => { const next = compactEntries(entries); setEntries(next); setNotice(`Compacted retained entries: ${formatNumber(used - flowUsed(next))} tokens freed. Summaries keep only 25% of the original size; details are lost.`); }}>Compact session</IconButton><IconButton icon={RotateCcw} className="btn-ghost btn-small" disabled={!!pending || !entries.length} onClick={() => setResetConfirm(true)}>New session</IconButton></div>{resetConfirm && <div className="inline-confirm"><span>Clear all simulated calls?</span><IconButton icon={Check} className="btn-small" onClick={() => { setEntries([]); setResetConfirm(false); setNotice('Fresh session. Previous tool results are no longer in context.'); }}>Clear</IconButton><IconButton icon={X} aria-label="Cancel new session" onClick={() => setResetConfirm(false)} /></div>}</section>
    <section className="panel flow-timeline-panel"><div className="panel-header"><SectionLabel icon={Workflow}>The trail you leave</SectionLabel><span className="badge">{entries.length} RETAINED {entries.length === 1 ? 'ENTRY' : 'ENTRIES'}</span></div><div className={`flow-route ${pending ? 'running' : ''}`}><div><MessageSquare size={21} /><span>You ask</span></div><ArrowRight size={17} /><div><Workflow size={21} /><span>Tool / skill</span></div><ArrowRight size={17} /><div className="route-destination"><Layers3 size={21} /><span>Stays in context</span></div></div><div className="flow-timeline">{!entries.length && !pending ? <div className="empty-state"><div className="empty-icon"><Workflow size={28} strokeWidth={1.3} /></div><h3>No footprints. Yet.</h3><p>Run a tool or a skill on the left.<br />Its result becomes part of the conversation.</p><span><ArrowUpRight size={14} /> Try “Search documents” first</span></div> : <><div className="timeline-entry baseline-entry"><span className="timeline-dot" /><div><strong>Session initialized</strong><p>System instructions + available tool definitions</p></div><span className="mono">{compact(flowBase)}</span></div>{entries.map((e, i) => <div className="timeline-entry" key={e.id}><span className={`timeline-dot dot-${e.kind}`} /><div><strong>{e.name} <span className="entry-number">#{i + 1}</span></strong><p>{e.summarized ? 'Compacted summary · details removed' : e.kind === 'mcp' ? 'Tool response retained in message history' : e.kind === 'skill' ? 'Loaded skill instructions and output retained' : 'User and assistant messages retained'}</p><span className={`retained-tag ${e.summarized ? 'is-compacted' : ''}`}>{e.summarized ? <CheckCheck size={10} /> : <LockKeyhole size={10} />}{e.summarized ? 'SUMMARIZED' : 'RETAINED'}</span></div><span className="entry-tokens mono">+{formatNumber(e.tokens)}{e.summarized && <small>was {formatNumber(e.originalTokens)}</small>}</span></div>)}{pending && <div className="pending-entry"><span className="live-dot" />Running simulated action…</div>}</>}</div><div className="flow-notice" role="status"><Info size={15} /><span>{notice}</span></div></section></div>
    <div className="learning-callout blue-callout"><div className="callout-icon"><Lightbulb size={20} /></div><div><h3>Done executing doesn’t mean done consuming.</h3><p>Finishing a tool call doesn’t remove its result from the conversation. Repeat a call and you retain another result. In this simulator, it stays until you compact or reset—not permanently across every real application.</p></div></div><TooltipNote>MCP is a protocol, not a memory policy. Hosts choose whether to keep, truncate, summarize, or exclude tool results. Skills only consume context when instructions or output are loaded. The simulated token sizes and 75% compaction savings are fixed teaching assumptions, not actual requests or guaranteed compression.</TooltipNote>
  </>;
}

*/
function Guide({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [downloaded, setDownloaded] = useState(false);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
    };
  }, []);
  function exportNotes() {
    const content =
      "CONTEXT LAB — FACILITATOR FIELD GUIDE\n\n1. TOKENIZER\nCompare prose, code, and multilingual text. Observe that words are not tokens. All profiles and rates are illustrative, not verified model benchmarks or current prices.\n\n2. CONTEXT\nAdjust the shared context categories. Ask what happens when history grows and why generated output also needs space. The Memory files category includes conventions such as CLAUDE.md, AGENTS.md, and copilot-instructions.md. Capacity is model- and host-dependent.\n\n3. MCP & SKILLS\nRun Search documents twice, then a skill. Results accumulate. Compact the session and discuss lost detail. MCP itself does not mandate retention; this simulator retains data until compaction or reset.\n\n4. PROMPT SANDBOX\nLoad a template and capture a baseline. Add constraints or examples, then compare. More tokens do not necessarily mean a better prompt.\n\nPRIVACY\nAll processing is local to this browser. Experiment state is saved in localStorage when available. No real model requests, API keys, backend, analytics, or remote fonts. Clear this site’s browser storage to erase saved experiments.\n\nDEPLOY\nRun npm install, then npm run dev. For production run npm run build. Import the project into Vercel with the Vite preset; build command npm run build, output dist. No environment variables required.\n";
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/plain" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "context-lab-field-guide.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloaded(true);
  }
  return (
    <dialog
      ref={ref}
      className="guide-modal"
      aria-labelledby="guide-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="guide-header">
        <span className="brand-mark">
          <BookOpen size={23} />
        </span>
        <IconButton icon={X} aria-label="Close field guide" onClick={onClose} />
      </div>
      <div className="eyebrow">A FIELD GUIDE FOR CURIOUS MINDS</div>
      <h2 id="guide-title">
        Less magic.
        <br />
        More understanding.
      </h2>
      <p className="guide-intro">
        Four small experiments to make large language models feel a little less
        mysterious.
      </p>
      <div className="guide-lessons">
        {[
          {
            icon: ScanText,
            title: "01 / Find the smallest pieces",
            text: "Compare prose, code, and multilingual samples. Why do punctuation and language affect the count?",
          },
          {
            icon: Gauge,
            title: "02 / Make room for the answer",
            text: "Grow message history and watch free space shrink. What would you remove first?",
          },
          {
            icon: Workflow,
            title: "03 / Follow the footprint",
            text: "Call the same tool twice. Compact the session. What context remains, and what detail might be lost?",
          },
          {
            icon: Braces,
            title: "04 / Give instructions a structure",
            text: "Snapshot a template, add an example, and compare. Do the extra tokens make your intent clearer?",
          },
        ].map((x) => (
          <div key={x.title}>
            <x.icon size={20} />
            <div>
              <h3>{x.title}</h3>
              <p>{x.text}</p>
            </div>
          </div>
        ))}
      </div>
      <TooltipNote>
        This is a learning simulator, not a model benchmark. All processing
        stays in your browser. Saved experiments use local storage; clear site
        data to remove them. No analytics, no API calls, no keys.
      </TooltipNote>
      <IconButton
        icon={downloaded ? Check : Download}
        className="btn-primary guide-download"
        onClick={exportNotes}
      >
        {downloaded
          ? "Downloaded — get another copy"
          : "Download facilitator notes"}
      </IconButton>
    </dialog>
  );
}
