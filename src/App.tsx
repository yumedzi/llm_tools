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
  CircleDollarSign,
  Code2,
  Copy,
  Cpu,
  Database,
  Download,
  Eraser,
  Expand,
  FileCode2,
  FileText,
  FlaskConical,
  Gauge,
  GitBranch,
  Globe2,
  History,
  Info,
  Layers3,
  Lightbulb,
  LockKeyhole,
  MessageSquare,
  Minus,
  Network,
  PanelLeftClose,
  Plus,
  Rocket,
  RotateCcw,
  ScanText,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Terminal,
  Trash2,
  WandSparkles,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { ContextLabView, FlowLabView } from "./ContextFlowLabs";
import { PricingSources, PricingTable } from "./PricingReference";
import PromptLab from "./PromptLab";
import AttentionLab from "./AttentionLab";
import TransformerBlockLab from "./TransformerBlockLab";
import TransformerLab from "./TransformerLab";
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
  models,
  retainCall,
  samples,
  wordCount,
} from "./logic";
import { openAITokenPieces } from "./tokenizers";
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
    name: "Session Emulation",
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
    id: "transformer-block",
    name: "Transformer",
    short: "Transformer",
    icon: GitBranch,
    title: "A block that reshapes context.",
    subtitle: "Follow a tiny Transformer step by step, then compare two ways words can look around.",
    label: "See the parts inside a Transformer",
    step: "04",
    accent: "#b19aff",
  },
  {
    id: "transformer",
    name: "Next token",
    short: "Next token",
    icon: Cpu,
    title: "One token, many transformations.",
    subtitle: "Trace a tiny decoder from input pieces to its next-token choice.",
    label: "Walk through a transformer forward pass",
    step: "05",
    accent: "#edb18c",
  },
  {
    id: "attention",
    name: "Attention",
    short: "Attention",
    icon: Network,
    title: "Context becomes a weighted conversation.",
    subtitle: "Inspect which earlier tokens each position can use, and how strongly.",
    label: "See contextual routing in action",
    step: "06",
    accent: "#72c7bd",
  },
  {
    id: "prompt",
    name: "Prompt sandbox",
    short: "Prompts",
    icon: Braces,
    title: "A better prompt starts here.",
    subtitle: "Build with intent. Compare iterations. Make every token count.",
    label: "Turn instructions into understanding",
    step: "07",
    accent: "#f3ba94",
  },
] as const;
type TabId = (typeof tabs)[number]["id"];
const slopLabCopy: Record<
  TabId,
  { name: string; short: string; title: string; subtitle: string; label: string }
> = {
  tokenizer: {
    name: "Slopinizer",
    short: "Slopinize",
    title: "Every word can become premium slop.",
    subtitle: "Feed it a thought. Watch it emerge fluent, glossy, and gloriously vague.",
    label: "Measure the magnificent mush",
  },
  context: {
    name: "Slop Context",
    short: "Slop context",
    title: "A window into the slop dimension.",
    subtitle: "See how much context it takes to keep the vibes technically aligned.",
    label: "Protect the precious slop budget",
  },
  flow: {
    name: "Slop Flow",
    short: "Slop flow",
    title: "One tool call. Infinite synergy.",
    subtitle: "Trace the signals, retain the buzzwords, and let the context marinate.",
    label: "Follow the value-add journey",
  },
  "transformer-block": {
    name: "Slop Transformer",
    short: "Transform",
    title: "One block. Unlimited transformation.",
    subtitle: "Watch the premium vectors become even more strategically vector-shaped.",
    label: "Follow the values through the vibes",
  },
  prompt: {
    name: "Slop Constructor",
    short: "Construct",
    title: "Build boldly. Clarify never.",
    subtitle: "Assemble a prompt with maximum polish and a strategically flexible point.",
    label: "Engineer the perfect nothingburger",
  },
  transformer: {
    name: "Slop Decoder",
    short: "Decode",
    title: "One token. Infinite alignment.",
    subtitle: "Follow the vibes through each premium transformation.",
    label: "Witness the synergy forward pass",
  },
  attention: {
    name: "Slop Attention",
    short: "Attention",
    title: "Everything looks at everything. Sort of.",
    subtitle: "Measure the relational resonance of every carefully aligned vibe.",
    label: "Route the context strategically",
  },
};
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
  const [slopMode, setSlopMode] = useState(false);
  const brandClicks = useRef(0);
  const slopModeActivatedAt = useRef(0);
  const [visited, setVisited] = usePersistentState<string[]>(
    "context-lab:visited",
    ["tokenizer"],
    (v): v is string[] =>
      Array.isArray(v) &&
      v.every((x) => typeof x === "string" && tabs.some((t) => t.id === x)),
  );
  const displayedTabs = slopMode
    ? tabs.map((tab) => ({ ...tab, ...slopLabCopy[tab.id] }))
    : tabs;
  const active = displayedTabs.find((t) => t.id === tab)!;
  const navigate = (next: TabId) => {
    setTab(next);
    setVisited((v) => Array.from(new Set([...v, next])));
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const activateBrand = () => {
    if (slopMode) {
      if (Date.now() - slopModeActivatedAt.current < 750) return;
      brandClicks.current = 0;
      setSlopMode(false);
      navigate("tokenizer");
      return;
    }
    brandClicks.current += 1;
    if (brandClicks.current >= 5) {
      slopModeActivatedAt.current = Date.now();
      setSlopMode(true);
    }
    navigate("tokenizer");
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
            activateBrand();
          }}
        >
          <span className="brand-mark">
            <Layers3 size={23} strokeWidth={1.65} />
          </span>
          <span className="brand-copy" style={{ display: "grid" }}>
            {slopMode ? (
              <>
                <span>SLOP<span className="brand-light">lab</span></span>
                <span
                  className="brand-academy"
                  style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3, color: "var(--mint)", fontSize: 7, fontWeight: 550, letterSpacing: "0.8px", lineHeight: 1, whiteSpace: "nowrap" }}
                >
                  <Smile size={11} /> AI SLOP Academy
                </span>
              </>
            ) : (
              <span>context<span className="brand-light">lab</span><span className="brand-dot">.</span></span>
            )}
          </span>
        </a>
        <div className="workspace-label">
          <span className="tiny-icon">
            <FlaskConical size={14} />
          </span>{" "}
          {slopMode ? "Vibes engineering workshop" : "LLM mechanics workshop"} <ChevronDown size={13} />
        </div>
        <div className="nav-eyebrow">
          THE PLAYGROUND <span>07</span>
        </div>
        <nav className="nav-list">
          {displayedTabs.map((t) => (
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
            <br />{slopMode ? "A lot of slop." : "A lot of clarity."}
          </h3>
          <p>{slopMode ? "No clear answers. Just hands-on vibes." : "No black boxes. Just hands-on experiments."}</p>
          <div className="lesson-progress">
            {tabs.map((t) => (
              <span
                key={t.id}
                className={visited.includes(t.id) ? "done" : ""}
              />
            ))}
          </div>
          <div className="lesson-count">
            {visited.length} of {tabs.length} labs explored <ArrowUpRight size={13} />
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
            <button
              type="button"
              className="mobile-brand brand-title-trigger"
              aria-label="Context Lab home"
              onClick={activateBrand}
              style={{ border: 0, background: "transparent", padding: 0, textAlign: "left" }}
            >
              <Layers3 size={20} />
              <span className="brand-copy" style={{ display: "grid" }}>
                {slopMode ? (
                  <>
                    <span>SLOP<span className="brand-light">lab</span></span>
                    <span
                      className="brand-academy"
                      style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2, color: "var(--mint)", fontSize: 6, fontWeight: 550, letterSpacing: "0.7px", lineHeight: 1, whiteSpace: "nowrap" }}
                    >
                      <Smile size={9} /> AI SLOP Academy
                    </span>
                  </>
                ) : (
                  <span>contextlab.</span>
                )}
              </span>
            </button>
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
          {displayedTabs.map((t) => (
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
            {tab === "transformer-block" && <TransformerBlockLab />}
            {tab === "transformer" && <TransformerLab />}
            {tab === "attention" && <AttentionLab />}
          </div>
          <footer className="page-footer">
            <span className="footer-curiosity">
              <Rocket size={13} /> {slopMode ? "Built for vibes." : "Built for curiosity."}
            </span>
            <span className="footer-attribution">
              <span>© 2016-2026</span>
              <a href="https://onpy.dev" target="_blank" rel="noreferrer">
                Viktor Moyseyenko
              </a>
            </span>
            <span className="footer-mantra">
              {slopMode ? (
                <>SLOP LAB <span className="footer-dot">·</span> GENERATE. GESTURE. REPEAT.</>
              ) : (
                <>CONTEXT LAB <span className="footer-dot">·</span> EXPERIMENT. UNDERSTAND. REPEAT.</>
              )}
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
  const [costDirection, setCostDirection] = useState<"input" | "cached-input" | "output">(
    "input",
  );
  const [costMultiplier, setCostMultiplier] = useState<1 | 1000>(1);
  const [showRates, setShowRates] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  useEffect(() => {
    setCopyMessage("");
  }, [text]);
  const [sample, setSample] = useState<keyof typeof samples>("prose");
  const [inputView, setInputView] = useState<"text" | "tokens">("text");
  const pricingAnchor = useRef<HTMLDivElement>(null);
  const counts = useMemo(() => compareModelTokens(text), [text]);
  const costs = useMemo(
    () =>
      models.map((model, index) =>
        model.pricing.map(
          (price) =>
            (counts[index] *
              (costDirection === "input"
                ? price.input
                : costDirection === "cached-input"
                  ? price.cachedInput
                  : price.output)) /
            1000000,
        ),
      ),
    [counts, costDirection],
  );
  const selectedCosts = costs;
  const values =
    metric === "tokens"
      ? counts
      : selectedCosts.map(
          (modelCosts) => Math.max(...modelCosts) * costMultiplier,
        );
  const peak = Math.max(...values, 0);
  const magnitude = peak > 0 ? 10 ** Math.floor(Math.log10(peak)) : 1;
  const max =
    peak > 0
      ? ([1, 2, 5, 10].find((tick) => tick * magnitude >= peak) ?? 10) *
        magnitude
      : metric === "tokens"
        ? 100
        : 0.001;
  const openAITokens = counts[3] ?? 0;
  const openAIPieces = useMemo(() => openAITokenPieces(text, 160), [text]);
  useEffect(() => {
    if (!showRates) return;
    const closeOnFocusOutside = (event: FocusEvent) => {
      if (event.target instanceof Node && !pricingAnchor.current?.contains(event.target)) {
        setShowRates(false);
      }
    };
    document.addEventListener("focusin", closeOnFocusOutside);
    return () => document.removeEventListener("focusin", closeOnFocusOutside);
  }, [showRates]);
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
            <div className="input-header-actions">
              <div className="segmented input-view-switch" role="group" aria-label="Input view">
                <IconButton
                  icon={FileText}
                  className={inputView === "text" ? "active" : ""}
                  onClick={() => setInputView("text")}
                  aria-pressed={inputView === "text"}
                >
                  Text
                </IconButton>
                <IconButton
                  icon={ScanText}
                  className={inputView === "tokens" ? "active" : ""}
                  onClick={() => setInputView("tokens")}
                  aria-pressed={inputView === "tokens"}
                >
                  Tokens
                </IconButton>
              </div>
            </div>
          </div>
          {inputView === "text" ? (
            <>
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
            </>
          ) : (
            <div className="token-map" aria-label="Exact o200k_base token map">
              <span className="token-map-label">Exact OpenAI token map</span>
              <div className="token-map-pieces">
                {openAIPieces.length ? (
                  openAIPieces.map((piece, index) => (
                    <span
                      className={`token-piece token-piece-${index % 6}`}
                      key={`${piece.id}-${index}`}
                      title={`Token ID ${piece.id}`}
                    >
                      <span className="token-piece-text">
                        {piece.text.replaceAll(" ", "·").replaceAll("\n", "↵").replaceAll("\t", "⇥") || "∅"}
                      </span>
                      <small>{piece.id}</small>
                    </span>
                  ))
                ) : (
                  <span className="muted">Your tokens will appear here.</span>
                )}
                {openAITokens > openAIPieces.length && (
                  <span className="token-map-more">
                    +{formatNumber(openAITokens - openAIPieces.length)} more
                  </span>
                )}
              </div>
            </div>
          )}
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
              <strong>{formatNumber(openAITokens)}</strong>
              <span>OpenAI · exact o200k_base</span>
            </div>
          </div>
        </section>
        <section className="panel chart-panel">
          <div className="panel-header">
            <SectionLabel icon={AudioLines}>Model comparison</SectionLabel>
            <div className="chart-header-actions">
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
            </div>
            <div
              className="chart-pricing-anchor"
              ref={pricingAnchor}
            >
              <IconButton
                icon={CircleDollarSign}
                className={`btn-ghost chart-pricing-button ${showRates ? "active" : ""}`}
                onClick={() => setShowRates((value) => !value)}
                aria-label="Open API pricing reference"
                title="Open API pricing reference"
                aria-expanded={showRates}
              />
              {showRates && (
                <div className="chart-pricing-popover" role="dialog" aria-label="API pricing reference">
                  <div className="chart-pricing-popover-header">
                    <strong>API pricing reference</strong>
                    <span>USD per 1M tokens</span>
                  </div>
                  <PricingTable />
                  <PricingSources />
                </div>
              )}
            </div>
            </div>
          </div>
          {metric === "cost" && (
            <div className="chart-cost-controls">
              <div
                className="segmented"
                role="group"
                aria-label="Cost token direction"
              >
                <IconButton
                  icon={ArrowRight}
                  className={costDirection === "input" ? "active" : ""}
                  onClick={() => setCostDirection("input")}
                  aria-pressed={costDirection === "input"}
                >
                  Input
                </IconButton>
                <IconButton
                  icon={History}
                  className={costDirection === "cached-input" ? "active" : ""}
                  onClick={() => setCostDirection("cached-input")}
                  aria-pressed={costDirection === "cached-input"}
                >
                  Cached
                </IconButton>
                <IconButton
                  icon={ArrowUpRight}
                  className={costDirection === "output" ? "active" : ""}
                  onClick={() => setCostDirection("output")}
                  aria-pressed={costDirection === "output"}
                >
                  Output
                </IconButton>
              </div>
              <IconButton
                icon={Layers3}
                className={`btn-ghost btn-small ${costMultiplier === 1000 ? "active" : ""}`}
                onClick={() =>
                  setCostMultiplier((value) => (value === 1 ? 1000 : 1))
                }
                aria-pressed={costMultiplier === 1000}
              >
                x1000
              </IconButton>
            </div>
          )}

          <div className="model-chart">
            {models.map((m, i) => {
              const modelCosts = selectedCosts[i].map(
                (cost) => cost * costMultiplier,
              );
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
        </section>
      </div>
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
      "CONTEXT LAB — TAKE-HOME NOTES\n\n1. TOKENIZER\nLanguage models do not read whole words in the way people do. They work with tokens: pieces that may be words, word fragments, spaces, or punctuation. Different text can use very different numbers of tokens, so concise input can be easier and cheaper for a model to process.\n\n2. CONTEXT WINDOW\nA model has a limited working desk called a context window. Instructions, conversation history, tools, images, and tool results all compete for that space. A useful answer needs room too, so long conversations eventually need trimming, summarizing, or restarting.\n\n3. SESSION EMULATION\nAn agent does not forget a tool result just because the tool finished. If the host keeps it, that result becomes part of later context and adds cost and clutter. Compaction saves space by keeping the main idea while giving up detail.\n\n4. NEXT TOKEN\nA language model generates one token at a time. It turns tokens into numeric features, mixes relevant earlier context with attention, transforms those features through layers, scores possible next tokens, then samples or chooses one. The model repeats that loop to make a response.\n\n5. ATTENTION\nAttention is a context-routing mechanism. For each token, it decides how much information to borrow from allowed earlier tokens. A large attention weight means one head used more of that token's value; it does not by itself explain the model's final reasoning or guarantee importance.\n\n6. PROMPT SANDBOX\nA prompt is part instruction, part context, and part interface contract. Clear roles, task details, examples, constraints, and output formats can reduce ambiguity. More prompt tokens are only worthwhile when they make the intended result clearer.\n\nTHE BIG IDEA\nLLMs are not databases of perfect answers. They are systems that use limited context and learned patterns to predict the next token. Good results come from useful context, clear constraints, careful tool use, and checking important outputs.\n";
    const notes = "CONTEXT LAB — TAKE-HOME NOTES\n\n1. TOKENIZER\nLanguage models work with tokens: pieces that may be words, word fragments, spaces, or punctuation. Different text can use very different numbers of tokens.\n\n2. CONTEXT WINDOW\nA model has a limited working desk called a context window. Instructions, conversation history, tools, images, and tool results all compete for that space.\n\n3. SESSION EMULATION\nIf the host keeps a tool result, it becomes part of later context and adds cost and clutter. Compaction saves space by keeping the main idea while giving up detail.\n\n4. TRANSFORMER BLOCK\nA Transformer block changes every token's number card into a new, context-aware vector. It normalizes values, borrows allowed information with attention, keeps the old vector through residual connections, then uses an MLP to make another update. The block does not create a new word.\n\n5. NEXT TOKEN\nA decoder-only model can send its final token vector to a vocabulary scorer. Scores become probabilities, then the model chooses or samples the next token. It repeats that loop to make a response.\n\n6. ATTENTION\nAttention is a context-routing mechanism. For each token, it decides how much information to borrow from allowed tokens. A high weight is one routing share, not a complete explanation of the model's final reasoning.\n\n7. PROMPT SANDBOX\nA prompt is part instruction, part context, and part interface contract. Clear roles, task details, examples, constraints, and output formats can reduce ambiguity.\n\nTHE BIG IDEA\nLLMs use limited context and learned patterns to predict tokens. Good results come from useful context, clear constraints, careful tool use, and checking important output.";
    const url = URL.createObjectURL(
      new Blob([notes], { type: "text/plain" }),
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
        Six small experiments to make large language models feel a little less
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
            icon: Cpu,
            title: "04 / Follow one next-token choice",
            text: "Walk through token embeddings, attention, logits, and sampling. Which stage changes a probability rather than choosing a token?",
          },
          {
            icon: Network,
            title: "05 / Inspect attention as a matrix",
            text: "Select a query token and head. Where is the causal mask, and what does a high weight actually say?",
          },
          {
            icon: Braces,
            title: "06 / Give instructions a structure",
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
