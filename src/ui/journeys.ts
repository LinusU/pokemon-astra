import type { AdventureId, JourneyEntry } from "../game/storage";
import { escapeHtml, panel, type PanelCursor } from "./shell";
import "./journeys.css";

export interface AdventureInfo {
  id: AdventureId;
  name: string;
  blurb: string;
  /** Shown instead of starting when the adventure still needs something. */
  note?: string;
}

type Portrait = { species: number; dvs: number[] };
export interface JourneyListOptions {
  entries: JourneyEntry[];
  adventures: AdventureInfo[];
  sprite: (mon: Portrait) => string;
  cursor: PanelCursor;
  error?: string;
  onContinue: (entry: JourneyEntry) => void;
  onNew: (adventure: AdventureId) => void;
  onManageRoms: () => void;
  onExport: (entry: JourneyEntry) => void;
  onDelete: (entry: JourneyEntry) => Promise<void>;
  /** Restore a backup file as a new journey. Resolves to an error message on failure. */
  onRestore: (file: File) => Promise<string | undefined>;
}

const day = 24 * 60 * 60 * 1000;
export function playedLabel(updated: number, now = Date.now()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (updated >= start.getTime()) return "Played today";
  if (updated >= start.getTime() - day) return "Played yesterday";
  return "Played " + new Date(updated).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function mountJourneyList(layer: HTMLElement, options: JourneyListOptions) {
  const name = (a: AdventureId) => options.adventures.find(x => x.id === a)?.name ?? a;
  const rows = options.entries.map(entry => {
    const s = entry.summary;
    const lead = s?.lead ? `<img src="${options.sprite(s.lead)}" alt="">` : `<i class="journey-blank" aria-hidden="true"></i>`;
    const detail = s ? `${s.badges}/${badgeCount(entry.adventure)} badges · ${s.caught} caught · ${playedLabel(entry.updated)}` : playedLabel(entry.updated);
    return `<button class="journey-row" data-journey="${escapeHtml(entry.id)}">${lead}<span><em class="adventure-tag tag-${entry.adventure}">${escapeHtml(name(entry.adventure))}</em><strong>${escapeHtml(s?.player ? `${s.player} · ${s.place}` : s?.place ?? "New journey")}</strong><small>${escapeHtml(detail)}</small></span></button>`;
  });
  const p = panel(layer, options.entries.length ? "Your journeys" : "Begin a journey",
    `${options.entries.length ? `<div class="journey-list">${rows.join("")}</div>` : "<p>Choose an adventure to begin. Each journey keeps its own save in this browser.</p>"}
    ${options.error ? `<p class="error" role="alert">${escapeHtml(options.error)}</p>` : ""}
    <div class="buttons"><button id="new-journey">New journey</button><button class="secondary" data-backup-picker id="restore-journey">Restore backup</button><button class="secondary" id="rom-manager">ROM manager</button><input hidden type="file" accept=".json,application/json"></div>`,
    "opening-panel arrival-card journeys-panel", options.cursor);
  if (!p.contains(document.activeElement)) p.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  for (const button of p.querySelectorAll<HTMLButtonElement>("[data-journey]")) {
    const entry = options.entries.find(e => e.id === button.dataset.journey)!;
    button.onclick = () => journeyCard(layer, entry, options);
  }
  p.querySelector<HTMLButtonElement>("#new-journey")!.onclick = () => adventurePicker(layer, options);
  p.querySelector<HTMLButtonElement>("#rom-manager")!.onclick = options.onManageRoms;
  const file = p.querySelector<HTMLInputElement>("input[type=file]")!;
  const picker = p.querySelector<HTMLButtonElement>("#restore-journey")!;
  picker.onclick = () => file.click();
  file.onchange = async () => {
    const chosen = file.files?.[0];
    file.value = "";
    if (!chosen) return;
    picker.disabled = true;
    const error = await options.onRestore(chosen);
    picker.disabled = false;
    if (error && p.isConnected) mountJourneyList(layer, { ...options, error });
  };
  return p;
}

function journeyCard(layer: HTMLElement, entry: JourneyEntry, options: JourneyListOptions) {
  const info = options.adventures.find(a => a.id === entry.adventure);
  const s = entry.summary;
  const p = panel(layer, s?.place ?? info?.name ?? "Journey",
    `<div class="journey-record">${s?.lead ? `<img src="${options.sprite(s.lead)}" alt="">` : ""}<div><strong>${escapeHtml(info?.name ?? entry.adventure)}${s?.player ? ` · ${escapeHtml(s.player)}` : ""}</strong><small>${s ? `${s.badges}/${badgeCount(entry.adventure)} badges · ${s.caught} caught · ` : ""}${escapeHtml(playedLabel(entry.updated))}</small></div></div>
    <div class="buttons"><button id="continue">Continue</button><button class="secondary" id="export">Export backup</button><button class="secondary" id="delete">Delete journey</button><button class="secondary" id="back">Back</button></div>`,
    "opening-panel arrival-card");
  p.querySelector<HTMLButtonElement>("#continue")!.onclick = () => options.onContinue(entry);
  p.querySelector<HTMLButtonElement>("#export")!.onclick = () => options.onExport(entry);
  p.querySelector<HTMLButtonElement>("#back")!.onclick = () => mountJourneyList(layer, options);
  p.querySelector<HTMLButtonElement>("#delete")!.onclick = () => {
    const confirm = panel(layer, "Delete this journey?",
      `<p>${escapeHtml(info?.name ?? entry.adventure)}${s ? ` · ${escapeHtml(s.place)} · ${s.badges}/${badgeCount(entry.adventure)} badges` : ""}</p><p>Deleting removes this save from the browser. It cannot be undone, so export a backup first if you might want it again.</p>
      <div class="buttons"><button id="back">Keep journey</button><button class="secondary" id="export">Export backup</button><button class="secondary danger" id="confirm-delete">Delete</button></div>`,
      "opening-panel");
    confirm.querySelector<HTMLButtonElement>("#back")!.onclick = () => journeyCard(layer, entry, options);
    confirm.querySelector<HTMLButtonElement>("#export")!.onclick = () => options.onExport(entry);
    confirm.querySelector<HTMLButtonElement>("#confirm-delete")!.onclick = async () => {
      try {
        await options.onDelete(entry);
      } catch {
        mountJourneyList(layer, { ...options, error: "The browser could not delete that journey. Try again." });
      }
    };
  };
}

/** Johto and Kanto make sixteen badges. */
const badgeCount = (adventure: AdventureId) => adventure.startsWith("crystal") ? 16 : 8;

function adventurePicker(layer: HTMLElement, options: JourneyListOptions) {
  const p = panel(layer, "Choose an adventure",
    `<div class="adventure-choices">${options.adventures.map(a =>
      `<button data-adventure="${a.id}" class="adventure-choice tag-${a.id}"><strong>${escapeHtml(a.name)}</strong><small>${escapeHtml(a.blurb)}</small>${a.note ? `<em>${escapeHtml(a.note)}</em>` : ""}</button>`).join("")}</div>
    <div class="buttons"><button class="secondary" id="back">Back</button></div>`,
    "opening-panel arrival-card adventure-picker");
  p.querySelector<HTMLButtonElement>("[data-adventure]")?.focus({ preventScroll: true });
  for (const button of p.querySelectorAll<HTMLButtonElement>("[data-adventure]"))
    button.onclick = () => options.onNew(button.dataset.adventure as AdventureId);
  p.querySelector<HTMLButtonElement>("#back")!.onclick = () => mountJourneyList(layer, options);
}
