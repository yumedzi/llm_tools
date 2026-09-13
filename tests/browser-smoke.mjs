import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Optional end-to-end checks. Set BROWSER_BIN to an installed agent-browser executable.
// Start npm run dev first. This test uses only its isolated local browser session.
const bin = process.env.BROWSER_BIN;
if (!bin) throw new Error('Set BROWSER_BIN to the absolute path of your installed agent-browser executable.');
const out = resolve(process.env.OUTPUT_DIR ?? 'outputs');
const checks = [];
function browser(...args) { return execFileSync(bin, args, { encoding: 'utf8', timeout: 45000, maxBuffer: 3000000 }); }
function evaluate(code) { return browser('eval', code); }
function check(name, condition) {
  browser('wait', '--fn', condition);
  evaluate(`(() => { if (!(${condition})) throw new Error(${JSON.stringify(name)}); return 'PASS'; })()`);
  checks.push({ name, status: 'passed' }); console.log(`PASS ${name}`);
}
function activate(selector) { evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el || el.disabled) throw new Error('Missing or disabled control'); el.focus(); el.click(); })()`); }
function button(name) {
  evaluate(`(() => { document.querySelectorAll('[data-smoke-target]').forEach(e=>e.removeAttribute('data-smoke-target')); const target=[...document.querySelectorAll('button')].find(e=>e.getClientRects().length && (e.getAttribute('aria-label') || e.textContent).trim() === ${JSON.stringify(name)}); if(!target) throw new Error('Button not found: '+${JSON.stringify(name)}); target.setAttribute('data-smoke-target','true'); })()`);
  activate('[data-smoke-target]');
}
function snapshot() { browser('snapshot', '-i'); }
function nav(name) { button(name); snapshot(); }
function noOverflow(label) { check(`${label}: no horizontal overflow`, 'document.documentElement.scrollWidth <= innerWidth + 1'); }
function capture(name) { evaluate('document.activeElement?.blur();window.scrollTo(0,0)'); browser('screenshot', resolve(out, name), '--full'); }
function settle() { browser('wait', '--fn', '!document.querySelector(".pending-entry")'); }

try {
  browser('open', process.env.APP_URL ?? 'http://127.0.0.1:5173');
  snapshot();
  evaluate(`Object.keys(localStorage).filter(k=>k.startsWith('context-lab:')).forEach(k=>localStorage.removeItem(k)); location.reload()`);
  snapshot();
  browser('set', 'viewport', '1440', '1080');
  check('Tokenizer groups GPT 5.6 variants into five model profiles', 'document.querySelectorAll(".model-row").length === 5 && document.querySelector(".model-chart").textContent.includes("GPT 5.6 (Sol / Terra / Luna)")');
  browser('fill', '[aria-label="Text to tokenize"]', 'Hello world');
  check('Live words, characters, and tokens update', 'document.querySelector(".input-stats").textContent.includes("2words") && document.querySelector(".input-stats").textContent.includes("11characters") && [...document.querySelectorAll(".bar-track")].every(e=>+e.getAttribute("aria-valuenow")>0)');
  check('Haiku displays a lower calibrated count', '+document.querySelector(".bar-track[aria-label*=\"Claude Haiku\"]").getAttribute("aria-valuenow") < +document.querySelector(".bar-track[aria-label*=\"Claude Sonnet\"]").getAttribute("aria-valuenow")');
  button('Clear input text');
  check('Cleared text produces zero counts and bars', '[...document.querySelectorAll(".bar-track")].every(e=>+e.getAttribute("aria-valuenow")===0)');
  button('Multilingual');
  check('Unicode sample is loaded', 'document.querySelector("textarea").value.includes("こんにちは")');
  button('Cost'); button('Pricing'); snapshot();
  check('Pricing lists hard-coded provider rates', 'document.querySelector(".pricing-table").textContent.includes("$10.00") && document.querySelector(".pricing-table").textContent.includes("$0.20")');
  button('Pricing'); button('Tokens'); button('Prose'); noOverflow('Desktop tokenizer');
  capture('desktop-tokenizer.png');

  nav('Context window 02');
  check('Shared context keeps a protected compaction buffer', 'document.querySelectorAll(".allocation-item").length === 10 && document.querySelector(".dial-center").textContent.includes("48.1k") && document.querySelector(".allocation-list").textContent.includes("Reserved buffer") && document.querySelector(".allocation-list").textContent.includes("145,910")');
  check('Context dial exposes each section on hover', 'document.querySelectorAll(".context-segment title").length === 10 && [...document.querySelectorAll(".context-segment title")].some(title => title.textContent.includes("System prompt"))');
  activate('[aria-label="Explain System tools"]');
  check('Allocation help opens a rich tooltip', 'document.querySelector("[role=tooltip]").textContent.includes("host-provided")');
  activate('[aria-label="Explain System tools"]');
  button('500k');
  check('Context capacity is selectable', 'document.querySelector(".context-dial svg").getAttribute("aria-label").includes("500,000")');
  check('Memory files list common host conventions', 'document.querySelector(".allocation-list").textContent.includes("CLAUDE.md") && document.querySelector(".allocation-list").textContent.includes("AGENTS.md") && document.querySelector(".allocation-list").textContent.includes("copilot-instructions.md")');
  snapshot();
  browser('focus', 'input[aria-label="Conversation history tokens"]'); browser('press', 'ArrowRight');
  check('Context slider increases conversation history', 'document.querySelector('input[aria-label="Conversation history tokens"]').value === "410"');
  button('Reset'); noOverflow('Desktop context');
  capture('desktop-context.png');

  nav('MCP & skill flow 03');
  activate( '.call-list > div:first-child .call-button'); settle();
  check('Flow starts at explicit boot context plus first MCP schema and result', 'document.querySelector(".retention-meter").getAttribute("aria-valuenow")==="23600" && document.querySelectorAll(".timeline-entry:not(.baseline-entry)").length===2');
  activate( '.call-list > div:first-child .call-button'); settle();
  check('Repeated MCP calls retain another result without reloading schema', 'document.querySelectorAll(".timeline-entry:not(.baseline-entry)").length===3 && document.querySelector(".retention-meter").getAttribute("aria-valuenow")==="26000"');
  activate( '.call-list > div:nth-child(3) .call-button'); settle();
  check('Skill output adds context without duplicating boot header', 'document.querySelector(".retention-meter").getAttribute("aria-valuenow")==="27800"');
  button('Compact session');
  check('Compaction frees 75% of retained entries and preserves boot context', 'document.querySelector(".retention-meter").getAttribute("aria-valuenow")==="21050" && document.querySelectorAll(".is-compacted").length===4');
  check('Existing summaries cannot be repeatedly compacted', '[...document.querySelectorAll("button")].find(e=>e.textContent==="Compact session").disabled');
  capture('desktop-flow.png');
  button('New session'); snapshot(); button('Clear');
  check('New session preserves only boot context', 'document.querySelector(".retention-meter").getAttribute("aria-valuenow")==="18800"');
  activate('.call-list > div:nth-child(5) .call-button'); settle();
  activate('.call-list > div:nth-child(5) .call-button'); settle();
  check('Conversation retains randomized output and caches older rounds', '(() => { const used=+document.querySelector(".retention-meter").getAttribute("aria-valuenow"); const timeline=document.querySelector(".flow-timeline").textContent; return used>=24000 && used<=26000 && document.querySelectorAll(".retained-tag.is-cached").length===1 && timeline.includes("round 2") && timeline.includes("600 input +") && timeline.includes("assistant output"); })()');
  button('New session'); snapshot(); button('Clear');
  noOverflow('Desktop MCP lab');

  nav('Prompt sandbox 04');
  check('Starter prompt includes all five editable block types', 'document.querySelectorAll(".prompt-block").length===5 && document.querySelector(".prompt-code").textContent.includes("Source:")');
  button('Save snapshot');
  check('Before and after comparison starts at zero delta', 'document.querySelectorAll(".prompt-compare-pane").length===2 && document.querySelector(".prompt-comparison-summary .badge").textContent.includes("0 tokens")');
  button('Add constraints block'); snapshot();
  browser('fill', '.prompt-block:last-child textarea', 'Always cite the provided source and explain any uncertainty in two clear sentences.');
  check('Added block changes token delta and structure', 'document.querySelectorAll(".prompt-block").length===6 && document.querySelector(".prompt-comparison-summary .badge").textContent.includes("+")');
  activate( '.prompt-block:last-child button[title="Disable block"]');
  check('Disabled blocks are excluded from compiled prompt', '!document.querySelectorAll(".prompt-compare-pane pre")[1].textContent.includes("Always cite")');
  activate( '.prompt-block:last-child button[title="Enable block"]');
  activate( '.prompt-block:last-child button[title="Move up"]');
  check('Reordering changes prompt structure', 'document.querySelectorAll(".prompt-block")[4].querySelector("textarea").value.startsWith("Always cite")');
  activate( '.prompt-block:nth-child(5) button[title="Delete block"]');
  button('Extraction'); snapshot(); button('Replace blocks');
  check('Extraction template loads and keeps the snapshot', 'document.querySelectorAll(".prompt-compare-pane pre")[1].textContent.includes("product_name") && document.querySelectorAll(".prompt-compare-pane pre")[0].textContent.includes("careful editor")');
  button('Coding assistant'); snapshot(); button('Replace blocks');
  check('Coding template loads', 'document.querySelectorAll(".prompt-compare-pane pre")[1].textContent.includes("TypeScript")');
  button('Summarization'); snapshot(); button('Replace blocks');
  noOverflow('Desktop prompt builder');
  browser('screenshot', resolve(out, 'desktop-prompts.png'), '--full');
  browser('reload'); snapshot();
  check('Prompt and snapshot survive refresh', 'document.querySelectorAll(".prompt-block").length===5 && JSON.parse(localStorage.getItem("context-lab:prompt:v1")).snapshot !== null');
  button('Copy prompt');
  check('Copy provides success or accessible fallback', 'document.querySelector(".prompt-feedback").textContent.length>0');

  for (const width of [390, 320, 768]) {
    browser('set', 'viewport', String(width), '844');
    for (const [name, mobile, id] of [['Tokenizer 01','Tokens','tokenizer'],['Context window 02','Context','context'],['MCP & skill flow 03','Tool flow','flow'],['Prompt sandbox 04','Prompts','prompt']]) {
      nav(width <= 760 ? mobile : name);
      noOverflow(`${width}px ${id}`);
      check(`${width}px ${id}: heading visible`, '!!document.querySelector("h1") && document.querySelector("h1").getBoundingClientRect().width>0');
      if (width === 390) capture(`mobile-${id}.png`);
    }
  }
  nav('Tokenizer 01'); button('Open field guide');
  check('Field guide opens as accessible modal', 'document.querySelector("dialog").open');
  browser('press', 'Escape');
  check('Escape closes field guide', '!document.querySelector("dialog")');
  browser('set', 'viewport', '1440', '1080'); button('Present');
  check('Focus mode hides sidebar without losing navigation', 'document.querySelector(".presentation-mode") && getComputedStyle(document.querySelector(".sidebar")).display === "none" && getComputedStyle(document.querySelector(".mobile-tabs")).display !== "none"');
  button('Exit focus');
  check('Footer credits Viktor Moyseyenko', 'document.querySelector(".footer-attribution a").href === "https://onpy.dev/" && document.querySelector(".footer-curiosity").textContent.includes("Built for curiosity")');
  evaluate(`localStorage.setItem('context-lab:text','{broken');localStorage.setItem('context-lab:prompt:v1',JSON.stringify({blocks:[{}],snapshot:null}));location.reload()`);
  snapshot();
  check('Malformed persisted input recovers gracefully', 'document.querySelector("textarea").value.includes("thoughtful")');
  nav('Prompt sandbox 04');
  check('Invalid saved prompt recovers gracefully', 'document.querySelectorAll(".prompt-block").length===5');
  nav('Tokenizer 01');
  const errors = browser('errors');
  check('No uncaught browser errors', `${JSON.stringify(errors.trim())} === ''`);
  check('No external application resource requests', 'performance.getEntriesByType("resource").every(r => !/^https?:/.test(r.name) || new URL(r.name).origin===location.origin)');
} finally {
  writeFileSync(resolve(out, 'browser-validation.json'), JSON.stringify({ checkedAt: new Date().toISOString(), checks, passed: checks.length }, null, 2));
  browser('close');
}
console.log(`Completed ${checks.length} browser checks.`);
