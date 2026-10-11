import { useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import { formatNumber } from "./logic";
import type { TokenPiece } from "./tokenizers";

const utf8 = new TextEncoder();
const LABEL_GAP = 4;

function pieceText(text: string): ReactNode[] {
  // Newlines stay real line breaks; a faint ↵ marks where they were.
  return text.split("\n").flatMap((part, index) =>
    index === 0 ? [part] : [<span className="tok-nl" key={index}>↵</span>, "\n", part],
  );
}

function idLabel(piece: TokenPiece): string {
  if (piece.id < 0) return piece.tokens > 1 ? `×${piece.tokens}` : "byte";
  return `${piece.id}`;
}

function describe(piece: TokenPiece, approximate: boolean): string {
  const escaped = JSON.stringify(piece.text);
  const bytes = utf8.encode(piece.text).length;
  if (piece.id < 0) {
    return `${escaped} · ${piece.tokens} byte-level token${piece.tokens === 1 ? "" : "s"} (no vocabulary match) · ${bytes} bytes`;
  }
  return `${approximate ? "Approximate vocab index" : "Token ID"} ${piece.id} · ${escaped} · ${bytes} byte${bytes === 1 ? "" : "s"}`;
}

// Places each ID label in one of two lanes above its line so neighbours never
// overlap. Labels that fit neither lane are hidden until hover/focus.
function assignLanes(container: HTMLElement) {
  const tokens = container.querySelectorAll<HTMLElement>(".tok");
  const lanes = new Map<number, [number, number]>();
  const box = container.getBoundingClientRect();
  const limit = container.clientWidth - 2;
  tokens.forEach((token) => {
    const label = token.querySelector<HTMLElement>(".tok-id");
    if (!label) return;
    label.style.transform = "";
    const rect = token.getClientRects()[0] ?? token.getBoundingClientRect();
    const line = Math.round(rect.top);
    const width = label.offsetWidth;
    const natural = label.getBoundingClientRect().left - box.left;
    const tokenRight = rect.right - box.left;
    const ends: [number, number] = lanes.get(line) ?? [-Infinity, -Infinity];
    // A label may slide right while it still starts over its own token, and is
    // nudged left only to stay inside the panel.
    let lane = -1;
    let left = natural;
    for (const candidate of [0, 1]) {
      const start = Math.max(natural, ends[candidate] + LABEL_GAP);
      const fitted = Math.max(0, Math.min(start, limit - width));
      if (fitted >= ends[candidate] + LABEL_GAP && (fitted === natural || fitted <= tokenRight - 4)) { lane = candidate; left = fitted; break; }
    }
    if (lane === 0 || lane === 1) {
      ends[lane] = left + width;
      if (left !== natural) label.style.transform = `translateX(${left - natural}px)`;
    }
    lanes.set(line, ends);
    token.dataset.lane = lane < 0 ? "hidden" : String(lane);
  });
}

export function TokenText({
  text,
  pieces,
  totalTokens,
  approximate,
  showIds,
}: {
  text: string;
  pieces: TokenPiece[];
  totalTokens: number;
  approximate: boolean;
  showIds: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = container.current;
    if (!node || !showIds) return;
    let frame = 0;
    const run = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => assignLanes(node)); };
    assignLanes(node);
    const observer = new ResizeObserver(run);
    observer.observe(node);
    document.fonts?.ready.then(run);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [pieces, showIds]);

  if (!pieces.length) return <p className="muted tok-empty">Your tokens will appear here.</p>;
  const shownEnd = pieces[pieces.length - 1].end;
  const shownTokens = pieces.reduce((sum, piece) => sum + piece.tokens, 0);
  return (
    <div ref={container} className={`tok-text ${showIds ? "with-ids" : "no-ids"}`}>
      {pieces.map((piece, index) => (
        <span
          key={piece.start}
          className={`tok tok-c${index % 6}${piece.id < 0 ? " tok-unknown" : ""}${/^ \S/.test(piece.text) ? " tok-lead" : ""}`}
          title={describe(piece, approximate)}
          tabIndex={-1}
        >
          {showIds && <span className="tok-id" aria-hidden="true">{idLabel(piece)}</span>}
          {pieceText(piece.text)}
        </span>
      ))}
      {shownEnd < text.length && (
        <>
          <span className="tok-rest">{text.slice(shownEnd)}</span>
          <span className="tok-more">+{formatNumber(Math.max(0, totalTokens - shownTokens))} more tokens not highlighted</span>
        </>
      )}
    </div>
  );
}
