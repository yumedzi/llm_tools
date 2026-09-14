import { models } from "./logic";

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
      {models.flatMap((model) =>
        model.pricing.map((price) => (
          <div
            className="pricing-table-row"
            role="row"
            key={`${model.id}-${price.label}`}
          >
            <span>
              <strong>
                {model.pricing.length > 1
                  ? `GPT-5.6 ${price.label}`
                  : model.name}
              </strong>
            </span>
            <span>${price.input.toFixed(2)}</span>
            <span>${price.cachedInput.toFixed(2)}</span>
            <span>${price.output.toFixed(2)}</span>
          </div>
        )),
      )}
    </div>
  );
}

export function PricingSources() {
  return (
    <p className="pricing-sources">
      Sources: Anthropic API pricing, OpenAI API pricing, and xAI model pricing,
      retrieved 2026-09-13. Grok 4.6 uses the under-200K-context tier; pricing
      can change.
    </p>
  );
}
