import type { TextOp } from "./rom";

/**
 * Turns Gen 1 text commands into dialogue pages. The cartridge breaks lines at
 * 18 characters for its 160-pixel screen; Astra's wider box reflows each
 * paragraph and starts a new page wherever the original started a new box.
 */
export function textPages(ops: TextOp[], value: (op: TextOp) => string, player: string, rival: string): string[] {
  const pages: string[] = [];
  let page = "";
  const flush = () => {
    const text = page.replace(/\s+/g, " ").trim();
    if (text) pages.push(...split(text));
    page = "";
  };
  for (const op of ops) {
    if (op.op === "text") {
      const s = op.s.replaceAll("{PLAYER}", player).replaceAll("{RIVAL}", rival);
      for (const part of s.split(/(\f)/)) {
        if (part === "\f") flush();
        else page += part.replace(/-\n(?=[a-z])/g, "").replace(/[\n\v]/g, " ");
      }
    } else if (op.op === "ram" || op.op === "num" || op.op === "bcd") page += value(op);
    else if (op.op === "dots") page += "…".repeat(Math.max(1, op.n));
    else if (op.op === "wait") flush();
  }
  flush();
  return pages;
}

/** Splits long paragraphs between sentences so each page fits the box. */
function split(text: string, limit = 110): string[] {
  if (text.length <= limit) return [text];
  const out: string[] = [];
  let page = "";
  for (const sentence of text.split(/(?<=[.!?…])\s+/)) {
    if (page && page.length + sentence.length + 1 > limit) {
      out.push(page);
      page = "";
    }
    if (sentence.length > limit) {
      for (const word of sentence.split(" ")) {
        if (page && page.length + word.length + 1 > limit) {
          out.push(page);
          page = "";
        }
        page += (page ? " " : "") + word;
      }
    } else page += (page ? " " : "") + sentence;
  }
  if (page) out.push(page);
  return out;
}
