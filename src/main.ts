import { openFieldGuide } from "./ui/field-guide";
import "./ui/backup-review.css";
import { mountMart } from "./ui/mart";
import { chooseEvolutionMove } from "./ui/learn-move";
import { levelEvolution, queueEvolutionMoves, resolveEvolutionMove, finishEvolutionChoice, recordTravel } from "./game/training";
import { mountPartnerSummary } from "./ui/partner-summary";
import { bagKeyForItem, ballIds, giveFromBag, nativeItemId, rewardItems, rewardShortfall, stoneIds } from "./game/items";
import { hatchEgg } from "./game/nursery";
import { openNursery, showHatch } from "./ui/nursery";
import { captureRegistration, fossilChoices, sortCollection, starterSpecies, storePokemon } from "./game/collection";
import { mountStoragePc, type PcState } from "./ui/storage-pc";
import { specimenCard } from "./ui/specimen";
import { typeNames } from "./game/type-names";
import { openFieldwork } from "./ui/fieldwork";
import { requestHint, updateChart } from "./world/requests";
import { gymBattleBackdrop } from "./game/gym-art";
import { showBadgeAward } from "./ui/badge-award";
import { iceLanding, advanceGlide } from "./game/skating";
import { expeditionState, pitchFlag } from "./world/expeditions";
import { gymState } from "./world/gyms";
import { guardianField } from "./world/guardians";
import { awardBadge, badgeMask, fieldHabitats, fieldTeam } from "./game/badges";
import { fishingPool } from "./game/pokedex";
import { Input } from "./game/input";
import { Renderer } from "./game/render";
import { WorldActors, interactionTarget, type Facing } from "./game/actors";
import { heldHeading, walkFreely, walkSpeed, type Position } from "./game/free-movement";
import {
  barrierTarget,
  fieldActions,
  exitOpen,
  exitAt,
  connectedBlocked,
  crossConnection,
} from "./game/navigation";
import { regionPosition } from "./game/region";
import { mountRegionChart } from "./ui/region-map";
import { campaignObjective, directions } from "./game/journal";
import { mountFieldMap } from "./ui/field-map";
import { mountBag, itemInfo, type BagState } from "./ui/bag";
import { battleStatus, mountParty } from "./ui/party";
import { mountPokedex, type DexState } from "./ui/pokedex";
import { mountJournal, type JournalState } from "./ui/journal";
import { MenuInput } from "./ui/menu-input";
import { MEDICINE, isMedicine, useMedicine } from "./game/medicine";
import { GameAudio } from "./game/audio";
import { battleTheme, fieldMusic, trainerIntroMusic, victoryTheme, type MusicScene } from "./game/music";
import { BattleLaunch, type FinishedBattle } from "./ui/battle-launch";
import { playEvolution } from "./ui/evolution";
import { createJourney, deleteJourney, download, JourneyConflict, JourneyStore, listJourneys, peekJourney, type AdventureId, type JourneyEntry, type JourneySummary } from "./game/storage";
import { mountJourneyList, type AdventureInfo } from "./ui/journeys";
import { continueYellowJourney, hasYellowCartridge, newYellowJourney, type YellowHost, type YellowRunner } from "./yellow/launch";
import {
  freshSave,
  isValidSave,
  normalizeSavePosition,
  recordVisit,
  restoreExpeditions,
  restoreVisits,
  meetsRequirement,
  type Save,
} from "./game/save";
import { createShell, panel, escapeHtml, type PanelCursor } from "./ui/shell";
import {
  WORLD,
  isWildEncounter,
  type Exit,
  type Requirement,
  type Reward,
  type WorldObject,
  type WorldMap,
} from "./world";
import { pokemonAppearance, type PokemonPortrait } from "./engine/appearance";
import type { Engine, Pokemon } from "./engine";
import { openCartridge } from "./ui/cartridge";
import { removeDevelopmentWorker, setupOfflinePlay } from "./ui/offline";
import "./styles.css";
import "./ui/settings.css";
import "./ui/region-map.css";

let journeyStore: JourneyStore;
const input = new Input(),
  { canvas, layer, saveWarning } = createShell(input),
  renderer = new Renderer(canvas),
  menuInput = new MenuInput(),
  actors = new WorldActors();
let glide: { x: number; y: number } | undefined;
let battleLaunch: BattleLaunch | undefined;
let engine: Engine,
  save = freshSave(),
  mode = "loading",
  dialogueCallback: (() => void) | undefined,
  last = performance.now(),
  encounterDistance = 0,
  repelWoreOff = false,
  exitLock = true,
  bumpLatched = false,
  battleObject: WorldObject | undefined,
  approachingTrainer: WorldObject | undefined,
  battleMusic: MusicScene | undefined,
  interactionMusic: MusicScene | undefined,
  battleSpecies = 0,
  lastAutosave = 0,
  journeyStarted = false,
  encounterTarget = 6;
const has = (r?: Requirement) =>
  meetsRequirement(save, r, (id) => engine.species(id).types);
const spriteCache = new Map<string, string>();
function sprite(mon: PokemonPortrait | number, back = false) {
  const appearance = pokemonAppearance(mon);
  const key = `${appearance.species}:${back}:${appearance.form}:${appearance.shiny}`;
  if (!spriteCache.has(key)) {
    try {
      const pixels = engine.sprite(appearance.species, back, appearance),
        c = document.createElement("canvas");
      c.width = 56;
      c.height = 56;
      let bottom = pixels.height;
      if (back) {
        // Some back sprites end in transparent rows. Align the last visible row.
        for (let alpha = pixels.data.length - 1; alpha >= 3; alpha -= 4) {
          if (pixels.data[alpha] === 0) continue;
          bottom = Math.floor(alpha / (pixels.width * 4)) + 1;
          break;
        }
      }
      c.getContext("2d")!.putImageData(
        pixels,
        Math.floor((56 - pixels.width) / 2),
        56 - bottom,
      );
      spriteCache.set(key, c.toDataURL());
    } catch {
      return "";
    }
  }
  return spriteCache.get(key)!;
}
const sound = new GameAudio(scene, updateSoundButton);
function updateSoundButton() {
  const button = document.querySelector<HTMLButtonElement>("#sound-toggle");
  if (!button) return;
  button.textContent = sound.failed
    ? "♫ Retry sound"
    : sound.playing
      ? "♫ Sound on"
      : sound.enabled
        ? "♫ Enable sound"
        : "♫ Sound off";
  button.setAttribute("aria-pressed", String(sound.enabled));
}
function cry(id: number) {
  sound.cry(id);
}
function toggleMusic() {
  if (mode === "saving") return;
  save.settings.music = !sound.enabled;
  sound.setEnabled(save.settings.music);
  persist();
}
window.addEventListener(
  "pointerdown",
  () => {
    void sound.unlock();
  },
  { passive: true },
);
window.addEventListener(
  "keydown",
  () => {
    void sound.unlock();
  },
  { passive: true },
);
document
  .querySelector("#sound-toggle")
  ?.addEventListener("pointerdown", (e) => e.stopPropagation());
document.querySelector("#sound-toggle")?.addEventListener("click", () => {
  if (sound.enabled && !sound.playing) void sound.unlock();
  else toggleMusic();
});
function currentField(id = save.map) {
  const map = expeditionState(gymState(WORLD[id], save.flags), save.flags);
  return guardianField(map, save.flags, has);
}
let yellow: YellowRunner | undefined;
function scene(): MusicScene | number {
  if (yellow) return yellow.musicScene();
  if (mode === "title" || mode === "intro") return "title";
  if (mode === "ceremony") return "hallOfFame";
  if (mode === "evolution") return "evolution";
  if (mode === "evolution-result") return "silent";
  if (mode === "battle" || mode === "encounter" || mode === "registration")
    return battleMusic ?? battleTheme(battleObject, !!save.settings.night);
  if ((mode === "dialogue" || mode === "menu") && interactionMusic) return interactionMusic;
  if (mode === "world" && approachingTrainer && actors.approaching)
    return trainerIntroMusic(approachingTrainer);
  const map = currentField();
  if (map?.tiles[Math.floor(save.y)]?.[Math.floor(save.x)] === "~" && save.abilities.includes("surf"))
    return "surf";
  return fieldMusic(map);
}
const flag = (f?: string) => {
  if (f && !save.flags.includes(f)) save.flags.push(f);
};
function astraSummary(journey: Save): JourneySummary {
  const lead = journey.party[0];
  return {
    place: WORLD[journey.map]?.name.split(" · ")[0] ?? "Astra",
    badges: journey.badges,
    caught: journey.caught.length,
    ...(lead && { lead: { species: lead.species, dvs: [...lead.dvs] } }),
  };
}
function summarize(adventure: AdventureId, data: unknown) {
  if (adventure === "astra" && isValidSave(data)) return astraSummary(data);
}
const ADVENTURE_LIST: AdventureInfo[] = [
  { id: "astra", name: "Astra", blurb: "Survey the eight beacons of the Astra region with Professor Alder." },
  { id: "yellow", name: "Yellow", blurb: "Kanto with Pikachu, read from your own Pokémon Yellow cartridge." },
];
function yellowHost(): YellowHost {
  return {
    engine, input, menuInput, layer, canvas, sound, saveWarning, sprite, cry,
    activate: game => {
      yellow = game;
      mode = game ? "yellow" : "title";
      sound.refreshMusic();
    },
    journeys: error => void journeys(error),
  };
}
let journeyCursor = {};
async function journeys(error?: string) {
  mode = "title";
  journeyStarted = false;
  panel(layer, "Your journeys", "<p>Reading your browser saves…</p>", "opening-panel");
  let entries: JourneyEntry[];
  try {
    entries = await listJourneys(summarize);
  } catch {
    mode = "recovery";
    const p = panel(layer, "Save storage unavailable",
      '<p>Astra could not read your journeys. Allow browser storage and try again.</p><button id="retry">Read saves again</button>', "opening-panel");
    p.querySelector<HTMLButtonElement>("#retry")!.onclick = () => void journeys();
    return;
  }
  sound.attach(engine, true);
  const yellowReady = await hasYellowCartridge();
  mountJourneyList(layer, {
    entries, adventures: ADVENTURE_LIST.map(a => a.id === "yellow" && !yellowReady ? { ...a, note: "You'll be asked for your Yellow cartridge." } : a),
    sprite, cursor: journeyCursor, error,
    onContinue: entry => {
      if (entry.adventure === "yellow") return void continueYellowJourney(yellowHost(), entry);
      journeyStore = new JourneyStore(entry.id, astraSummary);
      void readJourney();
    },
    onNew: adventure => adventure === "yellow" ? void newYellowJourney(yellowHost(), () => void journeys()) : intro(() => void journeys()),
    onExport: async entry => {
      try {
        download(`pokemon-${entry.adventure}-save.json`, await peekJourney(entry.id));
      } catch {
        void journeys("The browser could not read that journey for export.");
      }
    },
    onDelete: async entry => {
      await deleteJourney(entry.id);
      journeyCursor = {};
      void journeys();
    },
    onRestore: async file => {
      let next: Save;
      try {
        const data = JSON.parse(await file.text());
        if (data?.adventure === "yellow") {
          const { isYellowSave } = await import("./yellow/save");
          if (!isYellowSave(data)) return "Choose a valid Yellow backup.";
          await createJourney("yellow", data);
          void journeys();
          return;
        }
      } catch { /* handled below as an Astra backup */ }
      try {
        next = await readBackup(file);
      } catch (error) {
        return error instanceof Error ? error.message : "Choose a readable Astra backup.";
      }
      try {
        await createJourney("astra", next, astraSummary(next));
      } catch {
        return "The browser could not store this backup. Free some space and try again.";
      }
      void journeys();
    },
  });
}
let saveIssue: "storage" | "conflict" | undefined;
function showSaveIssue(issue?: typeof saveIssue) {
  saveIssue = issue;
  saveWarning.hidden = !issue;
  saveWarning.textContent = issue === "conflict" ? "Newer save · Menu → Options" : "Unsaved progress · Menu → Options";
  const controls = layer.querySelector<HTMLElement>(".save-retry");
  if (controls) {
    controls.hidden = !issue;
    controls.querySelector("p")!.textContent = issue === "conflict"
      ? "Another window saved a newer journey. Export this session to keep both."
      : "Progress is unsaved. Retry saving here or export a backup.";
    controls.querySelector("button")!.textContent = issue === "conflict" ? "Open browser save" : "Retry save";
  }
}
async function writeJourney(next: Save, skipUnchanged = false) {
  try {
    if (await journeyStore.write(next, skipUnchanged)) showSaveIssue();
  } catch (error) {
    if (error instanceof JourneyConflict) showSaveIssue("conflict");
    throw error;
  }
}
function persist() {
  if (!journeyStarted || mode === "saving") return;
  lastAutosave = save.steps;
  void writeJourney(save, true).catch(error => {
    if (!(error instanceof JourneyConflict)) showSaveIssue("storage");
  });
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && (mode === "world" || mode === "menu")) persist();
});
function prepareSave(data: Save) {
  const ready = normalizeSavePosition(restoreExpeditions(data));
  restoreVisits(ready);
  sortCollection(ready.storage);
  return ready;
}
function restoreSession(ready: Save) {
  save = ready;
  input.setGamepadLayout(!!save.settings.swapGamepadAB);
  fieldBagState = {};
  pcState = {};
  fieldDexState = {};
  fieldJournalState = {};
  fieldCursors = {};
  journeySelection = "party";
  actors.reset();
  glide = undefined;
  encounterDistance = 0;
  repelWoreOff = false;
  encounterTarget = 6;
  lastAutosave = save.steps;
  exitLock = true;
  approachingTrainer = undefined;
  battleMusic = undefined;
  interactionMusic = undefined;
  renderer.setNight(!!save.settings.night);
  sound.attach(engine, save.settings.music !== false);
}
async function readBackup(file: File) {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw Error("Choose a readable Astra JSON save.");
  }
  if (!isValidSave(data)) throw Error("Choose a valid Astra JSON save.");
  return prepareSave(data);
}
async function importJourney(next: Save) {
  const previousMode = mode;
  mode = "saving";
  layer.inert = true;
  try {
    try {
      await writeJourney(next);
    } catch (error) {
      if (error instanceof JourneyConflict) throw error;
      throw Error("The browser could not store this backup. Free some space and try again.");
    }
    restoreSession(next);
  } finally {
    layer.inert = false;
    mode = previousMode;
  }
}
function bindBackupPicker(p: HTMLElement, done: () => void, failed: (reason: string) => void, keepCurrent?: () => void) {
  const input = p.querySelector<HTMLInputElement>("input[type=file]")!;
  const picker = p.querySelector<HTMLButtonElement>("[data-backup-picker]")!;
  picker.onclick = () => input.click();
  function preview(next: Save, error?: string) {
    const row = (label: string, journey: Save) => `<div><dt>${label}</dt><dd><strong>${escapeHtml(WORLD[journey.map].name)}</strong>
      <small>${journey.badges}/8 badges · ${journey.caught.length} caught</small></dd></div>`;
    const review = panel(layer, "Restore this backup?",
      `<dl class="backup-records">${row("Current", save)}${row("Backup", next)}</dl>
      <p${error ? ' class="error" role="alert"' : ""}>${error ? escapeHtml(error) : "Restoring replaces your browser save."}</p>
      <div class="buttons"><button id="back">Keep current</button><button id="export" class="secondary">Export current</button>
      <button id="restore-backup" class="secondary">${error ? "Retry restore" : "Restore"}</button></div>`, "backup-review");
    const back = review.querySelector<HTMLButtonElement>("#back")!;
    back.onclick = keepCurrent!;
    review.querySelector<HTMLButtonElement>("#export")!.onclick = () => download("pokemon-astra-save.json", save);
    review.querySelector<HTMLButtonElement>("#restore-backup")!.onclick = () => restore(next);
    back.focus({ preventScroll: true });
  }
  async function restore(next: Save) {
    try {
      await importJourney(next);
    } catch (error) {
      if (error instanceof JourneyConflict && !journeyStarted) return startupConflict();
      const reason = error instanceof Error ? error.message : "Could not restore this backup.";
      if (keepCurrent && !(error instanceof JourneyConflict)) return preview(next, reason);
      return failed(reason);
    }
    done();
  }
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    picker.disabled = true;
    input.value = "";
    let next: Save;
    try {
      next = await readBackup(file);
    } catch (error) {
      if (p.isConnected) failed(error instanceof Error ? error.message : "Choose a readable Astra backup.");
      return;
    } finally {
      picker.disabled = false;
    }
    if (!p.isConnected) return;
    if (keepCurrent) preview(next);
    else await restore(next);
  };
}
function message(text: string, callback?: () => void, speaker?: string, music?: MusicScene) {
  // Keep short thoughts together and prefer a sentence break between pages.
  const pages: string[] = [];
  let page = "";
  const sentences = text.trim().split(/(?<=[.!?])\s+(?=[A-Z“])/);
  for (const sentence of sentences) {
    if (page && page.length + sentence.length > 105) {
      pages.push(page);
      page = "";
    }
    for (const word of sentence.split(/\s+/)) {
      if (page.length + word.length + 1 > 110 && page) {
        pages.push(page);
        page = "";
      }
      page += (page ? " " : "") + word;
    }
  }
  if (page) pages.push(page);
  function show() {
    mode = "dialogue";
    interactionMusic = music;
    const next = pages.shift() || "";
    dialogueCallback = pages.length ? show : callback;
    layer.innerHTML = `<div class="dialogue" role="status">${speaker ? `<strong class="speaker">${escapeHtml(speaker)}</strong>` : ""}${escapeHtml(next)}<span class="advance">${input.confirmLabel} ▸</span></div>`;
    layer.querySelector(".dialogue")?.addEventListener("click", advance);
    sound.refreshMusic();
  }
  show();
}
function advance() {
  if (mode !== "dialogue") return;
  layer.innerHTML = "";
  mode = "world";
  interactionMusic = undefined;
  const cb = dialogueCallback;
  dialogueCallback = undefined;
  cb?.();
  sound.refreshMusic();
}
function startupConflict() {
  mode = "recovery";
  const p = panel(layer, "Your browser save changed",
    '<p>Another window saved a journey while this screen was open. Open that save to continue.</p><button id="retry">Open browser save</button>', "opening-panel");
  p.querySelector<HTMLButtonElement>("#retry")!.onclick = () => void readJourney();
}
async function readJourney() {
  mode = "loading";
  panel(layer, "Opening your journey", "<p>Reading your browser save…</p>", "opening-panel");
  let existing: unknown;
  try {
    existing = await journeyStore.read();
    showSaveIssue();
  } catch {
    mode = "recovery";
    const p = panel(layer, "Save storage unavailable",
      '<p>Astra could not read your journey. Allow browser storage and try again.</p><button id="retry">Read save again</button>', "opening-panel");
    p.querySelector<HTMLButtonElement>("#retry")!.onclick = () => void readJourney();
    return;
  }
  if (isValidSave(existing)) {
    restoreSession(prepareSave(existing));
    title();
  } else if (existing !== undefined) recoverJourney(existing);
  else void journeys("That journey is no longer in this browser.");
}
function recoverJourney(existing: unknown) {
  mode = "recovery";
  const p = panel(layer, "Recover your journey",
    '<p>Astra could not read this save. Export a copy, restore a backup or begin a new journey.</p><div class="buttons"><button id="export">Export current save</button><button data-backup-picker id="choose">Choose backup</button><button class="secondary" id="new">All journeys</button><input hidden type="file" accept=".json,application/json"></div>', "opening-panel");
  p.querySelector<HTMLButtonElement>("#export")!.onclick = () => download("pokemon-astra-recovery.json", existing);
  p.querySelector<HTMLButtonElement>("#new")!.onclick = () => void journeys();
  bindBackupPicker(p, title, error => { p.querySelector("p")!.textContent = error; });
}
function title() {
  mode = "title";
  const goal = directions(save, has);
  const p = panel(
    layer,
    "Welcome back",
    `<div class="journey-record">${save.party[0] ? `<img src="${sprite(save.party[0])}" alt="${escapeHtml(engine.species(save.party[0].species).name)}">` : ""}<div><strong>${escapeHtml(WORLD[save.map].name)}</strong><small>${save.badges}/8 badges · ${save.caught.length} caught</small></div></div><div class="objective"><strong>${escapeHtml(goal.title)}</strong><br>${escapeHtml(goal.hint)}</div><div class="buttons"><button id="continue">Continue journey</button><button class="secondary" id="new">All journeys</button></div>`,
    "opening-panel arrival-card", fieldCursors.title ??= {},
  );
  p.querySelector("#continue")!.addEventListener("click", () => {
    journeyStarted = true;
    mode = "world";
    layer.innerHTML = "";
    void sound.unlock();
  });
  p.querySelector<HTMLButtonElement>("#new")!.onclick = () => void journeys();
}
function intro(back: () => void, error = "") {
  mode = "intro";
  const p = panel(
    layer,
    "Dewdrop Village",
    `<p>The flock circles Dewdrop again. Robin thinks a beacon has gone dark.</p><div class="objective">Find Alder in the north garden lab. Press ${input.confirmLabel} to choose your partner.</div>${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ""}<div class="buttons"><button id="begin">Begin journey</button><button id="how" class="secondary">How to play</button><button id="cancel" class="secondary">Back</button></div>`,
    "opening-panel arrival-card", fieldCursors.intro ??= {},
  );
  p.querySelector<HTMLButtonElement>("#cancel")!.onclick = back;
  p.querySelector<HTMLButtonElement>("#how")!.onclick = () => fieldBasics(() => intro(back, error));
  p.querySelector<HTMLButtonElement>("#begin")!.onclick = async () => {
    const next = prepareSave(freshSave());
    next.settings.music = sound.enabled;
    mode = "loading";
    panel(layer, "Beginning your adventure", "<p>Saving in Dewdrop Village…</p>", "opening-panel");
    try {
      const id = await createJourney("astra", next, astraSummary(next));
      journeyStore = new JourneyStore(id, astraSummary);
      await journeyStore.read();
    } catch {
      return intro(back, "Your adventure could not be saved. Allow browser storage or free some space, then choose Begin journey again.");
    }
    restoreSession(next);
    journeyStarted = true;
    mode = "world";
    layer.innerHTML = "";
    void sound.unlock();
  };
}
function fieldBasics(back: () => void) {
  mode = "guide";
  openFieldGuide(layer, back, !!save.settings.swapGamepadAB, input.connectedGamepads);
}
function specimen(mon: Pokemon) {
  return { ...engine.species(mon.species), ...engine.dexEntry(mon.species), image: sprite(mon) };
}
function starter(selected = 58) {
  mode = "starter";
  const choices = starterSpecies.map(id => {
    const data = engine.species(id);
    const types = [...new Set(data.types)].map(type => typeNames[type]).join(" / ");
    return `<button data-id="${id}"><img src="${sprite(id)}" alt=""><strong>${escapeHtml(data.name)}</strong><small>${types}</small></button>`;
  });
  const p = panel(layer, "Choose your partner",
    `<p>Pick a Pokémon to hear its cry and see its moves.</p><div class="partner-choices">${choices.join("")}</div>`, "partner-lab");
  p.querySelector<HTMLButtonElement>(`[data-id="${selected}"]`)?.focus({ preventScroll: true });
  for (const button of p.querySelectorAll<HTMLButtonElement>("[data-id]")) {
    button.onclick = () => {
      const id = Number(button.dataset.id);
      const mon = engine.makeStarter(id);
      const data = specimen(mon);
      const moves = mon.moves.filter(Boolean).map(move => engine.move(move).name).join(" · ");
      cry(id);
      specimenCard(layer, "Meet your partner", data, `Lv ${mon.level} · ${moves}`,
        `Choose ${data.name}`, () => {
          save.party = [mon];
          flag("starter_" + id);
          if (!save.seen.includes(id)) save.seen.push(id);
          if (!save.caught.includes(id)) save.caught.push(id);
          // Earlier saves already included these supplies before meeting Alder.
          if (save.flags.includes("starter_supplies_pending")) {
            applyReward({ items: [{ item: "poke_ball", amount: 10 }, { item: "potion", amount: 5 }] });
            save.flags = save.flags.filter(f => f !== "starter_supplies_pending");
            sound.overworld("item");
          }
          flag("partner");
          persist();
          message(`${data.name} joined your party! Alder packed 10 Poké Balls and 5 Potions in your Bag. Take the east road to Mossford.`);
        }, { back: () => starter(id) });
    };
  }
}
function itemName(key: string) {
  if (key.startsWith("held_")) {
    const id = nativeItemId(key);
    if (id) return engine.itemName(id);
  }
  const name =
    itemInfo(key).name ??
    (
      {
        kings_rock: "King’s Rock",
        exp_share: "Exp. Share",
        up_grade: "Up-Grade",
      } as Record<string, string>
    )[key];
  return (
    name ||
    key
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
}
function rewardReceipt(r?: Reward) {
  if (!r) return "";
  const lines = Array.from(rewardItems(r), ([item, amount]) => itemName(item) + " × " + amount);
  if (r.species)
    lines.push(
      engine.species(r.species).name +
        (save.party.length >= 6 ? " went to the Center PC" : " joined your party"),
    );
  return lines.join(" · ");
}
function hasRewardSpace(reward?: Reward) {
  const missing = rewardShortfall(save.items, reward);
  if (!missing.length) return true;
  const space = missing.map(({ item, amount }) => itemName(item) + " × " + amount).join(" · ");
  message(`Make room for ${space} in your Bag. You can collect the full reward here when you return.`, undefined, "Bag capacity");
  return false;
}
function applyReward(r?: Reward) {
  if (!r) return;
  if (r.takeItem) {
    if (save.items[r.takeItem] > 1) save.items[r.takeItem]--;
    else delete save.items[r.takeItem];
  }
  if (r.badge) awardBadge(save, r.badge);
  if (r.ability && !save.abilities.includes(r.ability))
    save.abilities.push(r.ability);
  if (r.money) save.money = Math.min(999999, save.money + r.money);
  for (const [item, amount] of rewardItems(r))
    save.items[item] = Math.min(99, (save.items[item] ?? 0) + amount);
  if (r.species) {
    const mon = engine.makePokemon(r.species, r.level || 5);
    if (save.party.length < 6) save.party.push(mon);
    else storePokemon(save.storage, mon);
    if (!save.caught.includes(r.species)) save.caught.push(r.species);
    if (!save.seen.includes(r.species)) save.seen.push(r.species);
  }
}
const isExitOpen = (exit: Exit) => exitOpen(exit, has, save.flags);

function inspectBarrier(exit: Exit) {
  const obstacle = exit.barrier!;
  const action = fieldActions[obstacle.kind];
  if (!has(exit.requires) || !obstacle.flag || !action) {
    flag(`gate_${save.map}_${exit.to}`);
    persist();
    message(
      exit.lockedDialogue || "The passage is closed.",
      undefined,
      action?.[0] ||
        (obstacle.kind === "warden" ? "Trail warden" : "Closed gate"),
    );
    return;
  }
  mode = "menu";
  const p = panel(
    layer,
    action[0],
    `<div class="buttons"><button id="use-field">${action[1]}</button><button class="secondary" id="back">Leave it</button></div>`,
  );
  p.querySelector("#back")!.addEventListener("click", close);
  p.querySelector("#use-field")!.addEventListener("click", () => {
    flag(obstacle.flag);
    persist();
    if (obstacle.kind === "strength" || obstacle.kind === "surf" || obstacle.kind === "flash")
      sound.overworld(obstacle.kind);
    message(action[2]);
  });
}
function canFish(map: WorldMap) {
  if (!save.party.length || !save.flags.includes("quest_angler_complete")) return false;
  const dx = save.facing === "left" ? -1 : save.facing === "right" ? 1 : 0;
  const dy = save.facing === "up" ? -1 : save.facing === "down" ? 1 : 0;
  return map.tiles[Math.floor(save.y + dy * 0.75)]?.[Math.floor(save.x + dx * 0.75)] === "~";
}
function interact() {
  const map = currentField();
  actors.enter(map);
  const barrier = barrierTarget(map, save, isExitOpen);
  if (barrier) {
    sound.overworld("interact");
    inspectBarrier(barrier);
    return;
  }
  const o = interactionTarget(map, save, new Set(save.flags), (o) =>
    actors.position(o),
  );
  if (!o) {
    if (canFish(map)) {
      const fish = fishingPool(map, (id) =>
        engine.species(id).types.includes(21), save,
      );
      const pick = fish[Math.floor(Math.random() * fish.length)];
      message("A Pokémon took the bait!", () =>
        startBattle(pick.species, pick.minLevel, undefined, true),
      );
      return;
    }
    // A stray confirm while walking should leave movement uninterrupted.
    return;
  }
  if (o.id === "reedhaven_house_host") {
    sound.overworld("interact");
    mode = "menu";
    openNursery(layer, { save, engine, sprite, onSave: persist, onClose: close });
    return;
  }
  if (o.kind === "pc") {
    sound.overworld("bootPc");
    mode = "menu";
    mountStoragePc(layer, {
      save, state: pcState, engine, sprite, itemName,
      saveTransfer: async roster => {
        mode = "saving";
        try {
          await writeJourney({ ...save, ...roster });
          Object.assign(save, roster);
          sound.overworld("pcTransfer");
        } finally {
          mode = "menu";
        }
      },
      onClose: () => { sound.overworld("shutDownPc"); close(); },
    });
    return;
  }
  sound.overworld("interact");
  actors.face(o, save.x, save.y);
  if (o.request && !save.flags.includes("request_" + o.request)) {
    flag("request_" + o.request);
    persist();
  }
  // Finished errands remain finished even after a party or held item changes.
  const completed = pitchFlag(o.id) ?? o.setsFlag;
  if (completed && save.flags.includes(completed) && !o.repeatable) {
    const practice =
      map.kind === "route" &&
      o.kind === "trainer" &&
      !o.id.startsWith("rival_");
    if (
      practice ||
      (save.flags.includes("champion") &&
        (o.kind === "leader" || o.id.startsWith("league_")))
    ) {
      offerRematch(o, practice);
      return;
    }
    const cover = save.flags.find(f => f.startsWith("atlas_cover_"))?.slice(12).replaceAll("_", " ");
    if (o.quest === "atlas" && cover) {
      message("The first spread shows the " + cover + ". Your certificate bears the signatures of all three nursery teams.", undefined, o.name);
      return;
    }
    message(
      o.kind === "starter"
          ? "Your partner looks happy! Take Dewpath east to Mossford."
          : o.victoryDialogue ||
            (o.kind === "switch"
              ? "It’s already in place."
              : o.trainer
                ? "Good match! I’ll be cheering for you on the beacon trail."
                : o.dialogue),
      undefined,
      o.name,
    );
    return;
  }
  if (!has(o.requires)) {
    message(
      o.quest ? requestHint(o.quest, save.flags, save.caught, id => engine.species(id).types) : o.lockedDialogue || "There is more to do before this opens.",
      undefined,
      o.name,
    );
    return;
  }
  const field = o.field;
  if (field?.afloat && map.tiles[Math.floor(save.y)]?.[Math.floor(save.x)] !== "~") {
    message("Lapras waits offshore. Surf into the shallows beside it and call from the water.", undefined, o.name);
    return;
  }
  if (field?.camp) {
    save.settings.night = !save.settings.night;
    renderer.setNight(save.settings.night);
    persist();
    message(save.settings.night ? "Moonrise. The pool watch has begun." : "Daybreak. Insects stir in the meadow.", undefined, o.name);
    return;
  }
  if (field?.light && (field.light === "night") !== Boolean(save.settings.night)) {
    message("This watch begins at " + (field.light === "night" ? "moonrise" : "daybreak") + ". Rest at the nearby field tent to change watch.", undefined, o.name);
    return;
  }
  if (field?.approach) {
    const dx = o.x - Math.floor(save.x), dy = o.y - Math.floor(save.y);
    if (!(field.approach === "west" ? dx === 1 && dy === 0 && save.facing === "right" : dx === 0 && dy === -1 && save.facing === "up")) {
      message(field.approachHint!, undefined, o.name);
      return;
    }
  }
  if (o.id === "frost_plug" && !save.flags.includes("frost_push_2")) {
    flag(save.flags.includes("frost_push_1") ? "frost_push_2" : "frost_push_1");
    sound.overworld("strength");
    persist();
    message("The blue plug slides one notch east. Follow it along the groove.", undefined, o.name);
    return;
  }
  if (o.wildlife) {
    if (!save.seen.includes(o.wildlife)) save.seen.push(o.wildlife);
    cry(o.wildlife);
    finishErrand(o);
    return;
  }
  if (field?.device) {
    if (!hasRewardSpace(o.reward)) return;
    mode = "menu";
    openFieldwork(layer, o.name, field.device, choice => {
      const reward = field.device === "promise" ? { ...o.reward, item: choice } : o.reward;
      finishErrand(o, reward, field.device === "atlas" ? "atlas_cover_" + choice : undefined);
    }, close, pitch => sound.bell(pitch));
    return;
  }
  if (o.kind === "starter" && !save.flags.includes("partner")) {
    starter();
    return;
  }
  if (o.kind === "healer") {
    if (!save.party.length) {
      message(
        "Alder has a Pokémon for you at the lab. Bring your partner here whenever it needs a rest.",
        undefined,
        o.name,
      );
      return;
    }
    sound.heal();
    save.center = save.map;
    save.party = save.party.map((m) => engine.healPokemon(m));
    persist();
    message("Your Pokémon are all healed up!", undefined, o.name);
    return;
  }
  if (o.kind === "shop") {
    shop();
    return;
  }
  if (isWildEncounter(o) && !save.flags.includes(o.setsFlag || o.id)) {
    const target = o.trainer?.team[0];
    if (target) {
      message(o.dialogue, () => startBattle(target.species, target.level, o));
      return;
    }
  }
  if (o.trainer && !save.flags.includes(o.setsFlag || o.id)) {
    if (!save.party.some((m) => m.hp > 0)) {
      message(
        save.party.length
          ? "Your team needs a Pokémon Center before it can battle."
          : "Visit Professor Alder and choose a partner first.",
      );
      return;
    }
    if (o.id === "league_0") {
      mode = "menu";
      interactionMusic = trainerIntroMusic(o);
      sound.refreshMusic();
      const p = panel(
        layer,
        "Enter the Astral League?",
        `<p>We’ll heal your team before Rowan. The League’s Pokémon range from Lv 55 to 62. Bring medicine for all five battles. Leaving starts the challenge over.</p><div class="buttons"><button id="enter">Face Rowan</button><button class="secondary" id="back">Prepare first</button></div>`,
      );
      p.querySelector("#back")!.addEventListener("click", close);
      p.querySelector("#enter")!.addEventListener("click", () => {
        save.party = save.party.map((m) => engine.healPokemon(m));
        startBattle(o.trainer!.team[0].species, o.trainer!.team[0].level, o);
      });
      return;
    }
    message(
      o.dialogue,
      () =>
        startBattle(o.trainer!.team[0].species, o.trainer!.team[0].level, o),
      o.name,
      trainerIntroMusic(o),
    );
    return;
  }
  if (o.id === "quest_fossil") {
    mode = "menu";
    const p = panel(
      layer,
      "Revive a fossil",
      `<p>The excavator can revive one of two fossils for you.</p><div class="buttons">${fossilChoices.map(({ species, fossil }) =>
        `<button data-fossil="${species}">${fossil} · ${escapeHtml(engine.species(species).name)}</button>`
      ).join("")}<button class="secondary" id="back">Decide later</button></div>`,
    );
    p.querySelector("#back")!.addEventListener("click", close);
    p.querySelectorAll<HTMLButtonElement>("[data-fossil]").forEach(
      (b) =>
        (b.onclick = () =>
          finishErrand(o, { ...o.reward, species: Number(b.dataset.fossil) }, "fossil_" + b.dataset.fossil)),
    );
    return;
  }
  finishErrand(o, o.reward);
}
function finishErrand(o: WorldObject, reward?: Reward, choiceFlag?: string) {
  if (!hasRewardSpace(reward)) return;
  const receipt = rewardReceipt(reward);
  applyReward(reward);
  flag(o.setsFlag);
  flag(choiceFlag);
  flag(pitchFlag(o.id));
  updateChart(save.flags, save.map);
  persist();
  message(o.dialogue, receipt ? () => showReceipt(receipt) : undefined, o.name);
}
function showReceipt(receipt: string, next?: () => void, music?: MusicScene) {
  sound.overworld("item");
  message(receipt, next, "Received", music);
}
function offerRematch(o: WorldObject, practice: boolean) {
  const trainer = o.trainer!;
  const prize = practice
    ? Math.floor((trainer.reward || 0) / 2)
    : trainer.reward || 0;
  const team = practice
    ? fieldTeam(o, save)
    : trainer.team.map((m) => ({
        ...m,
        level: Math.min(
          80,
          Math.max(
            60,
            o.trainer!.team.at(-1)!.level + 5,
            ...save.party.map((p) => p.level),
          ) +
            m.level -
            o.trainer!.team.at(-1)!.level,
        ),
      }));
  mode = "menu";
  interactionMusic = trainerIntroMusic(o);
  sound.refreshMusic();
  const p = panel(
    layer,
    practice ? o.name : `${o.name}’s rematch`,
    `<p>${practice ? "Want another practice battle?" : "Ready for another match, Champion?"} My team is Lv ${team[0].level}${team[0].level === team.at(-1)!.level ? "" : "–" + team.at(-1)!.level}. The prize is ₽${prize}.</p><div class="buttons"><button id="fight">Battle</button><button class="secondary" id="back">Later</button></div>`,
  );
  p.querySelector("#fight")!.addEventListener("click", () =>
    startBattle(team[0].species, team[0].level, {
      ...o,
      id: "rematch_" + o.id,
      setsFlag: practice ? o.setsFlag : "rematch_" + o.id,
      reward: undefined,
      victoryDialogue: practice
        ? "Good match! Come back any time."
        : "You keep finding new ways to surprise me, Champion.",
      trainer: { ...trainer, team, reward: prize },
    }),
  );
  p.querySelector("#back")!.addEventListener("click", close);
}
function shop() {
  mode = "menu";
  mountMart(layer, { save, name: itemName, onClose: close, onPurchase: () => {
    persist();
    sound.overworld("purchase");
  } });
}
function close() {
  mode = "world";
  interactionMusic = undefined;
  layer.innerHTML = "";
  persist();
  sound.refreshMusic();
}
function duringLeagueChallenge() {
  return (
    save.map.startsWith("league") &&
    save.flags.includes("league_0_won") &&
    !save.flags.includes("champion")
  );
}
function depart(destination: string, move: () => void) {
  if (!duringLeagueChallenge() || destination.startsWith("league")) {
    move();
    return;
  }
  mode = "menu";
  const p = panel(
    layer,
    "Leave the League?",
    '<p>Your party, experience and prizes stay with you. Your next League challenge will begin with Rowan.</p><div class="buttons"><button id="back">Stay here</button><button class="secondary" id="leave">Leave challenge</button></div>',
  );
  p.querySelector("#back")!.addEventListener("click", close);
  p.querySelector("#leave")!.addEventListener("click", () => {
    save.flags = save.flags.filter((f) => !/^league_[0-3]_won$/.test(f));
    mode = "world";
    layer.innerHTML = "";
    move();
  });
}
let journeySelection = "party";
let fieldBagState: BagState = {};
let pcState: PcState = {};
let fieldDexState: DexState = {};
let fieldJournalState: JournalState = {};
let fieldCursors: Record<string, PanelCursor> = {};
function menu() {
  mode = "menu";
  const options = [
    ["party", "Pokémon"],
    ["bag", "Bag"],
    ["dex", "Pokédex"],
    ["map", "Map"],
    ["journal", "Journal"],
    ["settings", "Options"],
    ["close", "Exit"],
  ].filter(
    ([key]) =>
      save.flags.includes("partner") ||
      ["map", "settings", "close"].includes(key) ||
      (key === "bag" && Object.values(save.items).some((n) => n > 0)),
  );
  if (!options.some(([key]) => key === journeySelection))
    journeySelection = options[0][0];
  const p = panel(
    layer,
    "Menu",
    `<nav class="journey-list" aria-label="Journey menu">${options
      .map(([key, label]) => `<button data-view="${key}">${label}</button>`)
      .join("")}</nav>`,
    "journey-menu",
  );
  p
    .querySelector<HTMLButtonElement>(`[data-view="${journeySelection}"]`)
    ?.focus({ preventScroll: true });
  for (const button of p.querySelectorAll<HTMLButtonElement>("[data-view]")) {
    const v = button.dataset.view!;
    button.onfocus = () => { journeySelection = v; };
    button.onclick = () => {
      journeySelection = v;
      if (v === "close") close();
      else view(v);
    };
  }
}
function view(v: string, pageIndex = 0) {
  mode = "menu";
  let title = "",
    body = "";
  if (v === "party") {
    showFieldParty(pageIndex);
    return;
  } else if (v === "bag") {
    layer.replaceChildren();
    mountBag(layer, {
      items: Object.entries({ ...save.items, nursery_egg: save.egg ? 1 : 0 })
        .filter(([, count]) => count > 0)
        .map(([key, count]) => ({
          key,
          count,
          name: itemName(key),
          ...(ballIds[key]
            ? { unavailable: "Can only be thrown in a wild battle." }
            : {}),
        })),
      state: fieldBagState,
      onUse: (item) => useItem(item.key),
      onCancel: menu,
    });
    return;
  } else if (v === "dex") {
    mountPokedex(layer, {
      save, state: fieldDexState, species: id => engine.species(id), entry: id => engine.dexEntry(id), sprite, cry, onCancel: menu,
    });
    return;
  } else if (v === "journal") {
    mountJournal(layer, {
      save, state: fieldJournalState, permitted: has,
      typesOf: id => engine.species(id).types,
      partner: mon => ({ name: engine.species(mon.species).name, sprite: sprite(mon) }),
      onSurvey: id => { save.survey = id; persist(); },
      onCancel: menu,
    });
    return;
  } else if (v === "map") {
    title = "Astra region";
    body = `<header class="atlas-header"><h2>Astra region</h2><div><button data-zoom aria-pressed="false">Zoom +</button><button id="local-map">Local map</button><button id="back">Back</button></div></header>
      <div class="atlas-paper"><canvas class="region-chart" role="img"></canvas></div>
      <div class="atlas-key"><span><i class="pin-player"></i>You</span><span><i class="pin-goal">✦</i>Journal</span><span><i class="pin-town"></i>Town</span><span><i class="pin-site"></i>Site</span></div>
      <div class="atlas-readout"><button data-map-step="-1" aria-label="Previous place">◀</button><div aria-live="polite"><strong data-place></strong><small data-links></small></div><button data-map-step="1" aria-label="Next place">▶</button></div>
      <button class="atlas-fly" data-travel="" hidden>Fly here</button>`;
  } else if (v === "local-map") {
    mountFieldMap(layer, currentField(), save, directions(save, has), has,
      () => view("map"), () => view("fly"));
    return;
  } else if (v === "fly") {
    title = "Fly to a town";
    const goal = directions(save, has);
    const towns = save.visited.filter(id => WORLD[id].kind === "town" && id !== save.map);
    const destinations = goal.fly ? [goal.fly, ...towns.filter(id => id !== goal.fly)] : towns;
    body = `<div class="list">${destinations.map(id =>
      `<button data-travel="${id}">${escapeHtml(WORLD[id].name)}${id === goal.fly ? " · Journal" : ""}</button>`
    ).join("")}</div>`;
  } else {
    title = "Settings & save";
    body = `<div class="save-retry" hidden><p class="error" role="alert"></p><button id="retry-save"></button></div>
      <div class="preference-grid">
        <button id="speed" aria-label="Change battle speed, currently ${save.settings.battleSpeed}×">Battle speed<strong>${save.settings.battleSpeed}×</strong></button>
        <button id="time" aria-label="Camp until ${save.settings.night ? "day" : "night"}">Camp<strong>${save.settings.night ? "Night" : "Day"}</strong></button>
        <button id="music" aria-pressed="${sound.enabled}">Sound<strong>${sound.enabled ? "On" : "Off"}</strong></button>
        <button id="gamepad-layout" aria-pressed="${!!save.settings.swapGamepadAB}" aria-label="Swap controller A and B">Controller A/B<strong>${save.settings.swapGamepadAB ? "Swapped" : "Standard"}</strong></button>
      </div>
      <div class="save-tools"><p>Your journey saves in this browser.</p><div class="buttons"><button id="export">Export save</button><button data-backup-picker id="choose-save">Import save</button><input hidden id="import" type="file" accept="application/json,.json"></div></div>
      <div class="settings-footer"><button class="secondary" id="how">How to play</button><button class="secondary" id="back">Back</button></div>`;
  }
  const p = panel(
    layer,
    title,
    v === "map" || v === "settings" ? body : `${body}<div class="buttons"><button class="secondary" id="back">Back</button></div>`,
    v === "map" ? "atlas-screen" : v === "settings" ? "settings-screen" : "", fieldCursors[v] ??= {},
  );
  if (v === "map") {
    const objective = campaignObjective(save);
    const marker = objective && regionPosition(objective.map.id, objective.object.x + 0.5, objective.object.y + 0.5);
    mountRegionChart(p, save, marker?.point);
    p.querySelector("#local-map")!.addEventListener("click", () => view("local-map"));
  }
  p.querySelector("#back")!.addEventListener("click", v === "fly" ? () => view("local-map") : menu);
  p.querySelectorAll<HTMLButtonElement>("[data-travel]").forEach(
    (b) =>
      (b.onclick = () =>
        depart(b.dataset.travel!, () => {
          sound.overworld("fly");
          save.map = b.dataset.travel!;
          const door = WORLD[save.map].exits.find((e) =>
            e.to.endsWith("_center"),
          )!;
          save.x = door.x + 0.5;
          save.y = door.y + 1.5;
          save.facing = "down";
          save = normalizeSavePosition(save);
          exitLock = true;
          close();
        })),
  );
  p
    .querySelector("#how")
    ?.addEventListener("click", () => fieldBasics(() => view("settings")));
  p.querySelector("#speed")?.addEventListener("click", () => {
    save.settings.battleSpeed = (save.settings.battleSpeed % 3) + 1;
    persist();
    view(v);
  });
  p.querySelector("#gamepad-layout")?.addEventListener("click", () => {
    save.settings.swapGamepadAB = !save.settings.swapGamepadAB;
    input.setGamepadLayout(save.settings.swapGamepadAB);
    persist();
    view(v);
  });
  p.querySelector("#time")?.addEventListener("click", () => {
    save.settings.night = !save.settings.night;
    renderer.setNight(!!save.settings.night);
    persist();
    view(v);
  });
  p.querySelector("#music")?.addEventListener("click", () => {
    toggleMusic();
    view(v);
  });
  p
    .querySelector("#export")
    ?.addEventListener("click", () =>
      download("pokemon-astra-save.json", save),
    );
  if (v === "settings") {
    offlineSetup?.bindOptions(p);
    mountSaveRetry(p);
    bindBackupPicker(p, () => message("Save imported successfully."), error => message(error, () => view("settings")), () => view("settings"));
  }
}
function mountSaveRetry(p: HTMLElement) {
  const retry = p.querySelector<HTMLButtonElement>("#retry-save")!;
  showSaveIssue(saveIssue);
  retry.onclick = async () => {
    if (saveIssue === "conflict") {
      const choice = panel(layer, "Open the browser save?",
        '<p>Reloading opens the newer journey. Export your current progress to keep a copy of this session.</p><div class="buttons"><button id="back">Stay here</button><button id="export">Export this session</button><button class="secondary" id="reload">Reload journey</button></div>');
      choice.querySelector<HTMLButtonElement>("#back")!.onclick = () => view("settings");
      choice.querySelector<HTMLButtonElement>("#export")!.onclick = () => download("pokemon-astra-save.json", save);
      choice.querySelector<HTMLButtonElement>("#reload")!.onclick = () => location.reload();
      return;
    }
    retry.disabled = true;
    try {
      await writeJourney(save);
      p.querySelector<HTMLButtonElement>("#export")?.focus();
    } catch (error) {
      if (!(error instanceof JourneyConflict))
        p.querySelector(".save-retry p")!.textContent = "Save failed again. Free up browser storage or export your current progress.";
    } finally {
      retry.disabled = false;
    }
  };
}
function fieldPartyRows() {
  return save.party.map(mon => ({
    name: mon.nickname || engine.species(mon.species).name,
    sprite: sprite(mon), level: mon.level, status: mon.status,
    hp: mon.hp, maxHp: mon.stats[0],
  }));
}
function showFieldParty(initialSlot: number) {
  layer.replaceChildren();
  mountParty(layer, {
    title: "Your party", initialSlot, confirm: "Summary",
    rows: fieldPartyRows().map((row, slot) => ({ ...row, note: slot === 0 ? "Lead" : undefined })),
    onSelect: partyDetails, onBack: menu,
  });
}
function partyDetails(index: number) {
  const mon = save.party[index];
  mode = "menu";
  mountPartnerSummary(layer, mon, {
    engine, image: sprite(mon), itemName,
    onBack: () => view("party", index),
    onLead: index > 0 && mon.hp > 0 ? () => {
      [save.party[0], save.party[index]] = [mon, save.party[0]];
      persist();
      view("party");
    } : undefined,
    onItem: () => {
      if (mon.item) {
        const key = bagKeyForItem(mon.item);
        if ((save.items[key] || 0) >= 99)
          return message("Your Bag already holds 99 of those.", () => partyDetails(index));
        mon.item = 0;
        save.items[key] = (save.items[key] || 0) + 1;
        persist();
        return partyDetails(index);
      }
      const items = Object.entries(save.items).filter(([key, count]) => count > 0 && nativeItemId(key));
      if (!items.length) return message("Your Bag has no items a Pokémon can hold.", () => partyDetails(index));
      layer.replaceChildren();
      mountBag(layer, {
        state: {}, pockets: ["items"],
        items: items.map(([key, count]) => ({ key, count, name: itemName(key), pocket: "items", action: "Give" })),
        onCancel: () => partyDetails(index),
        onUse: item => {
          mon.item = nativeItemId(item.key)!;
          save.items[item.key]--;
          persist();
          partyDetails(index);
        },
      });
    },
  });
}
function rivalSpecies(o: WorldObject, slot: number, original: number) {
  if (!o.id.startsWith("rival_") || slot !== o.trainer!.team.length - 1)
    return original;
  // Older journeys store the original starter as the first species caught.
  const partner =
    starterSpecies.find((id) => save.flags.includes("starter_" + id)) ??
    save.caught[0];
  const families: Record<number, number[]> = {
    58: [60, 61, 62, 62],
    60: [69, 70, 71, 71],
    69: [58, 58, 59, 59],
  };
  return families[partner]?.[Number(o.id.slice(6)) - 1] ?? original;
}
function applyRepel() {
  save.items.repel--;
  save.repel = 100;
}
function repelExpired() {
  repelWoreOff = false;
  persist();
  if (!save.items.repel) {
    message("The Repel wore off. Pokémon can appear in tall grass again.");
    return;
  }
  mode = "menu";
  const p = panel(layer, "Repel wore off",
    `<p>You have ${save.items.repel} left in your Bag.</p><div class="buttons"><button id="renew-repel">Use another Repel</button><button class="secondary" id="back">Keep walking</button></div>`);
  p.querySelector<HTMLButtonElement>("#renew-repel")!.onclick = () => {
    applyRepel();
    close();
  };
  p.querySelector<HTMLButtonElement>("#back")!.onclick = close;
}
function useItem(item: string, initialSlot?: number) {
  if (item === "nursery_egg" && save.egg) {
    const left = Math.max(0, Math.ceil(save.egg.hatchAt - save.steps));
    message(left <= 24 ? "The Egg rocks in its sling. It’s almost ready!" :
      `The shell feels warm. About ${left} walking tiles until it hatches.`, () => view("bag"), "Nursery Egg");
    return;
  }
  if ((save.items[item] || 0) < 1) return;
  if (item === "courier_parcel") {
    message(itemInfo(item).description!, () => view("bag"));
    return;
  }
  if (item in ballIds || item === "aurora_certificate") {
    message(
      item === "aurora_certificate"
        ? "Professor Alder awarded this certificate for recording every species in Astra."
        : "Open the Bag during a wild battle to throw a " +
            itemName(item) +
            ".",
      () => view("bag"),
    );
    return;
  }
  if (item === "rare_lure") {
    if (save.flags.includes("lure_ready")) {
      message(
        "Your lure is already set. Walk through tall grass to attract a Pokémon.",
        () => view("bag"),
      );
      return;
    }
    save.items[item]--;
    flag("lure_ready");
    persist();
    message(
      "The lure will attract one of this habitat's rarer Pokémon on your next grass encounter.",
      () => view("bag"),
    );
    return;
  }
  if (item === "repel") {
    if (save.repel) {
      message(`Your Repel will last another ${Math.ceil(save.repel)} walking tiles.`, () => view("bag"));
      return;
    }
    applyRepel();
    persist();
    message("Repel will keep wild Pokémon away for 100 walking tiles.", () =>
      view("bag"),
    );
    return;
  }
  function finishMedicine(index: number, healed: Pokemon, note: string) {
    save.party[index] = healed;
    save.items[item]--;
    persist();
    sound.overworld(item === "ether" || item === "max_elixer" ? "restorePp" : "potion");
    message(note, () => view("bag"));
  }
  const held = giveFromBag(item) ? nativeItemId(item) : undefined;
  const targets = save.party.map((mon) => {
    const healed = item !== "ether" && isMedicine(item)
      ? useMedicine(item, mon, engine)
      : undefined;
    const evo =
      !held && !isMedicine(item) && item !== "friendship_charm"
        ? engine
            .evolutionData(mon.species)
            .evolutions.find(
              (e) =>
                (e.method === 2 && e.parameter === stoneIds[item]) ||
                (e.method === 3 && mon.item !== 112 &&
                  item === "link_cable" &&
                  (e.parameter === 255 || e.parameter === mon.item)),
            )
        : undefined;
    const eligible = item === "ether"
      ? engine.healPokemon(mon).pp.some((pp, i) => mon.moves[i] && (mon.pp[i] & 63) < (pp & 63))
      : isMedicine(item) ? !!healed
      : held
        ? !mon.item
        : item === "friendship_charm"
          ? mon.happiness < 255
          : !!evo;
    return { healed, evo, eligible };
  });
  mode = "menu";
  layer.replaceChildren();
  mountParty(layer, {
    title: itemName(item), initialSlot,
    rows: fieldPartyRows().map((row, i) => ({
      ...row, disabled: !targets[i].eligible,
      note: targets[i].eligible ? undefined : held ? "Holding item" : "No effect",
    })),
    confirm: held ? "Give item" : "Use item", onBack: () => view("bag"),
    onSelect: index => {
      const mon = save.party[index];
      const { healed, evo, eligible } = targets[index];
      if (!eligible) return;
      if (item === "friendship_charm") {
        mon.happiness = Math.min(255, mon.happiness + 80);
        save.items[item]--;
        persist();
        message(
          `${engine.species(mon.species).name} feels much closer to you.`,
          () => view("bag"),
        );
        return;
      }
      if (held) {
        mon.item = held;
        save.items[item]--;
        persist();
        message(
          `${engine.species(mon.species).name} is holding ${itemName(item)}.`,
          () => view("bag"),
        );
        return;
      }
      const name = mon.nickname || engine.species(mon.species).name;
      if (item === "ether") {
        const full = engine.healPokemon(mon).pp;
        const choices = mon.moves.map((id, slot) => {
          if (!id) return "";
          const move = engine.move(id), current = mon.pp[slot] & 63, max = full[slot] & 63;
          return `<button data-move-slot="${slot}" ${current >= max ? "disabled" : ""}><strong>${escapeHtml(move.name)}</strong><span>PP ${current}/${max}</span></button>`;
        }).join("");
        const p = panel(layer, "Use Ether", `<p>Choose a move for ${escapeHtml(name)}.</p><p class="lesson-new">Restores up to 10 PP.</p><div class="lesson-choices">${choices}</div><button id="back" class="secondary">Back</button>`, "lesson-panel lesson-choice");
        p.querySelector<HTMLButtonElement>("#back")!.onclick = () => useItem(item, index);
        for (const b of p.querySelectorAll<HTMLButtonElement>("[data-move-slot]:enabled")) b.onclick = () => {
          const slot = Number(b.dataset.moveSlot);
          const next = useMedicine(item, mon, engine, slot);
          if (next) finishMedicine(index, next, `${name} recovered ${(next.pp[slot] & 63) - (mon.pp[slot] & 63)} PP for ${engine.move(mon.moves[slot]).name}.`);
        };
        p.querySelector<HTMLButtonElement>("[data-move-slot]:enabled")?.focus({ preventScroll: true });
        return;
      }
      if (healed) {
        const note = item === "max_elixer" ? `${name}’s move PP was restored.`
          : battleStatus(mon.status) && !healed.status && healed.hp === mon.hp ? `${name} is no longer ${battleStatus(mon.status)![1].toLowerCase()}.`
          : `${name} recovered with the ${itemName(item)}. HP ${healed.hp}/${healed.stats[0]}.`;
        finishMedicine(index, healed, note);
        return;
      }
      if (!evo) return;
      evolvePartyMember(index, evo.species, () => view("bag"), () => {
        if (evo.method === 3 && evo.parameter !== 255) save.party[index].item = 0;
        save.items[item]--;
      });
    },
  });
}
function startBattle(species: number, level: number, o?: WorldObject, fishing = false) {
  try {
    battleObject = o;
    battleMusic = undefined;
    interactionMusic = undefined;
    battleSpecies = species;
    const opponent =
      o?.trainer && !isWildEncounter(o)
        ? {
            prizeMoney: o.trainer.reward ?? 0,
            party: (o.id.startsWith("rematch_") ? o.trainer.team : fieldTeam(o, save)).map((m, i) =>
              engine.makePokemon(rivalSpecies(o, i, m.species), m.level),
            ),
          }
        : { species, level, stationary: o?.kind === "legendary" };
    battleLaunch = new BattleLaunch({ engine, layer, sound, sprite, cry }, {
      start: {
      party: save.party,
      opponent,
      balls: Object.entries(ballIds).map(
        ([key, id]) => [id, save.items[key] || 0] as [number, number],
      ),
      items: Object.entries(MEDICINE).map(([key, m]) => [
        m.id,
        save.items[key] || 0,
      ]),
      money: save.money,
      badges: badgeMask(save),
      night: !!save.settings.night,
      seen: save.seen,
      caught: save.caught,
      },
      trainerName:
        o?.trainer && !isWildEncounter(o)
          ? o.trainer.name || o.name
          : undefined,
      gymBackdrop: gymBattleBackdrop(currentField()),
      fieldBackdrop: renderer.battleBackdrop(currentField(), save.x, save.y, fishing),
      arena: o?.id.endsWith("league_4")
        ? "champion"
        : o?.id.includes("league_")
          ? "league"
          : undefined,
      wildEncounter: o?.kind === "legendary" ? "legendary" : undefined,
      speed: save.settings.battleSpeed,
      itemName: (id) => itemName(bagKeyForItem(id)),
      party: () => save.party,
      music: (cue) => {
        battleMusic = cue === "Capture" ? "capture" : victoryTheme(battleObject);
        sound.refreshMusic();
      },
      shown: () => {
        mode = "battle";
      },
    });
    mode = "encounter";
    sound.refreshMusic();
    battleLaunch.finished.then(battleFinished, (e) => {
      battleLaunch = undefined;
      message(`Battle error: ${e instanceof Error ? e.message : String(e)}`);
    });
  } catch (e) {
    message(
      `Battle could not start: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}
function battleFinished(battle: FinishedBattle) {
  battleLaunch = undefined;
  const result = battle.result;
  const { mon: caughtMon, first: firstCatch, grant } = captureRegistration(save.caught, result);
  const caughtSpecies = caughtMon?.species;
  const catchDestination = (result.caught ?? -1) >= 6 ? "storage" : "party";
  save.party = battle.party;
  for (const mon of battle.overflow) storePokemon(save.storage, mon);
  save.money = result.money + grant;
  for (const [key, id] of Object.entries(ballIds))
    save.items[key] =
      result.bag.balls.find((v: [number, number]) => v[0] === id)?.[1] || 0;
  for (const [key, m] of Object.entries(MEDICINE))
    save.items[key] =
      result.bag.items.find((v: [number, number]) => v[0] === m.id)?.[1] || 0;
  save.seen = result.world.seen;
  save.caught = result.world.caught;
  if (caughtSpecies && !save.caught.includes(caughtSpecies))
    save.caught.push(caughtSpecies);
  const won = battle.end === "win";
  const earnedBadge = won && !!battleObject?.reward?.badge && !(badgeMask(save) & (1 << (battleObject.reward.badge - 1)));
  let receipt = "";
  if (
    battleObject &&
    ((isWildEncounter(battleObject) && caughtSpecies === battleSpecies) ||
      (!isWildEncounter(battleObject) && won))
  ) {
    flag(battleObject.setsFlag || battleObject.id);
    receipt = rewardReceipt(battleObject.reward);
    applyReward(battleObject.reward);
  }
  const blackout = battle.end === "loss";
  if (blackout) {
    save.party = save.party.map((m) => engine.healPokemon(m));
    if (
      battleObject?.id.startsWith("league_") &&
      !save.flags.includes("champion")
    )
      save.flags = save.flags.filter((f) => !/^league_[0-3]_won$/.test(f));
    save.map =
      save.center && WORLD[save.center] ? save.center : "dewdrop_center";
    recordVisit(save);
    const door = WORLD[save.map].exits[0];
    save.x = door.x + 0.5;
    save.y = door.y - 0.5;
    save.facing = "up";
    save = normalizeSavePosition(save);
    exitLock = true;
  }
  if (won && battleObject?.id === "league_4")
    save.hallOfFame = save.party.map(({ species, level, dvs }) => ({ species, level, dvs: [...dvs] }));
  const candidates = result.may_evolve.filter(slot => save.party[slot] && levelEvolution(save.party[slot], !!save.settings.night, engine));
  if (candidates.length) save.pendingEvolutions = [...new Set(candidates)];
  persist();
  const victory = won ? battleObject?.victoryDialogue : undefined;
  const wrapUp = () => {
    if (won && battleObject?.id === "league_4")
      hallOfFame(() => finishTraining(close));
    else finishTraining(close);
  };
  if (won) {
    const afterVictory = receipt ? () => showReceipt(receipt, wrapUp, battleMusic) : wrapUp;
    if (earnedBadge && battleObject?.reward?.badge && victory) {
      mode = "dialogue";
      interactionMusic = battleMusic;
      dialogueCallback = afterVictory;
      sound.refreshMusic();
      sound.overworld("badge");
      showBadgeAward(layer, battleObject.reward.badge, badgeMask(save), battleObject.name, victory, advance);
    } else if (victory) message(victory, afterVictory, battleObject?.name, battleMusic);
    else afterVictory();
    return;
  }
  if (battle.end === "escaped") {
    wrapUp();
    return;
  }
  const afterCatch = receipt ? () => showReceipt(receipt, wrapUp, battleMusic) : wrapUp;
  if (firstCatch && caughtMon) {
    mode = "registration";
    specimenCard(layer, "New Pokédex entry", specimen(caughtMon),
      `${catchDestination === "storage" ? "Sent to PC" : "Joined party"} · ${save.caught.length}/251 caught`,
      "Continue", afterCatch, { grant });
    return;
  }
  if (blackout) sound.heal();
  message(
    caughtSpecies
      ? `${engine.species(caughtSpecies).name} ${catchDestination === "storage" ? "was sent to the Center PC" : "joined your party"}!`
      : blackout
        ? `Your team was exhausted. You returned to ${WORLD[save.map].name}, where your Pokémon were healed.`
        : "The battle ended in a draw.",
    afterCatch,
    undefined,
    battleMusic,
  );
}
function hallOfFame(done: () => void) {
  mode = "ceremony";
  sound.refreshMusic();
  const p = panel(
    layer,
    "Hall of Fame",
    `<p>The team that brought the dawn back to Astra.</p><div class="hall-party">${(save.hallOfFame || save.party).map((m) => `<div><img alt="" src="${sprite(m)}"><span>${escapeHtml(engine.species(m.species).name)}<br>Lv ${m.level}</span></div>`).join("")}</div><p class="small">The Aurora Trail is open west of Dewdrop Village.</p><button id="continue">Continue exploring</button>`,
    "champion-record",
  );
  p.querySelector("#continue")!.addEventListener("click", done);
}
function evolvePartyMember(index: number, species: number, next: () => void, consume?: () => void) {
  const current = save.party[index];
  const evolved = engine.evolvePokemon(current, species);
  const name = current.nickname || engine.species(current.species).name;
  mode = "evolution";
  sound.refreshMusic();
  if (current.hp > 0 && (current.status & 0x27) === 0) cry(current.species);

  void playEvolution(layer, {
    from: sprite(current),
    to: sprite({ species, dvs: current.dvs }),
    name,
    evolvedName: engine.species(species).name,
    reveal: () => {
      save.party[index] = evolved;
      consume?.();
      queueEvolutionMoves(save, index, engine);
      if (!save.seen.includes(species)) save.seen.push(species);
      if (!save.caught.includes(species)) save.caught.push(species);
      persist();
      mode = "evolution-result";
      sound.refreshMusic();
      cry(species);
    },
    ready: () => sound.overworld("evolved"),
    next: () => {
      layer.replaceChildren();
      mode = "world";
      finishTraining(next);
      sound.refreshMusic();
    },
  });
}
function finishTraining(done: () => void): void {
  const lesson = save.pendingMoves;
  if (lesson) {
    const mon = save.party[lesson.slot], move = lesson.moves[0];
    const eligible = engine.evolutionData(mon.species).learnset.some(entry => entry.level === mon.level && entry.move === move);
    if (!eligible || mon.moves.includes(move)) {
      resolveEvolutionMove(save, undefined, engine);
      persist();
      return finishTraining(done);
    }
    const learn = (slot?: number) => {
      resolveEvolutionMove(save, slot, engine);
      persist();
      if (slot === undefined) return finishTraining(done);
      sound.overworld("item");
      message(`${mon.nickname || engine.species(mon.species).name} learned ${engine.move(move).name}!`, () => finishTraining(done));
    };
    const empty = mon.moves.indexOf(0);
    if (empty !== -1) return learn(empty);
    mode = "training";
    chooseEvolutionMove(layer, mon, move, engine, learn);
    return;
  }
  const index = save.pendingEvolutions?.[0];
  if (index === undefined) return done();
  const mon = save.party[index];
  const species = levelEvolution(mon, !!save.settings.night, engine);
  const skip = () => {
    finishEvolutionChoice(save);
    persist();
    finishTraining(done);
  };
  if (!species) return skip();
  mode = "training";
  const p = panel(layer, "Evolution",
    `<p>${escapeHtml(mon.nickname || engine.species(mon.species).name)} is ready to evolve into ${escapeHtml(engine.species(species).name)}!</p>
    <div class="buttons"><button id="evolve">Evolve</button><button class="secondary" id="later">Not now</button></div>`);
  p.querySelector<HTMLButtonElement>("#evolve")!.onclick = () =>
    evolvePartyMember(index, species, done, () => finishEvolutionChoice(save));
  p.querySelector<HTMLButtonElement>("#later")!.onclick = skip;
}
function blocked(x: number, y: number) {
  const map = currentField();
  return (
    connectedBlocked(map, x, y, save.abilities.includes("surf"), isExitOpen) ||
    actors.solid(map, x, y) ||
    map.objects.some(o => o.field?.solid && !save.flags.includes(o.setsFlag!) &&
      Math.abs(o.x + 0.5 - x) < 0.68 && Math.abs(o.y + 0.5 - y) < 0.68)
  );
}
function challengeTrainer(o: WorldObject) {
  save.facing =
    actors.position(o).x < save.x - 0.5
      ? "left"
      : actors.position(o).x > save.x + 0.5
        ? "right"
        : actors.position(o).y < save.y
          ? "up"
          : "down";
  message(
    o.dialogue,
    () => startBattle(o.trainer!.team[0].species, o.trainer!.team[0].level, o),
    o.name,
    trainerIntroMusic(o),
  );
}
function update(dt: number) {
  if (mode !== "world") {
    bumpLatched = false;
    return;
  }
  if (save.pendingMoves || save.pendingEvolutions?.length) {
    finishTraining(close);
    return;
  }
  const currentMap = currentField();
  actors.update(currentMap, dt, save);
  if (glide) {
    const oldX = save.x, oldY = save.y;
    if (advanceGlide(save, glide, dt)) glide = undefined;
    if (recordTravel(save, Math.hypot(save.x - oldX, save.y - oldY))) repelWoreOff = true;
    return;
  }
  if (repelWoreOff) {
    repelExpired();
    return;
  }
  if (actors.approaching) {
    const challenger = actors.approach(currentMap, dt, save);
    if (challenger) challengeTrainer(challenger);
    if (!actors.approaching) {
      approachingTrainer = undefined;
      sound.refreshMusic();
    }
    return;
  }
  const hatch = hatchEgg(save);
  if (hatch) {
    persist();
    mode = "hatching";
    const name = engine.species(hatch.mon.species).name;
    sound.overworld("eggCrack");
    void showHatch(layer, sprite(253), sprite(hatch.mon), name,
      `${name} ${hatch.stored ? "was sent to the Center PC" : "joined your party"} at Lv 5.`,
      () => { sound.overworld("eggHatch"); cry(hatch.mon.species); }, close);
    return;
  }
  if (save.party.some((mon) => mon.hp > 0)) {
    const noticed = actors.spotTrainer(
      currentMap,
      save,
      (o) =>
        !o.id.startsWith("league_") &&
        !save.flags.includes(o.setsFlag || o.id) &&
        has(o.requires),
    );
    if (noticed) {
      approachingTrainer = noticed;
      sound.refreshMusic();
      return;
    }
  }
  const heading = heldHeading(input, save.facing as Facing);
  if (heading) save.facing = heading.facing;
  if (input.hit("a")) {
    interact();
    return;
  }
  if (input.hit("menu")) {
    menu();
    return;
  }
  if (!heading) {
    bumpLatched = false;
    return;
  }
  const onIce = (p: Position) => currentMap.tiles[Math.floor(p.y)]?.[Math.floor(p.x)] === "i";
  if (onIce(save)) {
    glide = iceLanding(currentMap, save, heading.facing, blocked);
    return;
  }
  const dist = dt * walkSpeed(input);
  const oldX = save.x,
    oldY = save.y;
  walkFreely(save, heading, dist, blocked, onIce);
  if (onIce(save)) {
    const entered = Math.floor(save.x) !== Math.floor(oldX)
      ? heading.dx > 0 ? "right" : "left" : heading.dy > 0 ? "down" : "up";
    save.facing = entered;
    glide = iceLanding(currentMap, save, entered, blocked);
  }
  const moved = Math.hypot(save.x - oldX, save.y - oldY);
  if (moved === 0) {
    if (dist > 0 && !bumpLatched) {
      sound.overworld("bump");
      bumpLatched = true;
    }
    return;
  }
  bumpLatched = false;
  repelWoreOff = recordTravel(save, moved);
  const map = currentField();
  const exit = exitAt(map, save.x, save.y);
  if (!exit) exitLock = false;
  else if (isExitOpen(exit) && (!exitLock || exit.direction)) {
    exitLock = true;
    depart(exit.to, () => {
      if (!exit.direction)
        sound.overworld(exit.entrance === "door" ? "door" : "exit");
      const arrival = crossConnection(map, exit, save.x, save.y, isExitOpen);
      save.map = exit.to;
      recordVisit(save);
      save.x = arrival.x;
      save.y = arrival.y;
      if (exit.entrance === "mat") save.facing = "down";
      else if (
        WORLD[save.map].exits.some(
          (e) => e.to === map.id && e.entrance === "mat",
        )
      )
        save.facing = "up";
      actors.enter(currentField());
      if (!exit.direction) save = normalizeSavePosition(save);
      persist();
    });
    return;
  }
  if (
    map.tiles[Math.floor(save.y)]?.[Math.floor(save.x)] === "g" &&
    save.party.length &&
    !save.repel && !repelWoreOff
  ) {
    encounterDistance += moved;
    const lured = save.flags.includes("lure_ready");
    if (encounterDistance >= (lured ? 1 : encounterTarget) && map.encounters.length) {
      encounterDistance = 0;
      encounterTarget = 8 + Math.random() * 14;
      const residents = fieldHabitats(map, save);
      const minWeight = Math.min(...residents.map((e) => e.weight));
      const pool = lured
        ? residents.filter((e) => e.weight === minWeight)
        : residents;
      if (lured) save.flags = save.flags.filter((f) => f !== "lure_ready");
      const total = pool.reduce((n, e) => n + e.weight, 0);
      let roll = Math.random() * total;
      const e = pool.find((e) => (roll -= e.weight) < 0) || pool[0];
      startBattle(
        e.species,
        e.minLevel + Math.floor(Math.random() * (e.maxLevel - e.minLevel + 1)),
      );
    }
  }
}
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.15);
  last = now;
  input.update();
  if (yellow) {
    yellow.frame(now, dt);
    canvas.parentElement!.dataset.scene = yellow.scene;
    requestAnimationFrame(frame);
    return;
  }
  const wasWorld = mode === "world";
  if (mode === "dialogue" && (input.hit("a") || input.hit("b"))) advance();
  else if (mode === "hatching" && input.hit("b")) layer.querySelector<HTMLButtonElement>("#hatch-done:enabled")?.click();
  else if (mode === "registration" && input.hit("b")) layer.querySelector<HTMLButtonElement>("#specimen-confirm")?.click();
  else if ((mode === "menu" || mode === "guide" || mode === "starter" || mode === "training") && input.hit("b")) {
    const back = layer.querySelector<HTMLButtonElement>(
      "[data-bag-cancel], #back, #later",
    );
    if (back) back.click();
    else close();
  } else if ((mode === "title" || mode === "intro") && input.hit("b")) {
    layer.querySelector<HTMLButtonElement>("#cancel, #back")?.click();
  } else if (mode === "menu" && input.hit("menu")) close();
  else if (mode === "battle" && input.hit("b")) battleLaunch?.back();
  else if (mode === "evolution-result") {
    if (input.hit("a") || input.hit("b"))
      layer.querySelector<HTMLButtonElement>(".evolution-continue")?.click();
  } else if (!["world", "loading", "saving", "dialogue", "evolution"].includes(mode)) {
    menuInput.update(layer, input, now, mode === "battle");
  }
  if (wasWorld) {
    update(dt);
    if (mode === "world" && save.steps - lastAutosave >= 10) persist();
  }
  const screen = canvas.parentElement!;
  screen.dataset.scene = ["welcome", "recovery", "title", "intro", "loading"].includes(mode)
    ? "title"
    : mode;
  if (screen.dataset.scene !== "title" && mode !== "battle") {
    const map = currentField();
    actors.enter(map);
    renderer.render(
      map,
      save.x,
      save.y,
      save.facing,
      now,
      save.flags,
      {
        nest: map.id === "reedhaven_house" ? save.nursery?.parents : undefined,
        npcs: actors.states, hideHud: mode !== "world", exitOpen: isExitOpen, resolveMap: currentField,
        confirmLabel: input.confirmLabel, canFish: mode === "world" && canFish(map),
      },
    );
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
let offlineSetup: ReturnType<typeof setupOfflinePlay> | undefined;
if ("serviceWorker" in navigator) {
  const script = new URL("./sw.js", document.baseURI);
  if (import.meta.env.PROD) {
    offlineSetup = setupOfflinePlay(navigator.serviceWorker, script, document.querySelector(".statusbar > span")!);
  } else {
    void removeDevelopmentWorker(navigator.serviceWorker, new URL("./", script).href)
      .catch(error => console.warn("Could not remove the development worker", error));
  }
}
mode = "welcome";
openCartridge(layer, ready => {
  engine = ready;
  renderer.setEngine(engine);
  void journeys();
});
