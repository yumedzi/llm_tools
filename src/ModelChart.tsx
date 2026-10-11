import { useState } from "react";
import type { CSSProperties } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { RiAnthropicFill, RiDeepseekFill, RiGeminiFill, RiGrokAiFill, RiOpenaiFill } from "react-icons/ri";
import { SiMistralai } from "react-icons/si";
import { formatNumber, modelGroups, models } from "./logic";
import type { ModelFamily, ModelGroup, ModelPrice } from "./logic";

export type CostDirection = "input" | "cached-input" | "output";

export function FamilyIcon({ family, size = 14 }: { family: ModelFamily; size?: number }) {
  if (family === "Claude") return <RiAnthropicFill size={size} />;
  if (family === "OpenAI") return <RiOpenaiFill size={size} />;
  if (family === "Grok") return <RiGrokAiFill size={size} />;
  if (family === "Gemini") return <RiGeminiFill size={size} />;
  if (family === "DeepSeek") return <RiDeepseekFill size={size} />;
  if (family === "Mistral") return <SiMistralai size={size} />;
  return <Sparkles size={size} strokeWidth={1.8} />;
}

const rate = (price: ModelPrice, direction: CostDirection) =>
  direction === "input" ? price.input : direction === "cached-input" ? price.cachedInput : price.output;
const usd = (value: number) => `$${value.toFixed(6)}`;

export function ModelChart({
  counts,
  metric,
  costDirection,
  costMultiplier,
}: {
  counts: number[];
  metric: "tokens" | "cost";
  costDirection: CostDirection;
  costMultiplier: number;
}) {
  const [openGroup, setOpenGroup] = useState<ModelGroup | null>("Anthropic");
  // Each model has one value per pricing tier: [base] or [≤threshold, >threshold].
  const rows = models.map((model, index) => {
    const values = metric === "tokens"
      ? [counts[index]]
      : model.pricing.map((price) => (counts[index] * rate(price, costDirection) * costMultiplier) / 1000000);
    return { model, values };
  });
  const peak = Math.max(0, ...rows.flatMap((row) => row.values));
  const magnitude = peak > 0 ? 10 ** Math.floor(Math.log10(peak)) : 1;
  const max = peak > 0
    ? ([1, 2, 5, 10].find((tick) => tick * magnitude >= peak) ?? 10) * magnitude
    : metric === "tokens" ? 100 : 0.001;
  const format = (value: number) => (metric === "tokens" ? formatNumber(value) : usd(value));
  const width = (value: number) => `${Math.min(100, (value / max) * 100)}%`;

  return (
    <>
      <div className="model-chart model-groups">
        {modelGroups.map((group) => {
          const groupRows = rows.filter((row) => row.model.group === group);
          const families = [...new Set(groupRows.map((row) => row.model.family))];
          const base = groupRows.map((row) => row.values[0]);
          const low = Math.min(...base);
          const high = Math.max(...base);
          const open = openGroup === group;
          const panelId = `model-group-${group.toLowerCase()}`;
          return (
            <section className={`model-group ${open ? "is-open" : ""}`} key={group}>
              <button
                type="button"
                className="model-group-header"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenGroup(open ? null : group)}
              >
                <span className="model-group-icons" aria-hidden="true">
                  {families.slice(0, 4).map((family) => (
                    <span key={family}><FamilyIcon family={family} size={12} /></span>
                  ))}
                </span>
                <span className="model-group-title">
                  <strong>{group}</strong>
                  <small>{groupRows.length} models</small>
                </span>
                <span className="model-group-range">
                  {low === high ? format(low) : `${format(low)} – ${format(high)}`}
                  <small>{metric === "tokens" ? "tokens" : "USD"}</small>
                </span>
                <ChevronDown size={15} className="model-group-chevron" aria-hidden="true" />
              </button>
              {!open && (
                <div className="model-group-strip" aria-hidden="true">
                  {groupRows.map(({ model, values }) => (
                    <i key={model.id} style={{ left: width(values[0]), background: model.color }} />
                  ))}
                </div>
              )}
              {open && (
                <div className="model-group-body" id={panelId}>
                  {groupRows.map(({ model, values }) => {
                    const tiered = values.length > 1;
                    return (
                      <div className="model-row" key={model.id}>
                        <div className="model-heading">
                          <div className="model-name" title={model.note}>
                            <span className="model-icon" style={{ color: model.color, background: `${model.color}13` }}>
                              <FamilyIcon family={model.family} />
                            </span>
                            {model.name}
                          </div>
                          <span className={`model-value ${tiered ? "tiered-model-value" : ""}`} style={{ color: model.color }}>
                            {tiered ? (
                              model.pricing.map((price, index) => (
                                <span className={`tier-value tier-${index}`} key={price.label}>
                                  <small>{price.label}</small>
                                  {format(values[index])}
                                </span>
                              ))
                            ) : (
                              <>{format(values[0])}<small>{metric === "tokens" ? "tokens" : "USD"}</small></>
                            )}
                          </span>
                        </div>
                        <div
                          className={`bar-track ${tiered ? "is-tiered" : ""}`}
                          role="meter"
                          aria-label={`${model.name} ${metric}`}
                          aria-valuemin={0}
                          aria-valuemax={max}
                          aria-valuenow={values[0]}
                        >
                          {tiered && (
                            <div
                              className="bar-fill bar-fill-tier"
                              title={`${model.pricing[1].label} context rate: the whole request is billed at this rate`}
                              style={{ width: width(values[1]), "--bar-color": model.color } as CSSProperties}
                            />
                          )}
                          <div className="bar-fill" style={{ width: width(values[0]), "--bar-color": model.color } as CSSProperties} />
                        </div>
                      </div>
                    );
                  })}
                  {metric === "cost" && groupRows.some((row) => row.values.length > 1) && (
                    <p className="tier-legend">
                      <i className="tier-swatch" /> base rate
                      <i className="tier-swatch is-long" /> long-context rate if this text is part of a request over the threshold
                    </p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
      <div className="chart-axis">
        <span>0</span>
        <span>{metric === "tokens" ? `${formatNumber(max)} tokens` : `$${max < 1e-8 ? "0" : max.toFixed(6)}`}</span>
      </div>
    </>
  );
}
