import { trackMenuCursor } from "./menu-cursor";
import { escapeHtml } from "./shell";
import "./party.css";

export function battleStatus(status: number): [string, string] | undefined {
  if (status & 7) return ["SLP", "Asleep"];
  if (status & 8) return ["PSN", "Poisoned"];
  if (status & 16) return ["BRN", "Burned"];
  if (status & 32) return ["FRZ", "Frozen"];
  if (status & 64) return ["PAR", "Paralyzed"];
}

type PartyRow = {
  name: string;
  sprite: string;
  level: number;
  status: number;
  hp: number;
  maxHp: number;
  note?: string;
  disabled?: boolean;
  /** An Egg shows only its name and note: no level, condition or HP. */
  egg?: boolean;
};

type PartyOptions = {
  title: string;
  rows: PartyRow[];
  confirm: string;
  initialSlot?: number;
  onSelect: (slot: number) => void;
  onBack?: () => void;
};

export function mountParty(host: HTMLElement, options: PartyOptions) {
  const screen = document.createElement("section");
  screen.className = "party-screen";
  screen.setAttribute("role", "dialog");
  screen.setAttribute("aria-label", options.title);
  const rows = Array.from({ length: 6 }, (_, slot) => {
    const mon = options.rows[slot];
    if (!mon) return '<li class="party-empty" aria-label="Empty slot"><span aria-hidden="true">—</span></li>';
    const condition = mon.egg ? undefined : mon.hp === 0 ? ["FNT", "Fainted"] : battleStatus(mon.status);
    const fraction = Math.min(1, Math.max(0, mon.hp / Math.max(1, mon.maxHp)));
    const meta = [mon.egg ? "" : `Lv ${mon.level}`, mon.note ? escapeHtml(mon.note) : ""].filter(Boolean).join(" · ");
    return `<li><button type="button" class="party-member" data-slot="${slot}"${mon.disabled ? " disabled" : ""}>
      <img src="${escapeHtml(mon.sprite)}" alt="">
      <span class="party-identity"><strong>${escapeHtml(mon.name)}</strong>
        <span class="party-meta">${meta}${condition ? ` <abbr title="${condition[1]}" aria-label="${condition[1]}">${condition[0]}</abbr>` : ""}</span>
      </span>
      ${mon.egg ? "" : `<span class="party-health"><span><b>HP</b> ${mon.hp} / ${mon.maxHp}</span>
        <span class="party-gauge" aria-hidden="true"><i class="${fraction <= 0.2 ? "low" : fraction <= 0.5 ? "mid" : ""}" style="width:${fraction * 100}%"></i></span>
      </span>`}
    </button></li>`;
  });
  screen.innerHTML = `<header><h2>${escapeHtml(options.title)}</h2><span aria-label="${options.rows.length} of 6 Pokémon">${options.rows.length} / 6</span></header>
    <ol class="party-slots">${rows.join("")}</ol>
    <footer>${options.rows.some(row => !row.disabled) ? `<span><kbd>A</kbd> ${escapeHtml(options.confirm)}</span>` : '<span>No eligible Pokémon</span>'}
    ${options.onBack ? `<button type="button" id="back" tabindex="-1"><kbd>B</kbd> Back</button>` : ""}</footer>`;
  host.append(screen);
  const buttons = screen.querySelectorAll<HTMLButtonElement>("[data-slot]:enabled");
  trackMenuCursor(screen);
  for (const button of buttons)
    button.onclick = () => options.onSelect(Number(button.dataset.slot));
  const back = screen.querySelector<HTMLButtonElement>("#back");
  if (back && options.onBack) back.onclick = options.onBack;
  const selected = screen.querySelector<HTMLButtonElement>(`[data-slot="${options.initialSlot ?? 0}"]:enabled`)
    ?? buttons[0] ?? back;
  selected?.focus({ preventScroll: true });
}
