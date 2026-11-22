/**
 * The Crystal adventure's dialogue and choices. The browser shows them over
 * the map; tests answer them without a page.
 */
import type { Input } from "../game/input";
import type { MenuInput } from "../ui/menu-input";
import { escapeHtml } from "../ui/shell";

export interface CrystalUi {
  /** Shows pages of text. Every page but the last waits for A; the last one waits only with `wait`. */
  text(pages: string[], wait: boolean): Promise<void>;
  /** Waits for A with the current text still showing. */
  waitButton(): Promise<void>;
  closeText(): void;
  yesNo(): Promise<boolean>;
  /** A list of choices; resolves with the index, or undefined when cancelled. */
  choose(options: string[], options2?: { title?: string; cancel?: boolean; columns?: number }): Promise<number | undefined>;
  /** Called every frame with the player's input. */
  frame(input: Input, now: number): void;
  readonly busy: boolean;
}

/** Splits long paragraphs between sentences so each page fits the box. */
export function paginate(text: string, limit = 110): string[] {
  const out: string[] = [];
  for (const para of text.split("\f")) {
    // A hyphen at a line's end: a word split in two joins up ("some-/thing", "GOLDEN-/ROD", "#-/MON"),
    // while a hyphenated word keeps its hyphen ("BUG-/type").
    const t = para
      .replace(/(POKé|[A-Z])-[\n\v](?=[A-Z])/g, "$1")
      .replace(/([A-Z])-[\n\v](?=[a-z])/g, "$1-")
      .replace(/([a-zé])-[\n\v](?=[a-z])/g, "$1")
      // A dash that starts a line belongs to the word before it ("worry--take it").
      .replace(/[\n\v](?=--)/g, "")
      .replace(/[\n\v]/g, " ").replace(/\s+/g, " ").trim();
    if (!t) continue;
    if (t.length <= limit) { out.push(t); continue; }
    let page = "";
    for (const sentence of t.split(/(?<=[.!?…])\s+/)) {
      if (page && page.length + sentence.length + 1 > limit) { out.push(page); page = ""; }
      if (sentence.length > limit) {
        for (const word of sentence.split(" ")) {
          if (page && page.length + word.length + 1 > limit) { out.push(page); page = ""; }
          page += (page ? " " : "") + word;
        }
      } else page += (page ? " " : "") + sentence;
    }
    if (page) out.push(page);
  }
  return out;
}

export class DomUi implements CrystalUi {
  private pages: string[] = [];
  private resolve?: () => void;
  private waiting = false;
  private yesNoResolve?: (yes: boolean) => void;
  private chooseResolve?: (pick: number | undefined) => void;
  private chooseCancel = true;
  constructor(private layer: HTMLElement, private input: Input, private menuInput: MenuInput) {}
  get busy() { return !!(this.resolve || this.yesNoResolve || this.chooseResolve); }

  private box(page: string, arrow: boolean) {
    let box = this.layer.querySelector<HTMLElement>(".crystal-text");
    if (!box) {
      box = document.createElement("div");
      box.className = "dialogue crystal-text";
      box.setAttribute("role", "status");
      box.addEventListener("click", () => this.advance());
      this.layer.append(box);
    }
    box.innerHTML = `${escapeHtml(page)}${arrow ? `<span class="advance">${this.input.confirmLabel} ▸</span>` : ""}`;
  }
  text(pages: string[], wait: boolean): Promise<void> {
    if (!pages.length) return Promise.resolve();
    // A copy: reading pages empties this list, not the caller's.
    this.pages = [...pages];
    this.waiting = wait;
    return new Promise(resolve => {
      this.resolve = resolve;
      this.show();
    });
  }
  private show() {
    const last = this.pages.length === 1;
    this.box(this.pages[0], !last || this.waiting);
    if (last && !this.waiting) this.finish();
  }
  private finish() {
    const r = this.resolve;
    this.resolve = undefined;
    // Nothing waits for A any more, so the prompt goes until the next wait.
    this.layer.querySelector(".crystal-text .advance")?.remove();
    r?.();
  }
  private advance() {
    if (!this.resolve) return;
    this.pages.shift();
    if (this.pages.length) return this.show();
    this.finish();
  }
  waitButton(): Promise<void> {
    const box = this.layer.querySelector<HTMLElement>(".crystal-text");
    if (box && !box.querySelector(".advance")) box.insertAdjacentHTML("beforeend", `<span class="advance">${this.input.confirmLabel} ▸</span>`);
    this.pages = [box?.textContent ?? ""];
    this.waiting = true;
    return new Promise(resolve => { this.resolve = resolve; });
  }
  closeText() {
    this.layer.querySelector(".crystal-text")?.remove();
  }
  yesNo(): Promise<boolean> {
    return new Promise(resolve => {
      const box = document.createElement("div");
      box.className = "crystal-yesno yellow-yesno";
      box.innerHTML = "<button data-yes>YES</button><button data-no>NO</button>";
      this.layer.append(box);
      const finish = (yes: boolean) => {
        this.yesNoResolve = undefined;
        box.remove();
        resolve(yes);
      };
      this.yesNoResolve = finish;
      box.querySelector<HTMLButtonElement>("[data-yes]")!.onclick = () => finish(true);
      box.querySelector<HTMLButtonElement>("[data-no]")!.onclick = () => finish(false);
      box.querySelector<HTMLButtonElement>("[data-yes]")!.focus({ preventScroll: true });
    });
  }
  choose(options: string[], o: { title?: string; cancel?: boolean; columns?: number } = {}): Promise<number | undefined> {
    return new Promise(resolve => {
      const box = document.createElement("div");
      box.className = "crystal-choices";
      if (o.columns && o.columns > 1) box.style.gridTemplateColumns = `repeat(${o.columns}, 1fr)`;
      box.innerHTML = `${o.title ? `<p>${escapeHtml(o.title)}</p>` : ""}${options.map((t, i) => `<button data-choice="${i}">${escapeHtml(t)}</button>`).join("")}`;
      this.layer.append(box);
      this.chooseCancel = o.cancel !== false;
      const finish = (pick: number | undefined) => {
        this.chooseResolve = undefined;
        box.remove();
        resolve(pick);
      };
      this.chooseResolve = finish;
      for (const b of box.querySelectorAll<HTMLButtonElement>("[data-choice]")) b.onclick = () => finish(+b.dataset.choice!);
      box.querySelector<HTMLButtonElement>("[data-choice]")?.focus({ preventScroll: true });
    });
  }
  frame(input: Input, now: number) {
    if (this.yesNoResolve) {
      const buttons = [...this.layer.querySelectorAll<HTMLButtonElement>(".crystal-yesno button")];
      const focused = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (input.hit("up") || input.hit("down")) buttons[focused === 0 ? 1 : 0]?.focus({ preventScroll: true });
      else if (input.hit("a")) this.yesNoResolve(focused !== 1);
      else if (input.hit("b")) this.yesNoResolve(false);
      return;
    }
    if (this.chooseResolve) {
      if (input.hit("b") && this.chooseCancel) this.chooseResolve(undefined);
      else this.menuInput.update(this.layer.querySelector(".crystal-choices") as HTMLElement ?? this.layer, input, now, false);
      return;
    }
    if (this.resolve && (input.hit("a") || input.hit("b"))) this.advance();
  }
}

/** Answers everything at once: text is read, YES or the first choice is taken (or `answers` in order). */
export class HeadlessUi implements CrystalUi {
  readonly log: string[] = [];
  answers: (boolean | number | undefined)[] = [];
  /** Questions left before every answer is NO or cancel, so menus that loop come to an end. */
  budget = Infinity;
  busy = false;
  private record(...lines: string[]) {
    this.log.push(...lines);
    if (this.log.length > 400) this.log.splice(0, this.log.length - 400);
  }
  text(pages: string[]) {
    this.record(...pages);
    return Promise.resolve();
  }
  waitButton() { return Promise.resolve(); }
  closeText() {}
  yesNo() {
    const a = this.budget-- <= 0 ? false : this.answers.length ? this.answers.shift() : true;
    this.record(`[${a ? "YES" : "NO"}]`);
    return Promise.resolve(!!a);
  }
  choose(options: string[]) {
    const a = this.budget-- <= 0 ? undefined : this.answers.length ? this.answers.shift() : 0;
    const pick = typeof a === "number" && a < options.length ? a : a === undefined ? undefined : 0;
    this.record(`[${pick === undefined ? "cancel" : options[pick]}]`);
    return Promise.resolve(pick);
  }
  frame() {}
}
