import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  Code2,
  Database,
  Eraser,
  Expand,
  FileCode2,
  FileText,
  Gauge,
  History,
  Image,
  Info,
  Layers3,
  Lightbulb,
  LockKeyhole,
  MessageSquare,
  RotateCcw,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  WandSparkles,
  Workflow,
} from "lucide-react";
import {
  allocationTotal,
  compact,
  compactEntries,
  contextAllocationKeys,
  contextCapacityOptions,
  contextColors,
  contextPreset,
  conversationImageInputTokens,
  conversationImageTokens,
  conversationInputTokens,
  conversationOutputTokens,
  conversationReasoningMaxTokens,
  conversationReasoningTokens,
  fitAllocations,
  flowBase,
  flowBootEntries,
  flowCapacity,
  flowMcpTools,
  flowUsed,
  formatNumber,
  hasLoadedMcpSchema,
  modelPriceOptions,
  retainCall,
  retainConversation,
  requestCost,
  reservedContextBuffer,
} from "./logic";
import type {
  ContextAllocationKey,
  ContextAllocations,
  ContextCapacity,
  FlowEntry,
} from "./logic";
import {
  IconButton,
  HoverTooltip,
  InfoTooltip,
  SectionLabel,
  TooltipNote,
  usePersistentState,
} from "./ui";
import { PricingSources, PricingTable } from "./PricingReference";

const contextItems = [
  {
    key: "systemPrompt",
    label: "System prompt",
    icon: Sparkles,
    tip: (
      <>
        <strong>System prompt</strong> is fixed host and model guidance that
        sets behavior, safety boundaries, and the working role before your
        first message.
      </>
    ),
  },
  {
    key: "systemTools",
    label: "System tools",
    icon: Settings2,
    tip: (
      <>
        <strong>System tools</strong> are host-provided capabilities such as
        file editing, terminal access, or browser control. Their names,
        descriptions, and parameter schemas must be available to the model.
      </>
    ),
  },
  {
    key: "memoryFiles",
    label: "Memory files",
    icon: FileCode2,
    tip: (
      <>
        <strong>Memory files</strong> are project or user instructions loaded
        into the request, such as <code>CLAUDE.md</code>, <code>AGENTS.md</code>,
        and <code>copilot-instructions.md</code>.
      </>
    ),
  },
  {
    key: "skills",
    label: "Skills",
    icon: WandSparkles,
    tip: (
      <>
        <strong>Skills</strong> are reusable instruction packages. Their headers
        or full instructions consume context only when the host makes them
        available to the model.
      </>
    ),
  },
  {
    key: "mcpTools",
    label: "MCP tools",
    icon: Workflow,
    tip: (
      <>
        <strong>MCP tools</strong> come from connected Model Context Protocol
        servers. A host may inject full schemas at startup or defer them until
        they are relevant.
      </>
    ),
  },
  {
    key: "conversationHistory",
    label: "Conversation history",
    icon: History,
    tip: (
      <>
        <strong>Conversation history</strong> is the retained sequence of user
        prompts and assistant answers from earlier turns.
      </>
    ),
  },
  {
    key: "toolResults",
    label: "Tool results",
    icon: Terminal,
    tip: (
      <>
        <strong>Tool results</strong> are the returned files, searches, command
        output, test logs, and other artifacts retained after a tool call. They
        are usually the fastest-growing part of an agent session.
      </>
    ),
  },
  {
    key: "customAgents",
    label: "Custom agents",
    icon: FileText,
    tip: (
      <>
        <strong>Custom agents</strong> are reusable specialist definitions the
        host makes available in this session. Their instructions and metadata
        occupy context when loaded.
      </>
    ),
  },
] as const;
type ContextFocus = ContextAllocationKey | "freeSpace" | "reservedBuffer" | null;
const isContextCapacity = (value: unknown): value is ContextCapacity =>
  typeof value === "number" &&
  contextCapacityOptions.includes(value as ContextCapacity);

export function ContextLabView() {
  const [capacity, setCapacity] = usePersistentState<ContextCapacity>(
    "context-lab:context-capacity:v2",
    200000,
    isContextCapacity,
  );
  const [overrides, setOverrides] = useState<ContextAllocations | null>(null);
  const [focused, setFocused] = useState<ContextFocus>(null);
  const amounts = fitAllocations(overrides ?? contextPreset, capacity);
  const used = allocationTotal(amounts);
  const reservedBuffer = reservedContextBuffer(capacity);
  const freeSpace = Math.max(0, capacity - used - reservedBuffer);
  const all = [
    ...contextItems.map((item) => ({ ...item, tokens: amounts[item.key] })),
    {
      key: "freeSpace" as const,
      label: "Free space",
      icon: Expand,
      tokens: freeSpace,
      tip: (
        <>
          <strong>Free space</strong> is capacity still available for more
          messages, tool results, and generated output.
        </>
      ),
    },
    {
      key: "reservedBuffer" as const,
      label: "Reserved buffer",
      icon: Expand,
      tokens: reservedBuffer,
      tip: (
        <>
          <strong>Reserved buffer</strong> is protected unused room in the
          context window. It cannot be assigned by the sliders, leaving space
          for compaction, future tool results, and the model's generated answer.
        </>
      ),
    },
  ];
  const radius = 116;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <>
      <div className="lab-toolbar">
        <div className="section-kicker">
          <span className="live-dot mint" />
          CONTEXT ANATOMY
        </div>
        <span className="badge">INTERACTIVE MODEL</span>
      </div>
      <div className="context-layout">
        <section className="panel context-dial-panel">
          <div className="panel-header">
            <SectionLabel icon={Gauge}>Inside the window</SectionLabel>
            <span className="badge badge-mint">
              {compact(capacity)} CAPACITY
            </span>
          </div>
          <div className="context-size-control">
            <span>Context window size</span>
            <div
              className="segmented"
              role="group"
              aria-label="Context window size"
            >
              {contextCapacityOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`btn ${capacity === option ? "active" : ""}`}
                  onClick={() => {
                    setCapacity(option);
                    setFocused(null);
                  }}
                  aria-pressed={capacity === option}
                >
                  {compact(option)}
                </button>
              ))}
            </div>
          </div>
          <div className="context-dial">
            <svg
              viewBox="0 0 320 320"
              role="img"
              aria-label={`Shared context: ${formatNumber(used)} of ${formatNumber(capacity)} context tokens used`}
            >
              <circle
                cx="160"
                cy="160"
                r="142"
                fill="none"
                stroke="#292a37"
                strokeWidth="1"
                strokeDasharray="2 7"
              />
              <circle
                cx="160"
                cy="160"
                r="116"
                fill="none"
                stroke="#21222d"
                strokeWidth="36"
              />
              {all.map((item) => {
                const start = offset;
                const length = (item.tokens / capacity) * circumference;
                offset += length;
                return (
                  <circle
                    key={item.key}
                    cx="160"
                    cy="160"
                    r={radius}
                    fill="none"
                    stroke={
                      item.key === "reservedBuffer"
                        ? contextColors.reservedBuffer
                        : contextColors[item.key]
                    }
                    strokeWidth={focused === item.key ? 42 : 34}
                    strokeDasharray={`${Math.max(0, length - 5)} ${circumference - Math.max(0, length - 5)}`}
                    strokeDashoffset={-start}
                    transform="rotate(-90 160 160)"
                    className="context-segment"
                    aria-label={`${item.label}: ${formatNumber(item.tokens)} tokens`}
                    style={{
                      opacity:
                        focused === null || focused === item.key ? 1 : 0.35,
                    }}
                    onMouseEnter={() => setFocused(item.key)}
                    onMouseLeave={() => setFocused(null)}
                  >
                    <title>{`${item.label}: ${formatNumber(item.tokens)} tokens (${((item.tokens / capacity) * 100).toFixed(1)}%)`}</title>
                  </circle>
                );
              })}
              <circle
                cx="160"
                cy="160"
                r="87"
                fill="none"
                stroke="#292a37"
                strokeWidth="1"
              />
            </svg>
            <div className="dial-center">
              <span>
                {focused === null
                  ? "CONTEXT USED"
                  : all.find((item) => item.key === focused)?.label}
              </span>
              <strong>
                {compact(
                  focused === null
                    ? used
                    : (all.find((item) => item.key === focused)?.tokens ?? 0),
                )}
                <small>tokens</small>
              </strong>
              <span className="dial-percent">
                {Math.round(
                  ((focused === null
                    ? used
                    : (all.find((item) => item.key === focused)?.tokens ?? 0)) /
                    capacity) *
                    100,
                )}
                % of {compact(capacity)}
              </span>
            </div>
          </div>
          <div className="context-summary">
            <div>
              <span className="status-dot" /> Available for what is next
            </div>
            <strong>
              {formatNumber(freeSpace)} <small>tokens</small>
            </strong>
          </div>
        </section>
        <section className="panel allocation-panel">
          <div className="panel-header">
            <SectionLabel icon={Layers3}>What's taking up space?</SectionLabel>
            <IconButton
              icon={RotateCcw}
              className="btn-ghost btn-small"
              onClick={() => setOverrides(null)}
            >
              Reset
            </IconButton>
          </div>
          <div className="allocation-intro">
            <h3>
              Shared context <span>- host-agnostic teaching profile</span>
            </h3>
            <p>Adjust a category. The remaining space updates immediately.</p>
          </div>
          <div className="allocation-list">
            {all.map((item) => {
              const Icon = item.icon;
              const adjustable =
                item.key !== "freeSpace" && item.key !== "reservedBuffer";
              const description =
                item.key === "memoryFiles"
                  ? "Loaded host guidance. Common names include CLAUDE.md, AGENTS.md, and copilot-instructions.md."
                  : item.key === "toolResults"
                    ? "Files, greps, command output, and test logs retained for later turns."
                    : item.key === "customAgents"
                      ? "Specialist agent definitions available to this session."
                  : adjustable
                    ? "Use the slider to model this active context category."
                    : item.key === "freeSpace"
                      ? "Available for more messages, tool results, and generated output."
                      : "Protected capacity for compaction before the window is full.";
              return (
                <div
                  key={item.key}
                  className={`allocation-item ${focused === item.key ? "focused" : ""}`}
                  onMouseEnter={() => setFocused(item.key)}
                  onMouseLeave={() => setFocused(null)}
                >
                  <div className="allocation-title">
                    <span
                      className="allocation-icon"
                      style={{
                        color:
                          item.key === "reservedBuffer"
                            ? contextColors.reservedBuffer
                            : contextColors[item.key],
                      }}
                    >
                      <Icon size={18} />
                    </span>
                    <strong>{item.label}</strong>
                    <InfoTooltip label={`Explain ${item.label}`}>
                      {item.tip}
                    </InfoTooltip>
                    <span className="mono">
                      {formatNumber(item.tokens)}
                      <small>
                        {((item.tokens / capacity) * 100).toFixed(1)}%
                      </small>
                    </span>
                  </div>
                  <p>{description}</p>
                  {adjustable && (
                    <input
                      type="range"
                      aria-label={`${item.label} tokens`}
                      min={0}
                      max={Math.max(
                        0,
                        capacity - reservedBuffer - used + item.tokens,
                      )}
                      step={item.key === "conversationHistory" ? 1 : 100}
                      value={item.tokens}
                      style={
                        {
                          accentColor: contextColors[item.key],
                        } as CSSProperties
                      }
                      onFocus={() => setFocused(item.key)}
                      onBlur={() => setFocused(null)}
                      onChange={(event) =>
                        setOverrides({
                          ...amounts,
                          [item.key]: Number(event.target.value),
                        })
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <div className="learning-callout mint-callout">
        <div className="callout-icon">
          <Lightbulb size={20} />
        </div>
        <div>
          <h3>It is a working memory, not a hard drive.</h3>
          <p>
            Each active category shares a finite budget. More context can help,
            but it still needs room for the response.
          </p>
        </div>
      </div>
      <TooltipNote>
        These are interactive teaching profiles, not provider guarantees. A host
        decides what instructions, files, tool definitions, results, and message
        history to include in every request.
      </TooltipNote>
    </>
  );
}

const callTypes = [
  {
    id: "search",
    kind: "mcp" as const,
    name: "Search documents",
    detail: "6 retrieved passages",
    resultTokens: flowMcpTools.search.resultTokens,
    schemaTokens: flowMcpTools.search.schemaTokens,
    icon: Search,
    color: "#8baffb",
  },
  {
    id: "database",
    kind: "mcp" as const,
    name: "Query database",
    detail: "20 structured records",
    resultTokens: flowMcpTools.database.resultTokens,
    schemaTokens: flowMcpTools.database.schemaTokens,
    icon: Database,
    color: "#8baffb",
  },
  {
    id: "review",
    kind: "skill" as const,
    name: "Code review skill",
    detail: "Review output retained",
    resultTokens: 1800,
    icon: Code2,
    color: "#b19aff",
  },
  {
    id: "brief",
    kind: "skill" as const,
    name: "Summarizer skill",
    detail: "Summary retained",
    resultTokens: 900,
    icon: WandSparkles,
    color: "#b19aff",
  },
  {
    id: "message",
    kind: "message" as const,
    name: "Continue conversation",
    detail: "600 input + 2-3K output + 0.8-1.6K thinking",
    resultTokens: 0,
    inputTokens: conversationInputTokens,
    icon: MessageSquare,
    color: "#90d9c1",
  },
  {
    id: "image",
    kind: "message" as const,
    name: "Attach image",
    detail: "600 text + 1.56K image + 2-3K output + 0.8-1.6K thinking",
    resultTokens: 0,
    inputTokens: conversationImageInputTokens,
    imageTokens: conversationImageTokens,
    icon: Image,
    color: "#ef9fca",
  },
];
const validEntries = (value: unknown): value is FlowEntry[] =>
  Array.isArray(value) &&
  value.length <= 200 &&
  value.every(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      ["mcp-schema", "mcp-result", "skill-result", "message"].includes(
        (entry as FlowEntry).kind,
      ) &&
      typeof (entry as FlowEntry).name === "string" &&
      Number.isFinite((entry as FlowEntry).id) &&
      Number.isFinite((entry as FlowEntry).tokens) &&
      (entry as FlowEntry).tokens > 0 &&
      Number.isFinite((entry as FlowEntry).originalTokens) &&
      (entry as FlowEntry).originalTokens >= (entry as FlowEntry).tokens &&
      ((entry as FlowEntry).reasoningTokens === undefined ||
        (Number.isFinite((entry as FlowEntry).reasoningTokens) &&
          (entry as FlowEntry).reasoningTokens! >= 0 &&
          (entry as FlowEntry).reasoningTokens! <= (entry as FlowEntry).tokens)) &&
      typeof (entry as FlowEntry).summarized === "boolean",
  ) &&
  flowUsed(value as FlowEntry[]) <= flowCapacity;
const entryColor = (entry: FlowEntry): string =>
  entry.cached
    ? "#63748f"
    : entry.kind === "mcp-schema" || entry.kind === "mcp-result"
      ? "#8baffb"
      : entry.kind === "skill-result"
        ? "#b19aff"
        : "#90d9c1";
const isFlowModelPriceOption = (value: unknown): value is string =>
  typeof value === "string" &&
  modelPriceOptions.some((option) => option.id === value);
function flowEntryExplanation(entry: FlowEntry) {
  if (entry.summarized) {
    return "Compacted summary: the host replaced the original retained content with a shorter summary, freeing context but losing detail.";
  }
  if (entry.kind === "mcp-schema") {
    return "MCP schema: the model receives the tool name, description, and parameter contract so it can construct valid calls. This simulator loads it once per tool.";
  }
  if (entry.kind === "mcp-result") {
    return "MCP result: the tool's returned data remains available to later turns while the host keeps it in context.";
  }
  if (entry.kind === "skill-result") {
    return "Skill result: output from a reusable instruction package. Its skill header was already available at session boot.";
  }
  if (entry.reasoningTokens) {
    return "Conversation message with reasoning: the model generated internal reasoning in addition to its visible final answer. Both are output tokens, billed at the output rate, and retained when the host keeps the turn in context.";
  }
  return entry.cached
    ? "Cached message: an older conversation round retained by the host. It still uses context space, but can qualify for a cached-input price." 
    : entry.imageTokens
      ? "Image attachment: a text instruction plus image visual tokens and generated assistant output retained for later turns. This simulation uses a standard-tier 1920x1080 image at 1,560 visual tokens."
      : "Current message: the latest conversation round, including the user's input and generated assistant output, retained for the next turn.";
}

export function FlowLabView() {
  const [entries, setEntries] = usePersistentState<FlowEntry[]>(
    "context-lab:flow:v2",
    [],
    validEntries,
  );
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState(
    "This session starts with system, deferred-MCP, and skill-header context.",
  );
  const [resetConfirm, setResetConfirm] = useState(false);
  const [showRequestCost, setShowRequestCost] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showRates, setShowRates] = useState(false);
  const [autoScroll, setAutoScroll] = usePersistentState(
    "context-lab:flow-auto-scroll:v1",
    true,
    (value): value is boolean => typeof value === "boolean",
  );
  const [simulateReasoning, setSimulateReasoning] = usePersistentState(
    "context-lab:flow-reasoning:v1",
    false,
    (value): value is boolean => typeof value === "boolean",
  );
  const [modelOptionId, setModelOptionId] = usePersistentState<string>(
    "context-lab:flow-model:v1",
    "claude-sonnet-5-Standard",
    isFlowModelPriceOption,
  );
  const [useCachedInputRate, setUseCachedInputRate] = usePersistentState(
    "context-lab:flow-cached-input-rate:v1",
    true,
    (value): value is boolean => typeof value === "boolean",
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pricingAnchor = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (!showPricing) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !pricingAnchor.current?.contains(event.target)
      ) {
        setShowPricing(false);
      }
    };
    window.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => window.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [showPricing]);
  useEffect(() => {
    if (!autoScroll || !entries.length) return;
    const timeline = timelineRef.current;
    timeline?.scrollTo({ top: timeline.scrollHeight, behavior: "smooth" });
  }, [autoScroll, entries.length]);
  const used = flowUsed(entries);
  const percent = (used / flowCapacity) * 100;
  const mcp = entries
    .filter(
      (entry) => entry.kind === "mcp-schema" || entry.kind === "mcp-result",
    )
    .reduce((total, entry) => total + entry.tokens, 0);
  const skills = entries
    .filter((entry) => entry.kind === "skill-result")
    .reduce((total, entry) => total + entry.tokens, 0);
  const messageInput = entries
    .filter((entry) => entry.kind === "message")
    .reduce((total, entry) => total + (entry.inputTokens ?? 0), 0);
  const messageOutput = entries
    .filter((entry) => entry.kind === "message")
    .reduce((total, entry) => total + (entry.outputTokens ?? 0), 0);
  const reasoning = entries.reduce(
    (total, entry) => total + (entry.reasoningTokens ?? 0),
    0,
  );
  const selectedModel =
    modelPriceOptions.find((option) => option.id === modelOptionId) ??
    modelPriceOptions[0];
  const cachedInputTokens = useCachedInputRate ? used : 0;
  const pricedInputTokens = used - cachedInputTokens;
  const nextOutputTokens = 2500;
  const nextRequestCost = (retainedTokens: number) =>
    requestCost(
      useCachedInputRate ? 0 : retainedTokens,
      useCachedInputRate ? retainedTokens : 0,
      nextOutputTokens,
      selectedModel.price,
      useCachedInputRate,
    );
  const estimatedNextRequestCost = nextRequestCost(used);
  function addedTokens(
    call: (typeof callTypes)[number],
    assistantOutputTokens?: number,
  ) {
    if (call.kind === "message") {
      return call.inputTokens + (assistantOutputTokens ?? 2500) +
        (simulateReasoning ? conversationReasoningMaxTokens : 0);
    }
    return call.kind === "mcp" && !hasLoadedMcpSchema(entries, call.id)
      ? call.resultTokens + call.schemaTokens
      : call.resultTokens;
  }
  function trigger(call: (typeof callTypes)[number]) {
    if (pending) return;
    const assistantOutputTokens =
      call.kind === "message" ? conversationOutputTokens() : undefined;
    const reasoningTokens =
      call.kind === "message" && simulateReasoning
        ? conversationReasoningTokens()
        : 0;
    const incoming = addedTokens(call, assistantOutputTokens);
    if (used + incoming > flowCapacity) {
      setNotice(
        "Not enough context. Compact retained results or start a fresh session.",
      );
      return;
    }
    setPending(call.id);
    setNotice(
      call.kind === "mcp" && !hasLoadedMcpSchema(entries, call.id)
        ? `Loading ${call.name.toLowerCase()} schema, then running it...`
        : `Simulating ${call.name.toLowerCase()}...`,
    );
    timer.current = setTimeout(() => {
      setEntries((current) => {
        let next = current;
        const timestamp = Date.now();
        if (call.kind === "mcp" && !hasLoadedMcpSchema(next, call.id)) {
          const schema: FlowEntry = {
            id: timestamp,
            name: `${call.name} schema loaded`,
            kind: "mcp-schema",
            tokens: call.schemaTokens,
            originalTokens: call.schemaTokens,
            summarized: false,
            toolId: call.id,
          };
          next = retainCall(next, schema) ?? next;
        }
        const result: FlowEntry = {
          id: timestamp + 1,
          name: call.name,
          kind:
            call.kind === "mcp"
              ? "mcp-result"
              : call.kind === "skill"
                ? "skill-result"
                : "message",
          tokens:
            call.kind === "message"
              ? call.inputTokens + assistantOutputTokens! + reasoningTokens
              : call.resultTokens,
          originalTokens:
            call.kind === "message"
              ? call.inputTokens + assistantOutputTokens! + reasoningTokens
              : call.resultTokens,
          summarized: false,
          toolId: call.kind === "mcp" ? call.id : undefined,
          inputTokens: call.kind === "message" ? call.inputTokens : undefined,
          imageTokens: call.kind === "message" ? call.imageTokens : undefined,
          outputTokens: assistantOutputTokens,
          reasoningTokens: reasoningTokens || undefined,
        };
        return call.kind === "message"
          ? (retainConversation(next, result) ?? next)
          : (retainCall(next, result) ?? next);
      });
      setPending(null);
      setNotice(
        call.kind === "message"
          ? `${call.name}: ${call.imageTokens ? `${formatNumber(conversationInputTokens)} text + ${formatNumber(call.imageTokens)} image` : formatNumber(call.inputTokens)} input + ${formatNumber(assistantOutputTokens!)} assistant output${reasoningTokens ? ` + ${formatNumber(reasoningTokens)} reasoning output` : ""} tokens retained in this session.`
          : `${call.name}: ${formatNumber(incoming)} tokens added${call.kind === "mcp" && incoming > call.resultTokens ? " for schema + result" : " and retained"} in this session.`,
      );
    }, 700);
  }
  return (
    <>
      <div className="lab-toolbar">
        <div className="section-kicker">
          <span className="live-dot blue" />
          THE CONTEXT FOOTPRINT
        </div>
        <span className="badge">CLAUDE CODE TEACHING MODEL</span>
      </div>
      <section className="panel flow-meter-panel">
        <div className="flow-meter-heading">
          <div>
            <span className="eyebrow">SESSION CONTEXT</span>
            <h2>
              {formatNumber(used)}{" "}
              <span>/ {formatNumber(flowCapacity)} tokens</span>
            </h2>
          </div>
          <div className={`meter-percentage ${percent > 85 ? "warning" : ""}`}>
            {percent.toFixed(1)}%<span>occupied</span>
          </div>
          <div
            className="flow-pricing-anchor"
            ref={pricingAnchor}
            onBlur={(event) => {
              if (
                !(event.relatedTarget instanceof Node) ||
                !event.currentTarget.contains(event.relatedTarget)
              ) {
                setShowPricing(false);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setShowPricing(false);
                event.currentTarget
                  .querySelector<HTMLButtonElement>(
                    "[aria-label='Open pricing settings']",
                  )
                  ?.focus();
              }
            }}
          >
            <button
              type="button"
              className={`flow-pricing-trigger ${showRequestCost ? "is-on" : ""}`}
              role="switch"
              aria-label="Show request cost"
              aria-checked={showRequestCost}
              onClick={() => setShowRequestCost((value) => !value)}
            >
              <span className="flow-switch-track" aria-hidden="true"><span /></span>
              Price request
            </button>
            {showRequestCost && (
              <strong
                className="flow-price-preview"
                style={{ color: selectedModel.color }}
              >
                ${estimatedNextRequestCost.toFixed(4)}
              </strong>
            )}
            <IconButton
              icon={SlidersHorizontal}
              className="btn-ghost flow-pricing-settings"
              aria-label="Open pricing settings"
              title="Open pricing settings"
              aria-expanded={showPricing}
              onClick={() => setShowPricing((value) => !value)}
            />
            {showPricing && (
              <div
                className="flow-pricing-popover"
                role="dialog"
                aria-label="Request cost settings"
              >
                <div className="flow-pricing-popover-header">
                  <div>
                    <span className="eyebrow">NEXT REQUEST ESTIMATE</span>
                    <strong>Price the retained context</strong>
                  </div>
                  <strong className="flow-price-total" style={{ color: selectedModel.color }}>
                    ${estimatedNextRequestCost.toFixed(4)}
                  </strong>
                </div>
                <div className="flow-pricing-body">
                  <label className="flow-model-field">
                    <span>Model tier</span>
                    <select
                      aria-label="Model tier for request cost"
                      value={selectedModel.id}
                      onChange={(event) => setModelOptionId(event.target.value)}
                    >
                      {modelPriceOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.modelName}{option.name === option.modelName ? "" : ` - ${option.name}`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className={`flow-cache-switch ${useCachedInputRate ? "is-on" : ""}`}
                    role="switch"
                    aria-checked={useCachedInputRate}
                    onClick={() => setUseCachedInputRate((value) => !value)}
                  >
                    <span className="flow-switch-track" aria-hidden="true"><span /></span>
                    Use cached-context rate
                  </button>
                  <div className="flow-price-breakdown">
                    <span>{formatNumber(pricedInputTokens)} uncached at ${selectedModel.price.input.toFixed(2)}/1M</span>
                    <span>{formatNumber(cachedInputTokens)} cached at ${(useCachedInputRate ? selectedModel.price.cachedInput : selectedModel.price.input).toFixed(2)}/1M</span>
                    <span>{formatNumber(nextOutputTokens)} output at ${selectedModel.price.output.toFixed(2)}/1M</span>
                  </div>
                  <p>Estimate for the retained session sent again with a 2.5K-token next response. It is a list-price illustration, not a provider invoice.</p>
                </div>
                <div className="flow-pricing-reference">
                  <IconButton
                    icon={SlidersHorizontal}
                    className="btn-ghost btn-small"
                    onClick={() => setShowRates((value) => !value)}
                    aria-expanded={showRates}
                  >
                    Pricing
                  </IconButton>
                  {showRates && (
                    <div className="flow-pricing-table-wrap">
                      <PricingTable />
                      <PricingSources />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <div
          className="retention-meter"
          role="meter"
          aria-label="Session context used"
          aria-valuemin={0}
          aria-valuemax={flowCapacity}
          aria-valuenow={used}
        >
          <HoverTooltip
            className="meter-segment"
            style={{ width: `${(flowBase / flowCapacity) * 100}%` }}
            label="Boot context: the model's starting instructions, system tool definitions, deferred MCP catalog, and skill headers available before the first action."
          >
            <span style={{ background: "#6e7088" }} />
          </HoverTooltip>
          {entries.flatMap((entry) => {
            const reasoningTokens = entry.reasoningTokens ?? 0;
            if (entry.kind === "message") {
              return [
                <HoverTooltip
                  key={`${entry.id}-input`}
                  className="meter-segment input-meter-segment"
                  style={{ width: `${((entry.inputTokens ?? 0) / flowCapacity) * 100}%` }}
                  label={`Input: ${formatNumber(entry.inputTokens ?? 0)} tokens supplied to this turn${entry.imageTokens ? `, including ${formatNumber(entry.imageTokens)} image visual tokens` : ""}.`}
                >
                  <span />
                </HoverTooltip>,
                ...(reasoningTokens
                  ? [
                      <HoverTooltip
                        key={`${entry.id}-reasoning`}
                        className="meter-segment reasoning-meter-segment"
                        style={{ width: `${(reasoningTokens / flowCapacity) * 100}%` }}
                        label={`Thinking: ${formatNumber(reasoningTokens)} internal tokens generated before the visible answer. They are output-priced and retained as part of this conversation turn.`}
                      >
                        <span />
                      </HoverTooltip>,
                    ]
                  : []),
                <HoverTooltip
                  key={`${entry.id}-output`}
                  className="meter-segment output-meter-segment"
                  style={{ width: `${((entry.outputTokens ?? 0) / flowCapacity) * 100}%` }}
                  label={`Output: ${formatNumber(entry.outputTokens ?? 0)} visible assistant-response tokens retained for later turns.`}
                >
                  <span />
                </HoverTooltip>,
              ];
            }
            return [
              <HoverTooltip
                key={entry.id}
                className="meter-segment"
                style={{ width: `${(entry.tokens / flowCapacity) * 100}%` }}
                label={flowEntryExplanation(entry)}
              >
                <span style={{ background: entryColor(entry) }} />
              </HoverTooltip>,
            ];
          })}
        </div>
        <div className="meter-legend">
          <span>
            <i style={{ background: "#6e7088" }} />
            Boot context {compact(flowBase)}
          </span>
          <span>
            <i style={{ background: "#8baffb" }} />
            MCP schemas + results {compact(mcp)}
          </span>
          <span>
            <i style={{ background: "#b19aff" }} />
            Skill results {compact(skills)}
          </span>
          <span>
            <i className="input-legend" />
            Input {compact(messageInput)}
          </span>
          {reasoning > 0 && (
            <span>
              <i className="reasoning-legend" />
              Thinking {compact(reasoning)}
            </span>
          )}
          <span>
            <i className="output-legend" />
            Output {compact(messageOutput)}
          </span>
          {entries.some((entry) => entry.kind === "message" && entry.cached) && (
            <span className="cached-message-note">
              Cached turns use the cached-input rate
            </span>
          )}
          <strong>{formatNumber(flowCapacity - used)} free</strong>
        </div>
      </section>
      <div className="flow-layout">
        <section className="panel flow-controls">
          <div className="panel-header">
            <SectionLabel icon={Terminal}>Make a move</SectionLabel>
            <span className="badge badge-purple">INTERACTIVE</span>
          </div>
          <div className="call-list">
            {callTypes.map((call, index) => {
              const schemaRequired =
                call.kind === "mcp" && !hasLoadedMcpSchema(entries, call.id);
              const incoming = addedTokens(call);
              return (
                <div key={call.id}>
                  {(index === 0 || index === 2 || index === 4) && (
                    <div className={`call-group-label ${index === 4 ? "conversation-label" : ""}`}>
                      {index === 0
                        ? "MCP TOOL CALLS"
                        : index === 2
                          ? "SKILL INVOCATIONS"
                          : "CONVERSATION"}
                      {index === 4 && (
                        <button
                          type="button"
                          className={`flow-cache-switch reasoning-switch ${simulateReasoning ? "is-on" : ""}`}
                          role="switch"
                          aria-checked={simulateReasoning}
                          title="Add a random 800-1,600 internal thinking tokens to each new conversation response"
                          onClick={() => setSimulateReasoning((value) => !value)}
                        >
                          <span className="flow-switch-track" aria-hidden="true"><span /></span>
                          Reasoning
                        </button>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    className={`call-button ${pending === call.id ? "pending" : ""}`}
                    disabled={!!pending || used + incoming > flowCapacity}
                    onClick={() => trigger(call)}
                    title={
                      call.kind === "mcp"
                        ? "MCP tool call: loads its full schema once, then retains each result."
                        : call.kind === "skill"
                          ? "Skill invocation: runs a reusable instruction package and retains its output."
                          : "Conversation turn: retains input and assistant output; older rounds become cached."
                    }
                  >
                    <span className="call-icon" style={{ color: call.color }}>
                      <call.icon size={20} />
                    </span>
                    <span>
                      <strong>{call.name}</strong>
                      <small>
                        {schemaRequired
                          ? `${call.detail} + ${compact(call.schemaTokens)} schema on first load`
                          : call.detail}
                      </small>
                    </span>
                    <span className="call-token">
                      +{compact(incoming)}
                      <ArrowUpRight size={14} />
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flow-actions">
            <IconButton
              icon={Eraser}
              className="btn-ghost btn-small"
              disabled={
                !!pending || !entries.some((entry) => !entry.summarized)
              }
              onClick={() => {
                const next = compactEntries(entries);
                setEntries(next);
                setNotice(
                  `Compacted retained entries: ${formatNumber(used - flowUsed(next))} tokens freed. Summaries keep only 25% of their original size.`,
                );
              }}
            >
              Compact session
            </IconButton>
            <IconButton
              icon={RotateCcw}
              className="btn-ghost btn-small"
              disabled={!!pending || !entries.length}
              onClick={() => setResetConfirm(true)}
            >
              New session
            </IconButton>
          </div>
          {resetConfirm && (
            <div className="inline-confirm">
              <span>Clear all simulated calls?</span>
              <IconButton
                icon={Check}
                className="btn-small"
                onClick={() => {
                  setEntries([]);
                  setResetConfirm(false);
                  setNotice("Fresh session. Only boot context remains.");
                }}
              >
                Clear
              </IconButton>
              <IconButton
                icon={ArrowRight}
                aria-label="Cancel new session"
                onClick={() => setResetConfirm(false)}
              />
            </div>
          )}
        </section>
        <section className="panel flow-timeline-panel">
          <div className="panel-header">
            <SectionLabel icon={Workflow}>The trail you leave</SectionLabel>
            <div className="trail-header-actions">
              <label className="trail-auto-scroll">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(event) => setAutoScroll(event.target.checked)}
                />
                Auto-scroll
              </label>
              <span className="badge">
                {entries.length} RETAINED{" "}
                {entries.length === 1 ? "ENTRY" : "ENTRIES"}
              </span>
            </div>
          </div>
          <div className={`flow-route ${pending ? "running" : ""}`}>
            <div>
              <MessageSquare size={21} />
              <span>You ask</span>
            </div>
            <ArrowRight size={17} />
            <div>
              <Workflow size={21} />
              <span>Host decides context</span>
            </div>
            <ArrowRight size={17} />
            <div className="route-destination">
              <Layers3 size={21} />
              <span>Stays in context</span>
            </div>
          </div>
          <div className="flow-timeline" ref={timelineRef}>
            <HoverTooltip
              as="div"
              className="timeline-entry baseline-entry"
              label="Session boot context: content loaded before your first action. It provides the model's instructions, available system tools, deferred MCP catalog, and skill headers."
            >
              <span className="timeline-dot" />
              <div>
                <strong>Session boot context</strong>
                <p>Claude Code observation plus explicit simulator estimates</p>
              </div>
              <span className="mono">{compact(flowBase)}</span>
            </HoverTooltip>
            <div className="flow-boot-list">
              {flowBootEntries.map((entry) => (
                <HoverTooltip
                  as="div"
                  key={entry.id}
                  className={`flow-boot-entry boot-${entry.kind}`}
                  label={
                    entry.kind === "mcp-catalog"
                      ? "Deferred MCP catalog: lightweight metadata that advertises connected MCP tools before their full schemas are loaded."
                      : entry.kind === "skill-header"
                        ? "Skill header: reusable instruction metadata made available at session boot."
                        : entry.kind === "system"
                          ? "System tool headers: host-provided tool descriptions and parameter schemas available to the model."
                          : "Observed system prompt: host and model guidance that establishes behavior before the first message."
                  }
                >
                  <span>{entry.name}</span>
                  <small>{entry.detail}</small>
                  <strong>{compact(entry.tokens)}</strong>
                </HoverTooltip>
              ))}
            </div>
            {entries.map((entry, index) => {
              const retainedBefore =
                flowBase +
                entries
                  .slice(0, index)
                  .reduce((total, previous) => total + previous.tokens, 0);
              const totalCost = nextRequestCost(retainedBefore + entry.tokens);
              const addedCost = totalCost - nextRequestCost(retainedBefore);
              const reasoningCost = entry.reasoningTokens
                ? requestCost(0, 0, entry.reasoningTokens, selectedModel.price, false)
                : 0;
              return (
                <HoverTooltip
                as="div"
                className={`timeline-entry ${entry.cached ? "cached-entry" : ""}`}
                key={entry.id}
                label={flowEntryExplanation(entry)}
              >
                <span
                  className={`timeline-dot dot-${entry.kind}`}
                  style={{ background: entryColor(entry) }}
                />
                <div>
                  <strong>
                    {entry.name}{" "}
                    {entry.kind === "message" && (
                      <span className="entry-number">round {entry.round}</span>
                    )}
                  </strong>
                  {entry.kind === "message" && !entry.summarized ? (
                    <div className="message-token-breakdown">
                      <span className="message-input">
                        <small>INPUT</small>
                        <strong>{formatNumber(entry.inputTokens ?? 0)}</strong>
                        {entry.imageTokens && <em>{formatNumber(entry.imageTokens)} image</em>}
                      </span>
                      <span className="message-thinking">
                        <small>THINKING</small>
                        <strong>{formatNumber(entry.reasoningTokens ?? 0)}</strong>
                        <em>output-priced</em>
                      </span>
                      <span className="message-output">
                        <small>OUTPUT</small>
                        <strong>{formatNumber(entry.outputTokens ?? 0)}</strong>
                        <em>visible answer</em>
                      </span>
                    </div>
                  ) : (
                    <p>
                    {entry.summarized
                      ? "Compacted summary - details removed"
                      : entry.kind === "mcp-schema"
                        ? "Full tool schema loaded once for this session"
                        : entry.kind === "mcp-result"
                          ? "Tool result retained after execution"
                          : entry.kind === "skill-result"
                            ? "Skill result retained; header was already present at boot"
                            : "Retained context"}
                    </p>
                  )}
                  <span
                    className={`retained-tag ${entry.summarized ? "is-compacted" : entry.cached ? "is-cached" : ""}`}
                  >
                    {entry.summarized ? (
                      <CheckCheck size={10} />
                    ) : entry.cached ? (
                      <History size={10} />
                    ) : (
                      <LockKeyhole size={10} />
                    )}
                    {entry.summarized
                      ? "SUMMARIZED"
                      : entry.cached
                        ? "CACHED"
                        : "RETAINED"}
                  </span>
                </div>
                <span className="entry-tokens mono">
                  +{formatNumber(entry.tokens)}
                  {entry.summarized && (
                    <small>was {formatNumber(entry.originalTokens)}</small>
                  )}
                  <small className="entry-cost">+${addedCost.toFixed(4)} next request</small>
                  {reasoningCost > 0 && (
                    <small className="entry-reasoning-cost">+${reasoningCost.toFixed(4)} reasoning output</small>
                  )}
                  <small className="entry-cost-total">${totalCost.toFixed(4)} total</small>
                </span>
              </HoverTooltip>
              );
            })}
            {pending && (
              <div className="pending-entry">
                <span className="live-dot" />
                Running simulated action...
              </div>
            )}
          </div>
          <div className="flow-notice" role="status">
            <Info size={15} />
            <span>{notice}</span>
          </div>
        </section>
      </div>
      <div className="learning-callout blue-callout">
        <div className="callout-icon">
          <Lightbulb size={20} />
        </div>
        <div>
          <h3>Context changes in stages.</h3>
          <p>
            This Claude Code teaching model starts with a small deferred MCP
            catalog. The first tool use loads its full schema, then retains its
            result. Older message rounds are cached but remain part of the
            context budget.
          </p>
        </div>
      </div>
      <TooltipNote>
        MCP does not mandate eager or deferred schema injection. Progressive
        discovery is a supported pattern; hosts choose what to include, cache,
        compact, or omit. The $7.8K Claude Code prompt is observed in one
        session; all other sizes here are simulator estimates.
      </TooltipNote>
    </>
  );
}
