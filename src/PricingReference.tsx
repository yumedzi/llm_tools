import { modelGroups, models } from "./logic";

export function PricingTable() {
  return (
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
      {modelGroups.map((group) => (
        <div role="rowgroup" key={group}>
          <div className="pricing-table-group" role="row">
            <span>{group}</span>
          </div>
          {models
            .filter((model) => model.group === group)
            .flatMap((model) =>
              model.pricing.map((price) => (
                <div
                  className="pricing-table-row"
                  role="row"
                  key={`${model.id}-${price.label}`}
                >
                  <span>
                    <strong>{model.name}</strong>
                    {model.pricing.length > 1 && (
                      <small>{price.label} context</small>
                    )}
                  </span>
                  <span>${price.input.toFixed(2)}</span>
                  <span>${price.cachedInput.toFixed(price.cachedInput < 0.01 ? 3 : 2)}</span>
                  <span>${price.output.toFixed(2)}</span>
                </div>
              )),
            )}
        </div>
      ))}
    </div>
  );
}

export function PricingSources() {
  return (
    <p className="pricing-sources">
      Sources: Anthropic, OpenAI, xAI, Google, DeepSeek, Z.ai, Moonshot and
      Mistral API pricing pages, retrieved 2026-10-11. Long-context tiers bill
      the whole request once the prompt crosses the threshold. DeepSeek shows
      peak-hour rates; Gemini 3.1 Pro is in preview. Pricing can change.
    </p>
  );
}
