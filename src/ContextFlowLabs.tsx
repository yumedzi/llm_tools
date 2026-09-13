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
  Info,
  Layers3,
  Lightbulb,
  LockKeyhole,
  MessageSquare,
  RotateCcw,
  Search,
  Settings2,
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
  conversationInputTokens,
  conversationOutputTokens,
  fitAllocations,
  flowBase,
  flowBootEntries,
  flowCapacity,
  flowMcpTools,
  flowUsed,
  formatNumber,
  hasLoadedMcpSchema,
  retainCall,
  retainConversation,
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
  InfoTooltip,
  SectionLabel,
  TooltipNote,
  usePersistentState,
} from "./ui";

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
    detail: "600 input + 2-3K assistant output",
    resultTokens: 0,
    icon: MessageSquare,
    color: "#90d9c1",
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
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
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
  const cachedMessages = entries
    .filter((entry) => entry.kind === "message" && entry.cached)
    .reduce((total, entry) => total + entry.tokens, 0);
  function addedTokens(
    call: (typeof callTypes)[number],
    assistantOutputTokens?: number,
  ) {
    if (call.kind === "message") {
      return conversationInputTokens + (assistantOutputTokens ?? 2500);
    }
    return call.kind === "mcp" && !hasLoadedMcpSchema(entries, call.id)
      ? call.resultTokens + call.schemaTokens
      : call.resultTokens;
  }
  function trigger(call: (typeof callTypes)[number]) {
    if (pending) return;
    const assistantOutputTokens =
      call.kind === "message" ? conversationOutputTokens() : undefined;
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
              ? conversationInputTokens + assistantOutputTokens!
              : call.resultTokens,
          originalTokens:
            call.kind === "message"
              ? conversationInputTokens + assistantOutputTokens!
              : call.resultTokens,
          summarized: false,
          toolId: call.kind === "mcp" ? call.id : undefined,
          inputTokens:
            call.kind === "message" ? conversationInputTokens : undefined,
          outputTokens: assistantOutputTokens,
        };
        return call.kind === "message"
          ? (retainConversation(next, result) ?? next)
          : (retainCall(next, result) ?? next);
      });
      setPending(null);
      setNotice(
        call.kind === "message"
          ? `${call.name}: ${formatNumber(conversationInputTokens)} input + ${formatNumber(assistantOutputTokens!)} assistant output tokens retained in this session.`
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
        </div>
        <div
          className="retention-meter"
          role="meter"
          aria-label="Session context used"
          aria-valuemin={0}
          aria-valuemax={flowCapacity}
          aria-valuenow={used}
        >
          <span
            title={`Boot context: ${formatNumber(flowBase)} tokens`}
            style={{
              width: `${(flowBase / flowCapacity) * 100}%`,
              background: "#6e7088",
            }}
          />
          {entries.map((entry) => (
            <span
              key={entry.id}
              title={`${entry.name}: ${formatNumber(entry.tokens)} tokens`}
              style={{
                width: `${(entry.tokens / flowCapacity) * 100}%`,
                background: entryColor(entry),
              }}
            />
          ))}
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
            <i style={{ background: "#63748f" }} />
            Cached messages {compact(cachedMessages)}
          </span>
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
                    <div className="call-group-label">
                      {index === 0
                        ? "MCP TOOL CALLS"
                        : index === 2
                          ? "SKILL INVOCATIONS"
                          : "CONVERSATION"}
                    </div>
                  )}
                  <button
                    type="button"
                    className={`call-button ${pending === call.id ? "pending" : ""}`}
                    disabled={!!pending || used + incoming > flowCapacity}
                    onClick={() => trigger(call)}
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
            <span className="badge">
              {entries.length} RETAINED{" "}
              {entries.length === 1 ? "ENTRY" : "ENTRIES"}
            </span>
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
          <div className="flow-timeline">
            <div className="timeline-entry baseline-entry">
              <span className="timeline-dot" />
              <div>
                <strong>Session boot context</strong>
                <p>Claude Code observation plus explicit simulator estimates</p>
              </div>
              <span className="mono">{compact(flowBase)}</span>
            </div>
            <div className="flow-boot-list">
              {flowBootEntries.map((entry) => (
                <div
                  key={entry.id}
                  className={`flow-boot-entry boot-${entry.kind}`}
                >
                  <span>{entry.name}</span>
                  <small>{entry.detail}</small>
                  <strong>{compact(entry.tokens)}</strong>
                </div>
              ))}
            </div>
            {entries.map((entry, index) => (
              <div
                className={`timeline-entry ${entry.cached ? "cached-entry" : ""}`}
                key={entry.id}
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
                  <p>
                    {entry.summarized
                      ? "Compacted summary - details removed"
                      : entry.kind === "mcp-schema"
                        ? "Full tool schema loaded once for this session"
                        : entry.kind === "mcp-result"
                          ? "Tool result retained after execution"
                          : entry.kind === "skill-result"
                            ? "Skill result retained; header was already present at boot"
                            : entry.cached
                              ? `${formatNumber(entry.inputTokens ?? conversationInputTokens)} input + ${formatNumber(entry.outputTokens ?? 0)} assistant output cached by the host`
                              : `${formatNumber(entry.inputTokens ?? conversationInputTokens)} input + ${formatNumber(entry.outputTokens ?? 0)} assistant output retained`}
                  </p>
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
                </span>
              </div>
            ))}
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
