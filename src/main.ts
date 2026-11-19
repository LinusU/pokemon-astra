import { mountMart } from "./ui/mart";
import { chooseEvolutionMove } from "./ui/learn-move";
import { levelEvolution, queueEvolutionMoves, resolveEvolutionMove, finishEvolutionChoice, recordTravel } from "./game/training";
import { mountPartnerSummary } from "./ui/partner-summary";
import { bagKeyForItem, ballIds, giveFromBag, nativeItemId, stoneIds } from "./game/items";
import { hatchEgg } from "./game/nursery";
import { openNursery, showHatch } from "./ui/nursery";
import { sortCollection, storePokemon } from "./game/collection";
import { mountStoragePc, type PcState } from "./ui/storage-pc";
import { specimenCard } from "./ui/specimen";
import { typeNames } from "./game/type-names";
import { openFieldwork } from "./ui/fieldwork";
import { requestHint, updateChart } from "./world/requests";
import { gymBattleBackdrop } from "./game/gym-art";
import { iceLanding, advanceGlide } from "./game/skating";
import { expeditionState, pitchFlag } from "./world/expeditions";
import { gymState } from "./world/gyms";
import { awardBadge, badgeMask, fieldHabitats, fieldTeam } from "./game/badges";
import { fishingPool } from "./game/pokedex";
import { Input } from "./game/input";
import { Renderer } from "./game/render";
import { WorldActors, interactionTarget } from "./game/actors";
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
import { campaignObjective, directions, bearings } from "./game/journal";
import { drawFieldMap } from "./ui/field-map";
import { mountBag, itemInfo, type BagState } from "./ui/bag";
import { battleStatus, mountParty } from "./ui/party";
import { mountPokedex, type DexState } from "./ui/pokedex";
import { mountJournal, type JournalState } from "./ui/journal";
import { MenuInput } from "./ui/menu-input";
import { MEDICINE, isMedicine, useMedicine } from "./game/medicine";
import { GameAudio } from "./game/audio";
import { battleTheme, trainerIntroMusic, victoryTheme, type MusicScene } from "./game/music";
import { BattlePresenter, escapeAnnounced } from "./ui/battle";
import { playEvolution } from "./ui/evolution";
import { download, JourneyConflict, JourneyStore } from "./game/storage";
import {
  freshSave,
  isValidSave,
  normalizeSavePosition,
  restoreExpeditions,
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
import type { Engine, Pokemon } from "./engine";
import { openCartridge } from "./ui/cartridge";
import "./styles.css";
import "./ui/region-map.css";

const journeyStore = new JourneyStore();
const input = new Input(),
  { canvas, layer, saveWarning } = createShell(input),
  renderer = new Renderer(canvas),
  menuInput = new MenuInput(),
  actors = new WorldActors();
let glide: { x: number; y: number } | undefined;
let battlePresenter: BattlePresenter | undefined;
let engine: Engine,
  save = freshSave(),
  mode = "loading",
  dialogueCallback: (() => void) | undefined,
  last = performance.now(),
  encounterDistance = 0,
  exitLock = true,
  bumpLatched = false,
  battle: ReturnType<Engine["startBattle"]>,
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
function sprite(id: number, back = false) {
  const key = `${id}:${back}`;
  if (!spriteCache.has(key)) {
    try {
      const pixels = engine.sprite(id, back),
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
function currentField() {
  return expeditionState(gymState(WORLD[save.map], save.flags), save.flags);
}
function scene(): MusicScene {
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
  return map?.kind === "gym"
    ? "gym"
    : map?.id.endsWith("_center")
      ? "center"
      : map?.kind === "dungeon"
        ? "cave"
        : map?.kind === "route"
          ? "route"
          : "town";
}
const flag = (f?: string) => {
  if (f && !save.flags.includes(f)) save.flags.push(f);
};
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
  void writeJourney(save, true).catch(error => {
    if (!(error instanceof JourneyConflict)) showSaveIssue("storage");
  });
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && (mode === "world" || mode === "menu")) persist();
});
function prepareSave(data: Save) {
  const ready = normalizeSavePosition(restoreExpeditions(data));
  updateChart(ready.flags, ready.map);
  sortCollection(ready.storage);
  return ready;
}
function restoreSession(ready: Save) {
  save = ready;
  fieldBagState = {};
  pcState = {};
  fieldDexState = {};
  fieldJournalState = {};
  fieldCursors = {};
  journeySelection = "party";
  actors.reset();
  glide = undefined;
  encounterDistance = 0;
  encounterTarget = 6;
  lastAutosave = save.steps;
  exitLock = true;
  approachingTrainer = undefined;
  battleMusic = undefined;
  interactionMusic = undefined;
  renderer.setNight(!!save.settings.night);
  sound.attach(engine, save.settings.music !== false);
}
async function importJourney(file: File) {
  const previousMode = mode;
  mode = "saving";
  layer.inert = true;
  try {
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      throw Error("Choose a readable Astra JSON save.");
    }
    if (!isValidSave(data)) throw Error("Choose a valid Astra JSON save.");
    const next = prepareSave(data);
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
function bindBackupPicker(p: HTMLElement, done: () => void, failed: (reason: string) => void) {
  const input = p.querySelector<HTMLInputElement>("input[type=file]")!;
  p.querySelector<HTMLButtonElement>("[data-backup-picker]")!.onclick = () => input.click();
  input.onchange = async () => {
    if (!input.files?.[0]) return;
    try {
      await importJourney(input.files[0]);
      done();
    } catch (error) {
      input.value = "";
      if (error instanceof JourneyConflict && !journeyStarted) return startupConflict();
      failed(error instanceof Error ? error.message : "Choose a readable Astra backup.");
    }
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
  else {
    sound.attach(engine, true);
    intro();
  }
}
function recoverJourney(existing: unknown) {
  mode = "recovery";
  const p = panel(layer, "Recover your journey",
    '<p>Astra could not read this save. Export a copy, restore a backup or begin a new journey.</p><div class="buttons"><button id="export">Export current save</button><button data-backup-picker id="choose">Choose backup</button><button class="secondary" id="new">New adventure</button><input hidden type="file" accept=".json,application/json"></div>', "opening-panel");
  p.querySelector<HTMLButtonElement>("#export")!.onclick = () => download("pokemon-astra-recovery.json", existing);
  p.querySelector<HTMLButtonElement>("#new")!.onclick = () => confirmNewJourney(existing, () => recoverJourney(existing));
  bindBackupPicker(p, title, error => { p.querySelector("p")!.textContent = error; });
}
function title() {
  mode = "title";
  const goal = directions(save, has);
  const p = panel(
    layer,
    "Welcome back",
    `<p>${escapeHtml(WORLD[save.map].name)} · ${save.badges}/8 badges · ${save.caught.length} caught</p><div class="objective"><strong>${escapeHtml(goal.title)}</strong><br>${escapeHtml(goal.hint)}</div><div class="buttons"><button id="continue">Continue journey</button><button class="secondary" id="new">New adventure</button></div>`,
    "opening-panel", fieldCursors.title ??= {},
  );
  p.querySelector("#continue")!.addEventListener("click", () => {
    journeyStarted = true;
    mode = "world";
    layer.innerHTML = "";
    void sound.unlock();
  });
  p.querySelector<HTMLButtonElement>("#new")!.onclick = () => confirmNewJourney(save, title);
}
function confirmNewJourney(existing: unknown, back: () => void) {
  mode = "title";
  const p = panel(layer, "Start a new adventure?",
    '<p>Begin adventure will replace your browser save. You can export a copy first.</p><div class="buttons"><button id="cancel">Keep my save</button><button class="secondary" id="export">Export save</button><button class="secondary" id="confirm">Start over</button></div>', "opening-panel");
  p.querySelector<HTMLButtonElement>("#cancel")!.onclick = back;
  p.querySelector<HTMLButtonElement>("#export")!.onclick = () => download("pokemon-astra-save.json", existing);
  p.querySelector<HTMLButtonElement>("#confirm")!.onclick = () => intro(back);
}
function intro(back?: () => void, error = "") {
  mode = "intro";
  const p = panel(
    layer,
    "Dewdrop Village",
    `<p>The flock over Dewdrop has circled three times this morning. Robin thinks one of the beacons has gone dark.</p><p>Meet Professor Alder at the lab in the north garden to choose your partner.</p><p class="small">Face Alder and press ${input.confirmLabel} to talk.</p>${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ""}<div class="buttons"><button id="begin">Begin adventure</button><button id="how" class="secondary">How to play</button>${back ? '<button id="cancel" class="secondary">Keep my save</button>' : '<button data-backup-picker id="choose-save" class="secondary">Restore backup</button><input hidden id="import" type="file" accept=".json,application/json">'}</div>`,
    "opening-panel", fieldCursors.intro ??= {},
  );
  if (back) p.querySelector<HTMLButtonElement>("#cancel")!.onclick = back;
  else bindBackupPicker(p, title, reason => intro(back, reason));
  p.querySelector<HTMLButtonElement>("#how")!.onclick = () => fieldBasics(() => intro(back, error));
  p.querySelector<HTMLButtonElement>("#begin")!.onclick = async () => {
    const next = prepareSave(freshSave());
    next.settings.music = sound.enabled;
    mode = "loading";
    panel(layer, "Beginning your adventure", "<p>Saving in Dewdrop Village…</p>", "opening-panel");
    try {
      await writeJourney(next);
    } catch (error) {
      if (error instanceof JourneyConflict) return startupConflict();
      return intro(back, "Your adventure could not be saved. Allow browser storage or free some space, then choose Begin adventure again.");
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
  const p = panel(
    layer,
    "Field basics",
    `<div class="journal-entries"><article><strong>Find your way</strong><p>Walk with the D-pad, arrows or WASD. Face a person or object and press A or Z. Open Menu with Start or M to see your next stop on the map.</p></article><article><strong>Build your team</strong><p>Walk through tall grass to find Pokémon. Weaken a wild Pokémon, then choose Bag and throw a Poké Ball. Extra catches go to the PC in every Pokémon Center.</p></article><article><strong>Train and recover</strong><p>Pokémon that fight earn experience. A teammate holding Exp. Share can earn some too. Talk to a road trainer again for a practice battle. Walking together raises friendship. Open Party and read Growth to see how a partner evolves. A Center heals your whole party.</p></article><article><strong>Follow the beacons</strong><p>Your journal follows the survey and records blocked paths. Each badge unlocks a field ability you can use without teaching a move.</p></article></div><button class="secondary" id="back">Back</button>`,
  );
  p.querySelector("#back")!.addEventListener("click", back);
}
function specimen(id: number) {
  return { ...engine.species(id), ...engine.dexEntry(id), image: sprite(id) };
}
function starter(selected = 58) {
  mode = "starter";
  const choices = [58, 60, 69].map(id => {
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
      const data = specimen(id);
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
        }, () => starter(id));
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
  const items = [...(r.items || [])];
  if (r.item && r.item !== "starter_supplies")
    items.push({ item: r.item, amount: r.amount });
  const lines = items.map(
    (grant) => itemName(grant.item) + " × " + (grant.amount || 1),
  );
  if (r.species)
    lines.push(
      engine.species(r.species).name +
        (save.party.length >= 6 ? " went to the Center PC" : " joined your party"),
    );
  return lines.join(" · ");
}
function applyReward(r?: Reward) {
  if (!r) return;
  if (r.takeItem) delete save.items[r.takeItem];
  if (r.badge) awardBadge(save, r.badge);
  if (r.ability && !save.abilities.includes(r.ability))
    save.abilities.push(r.ability);
  if (r.money) save.money = Math.min(999999, save.money + r.money);
  if (r.items)
    for (const grant of r.items)
      save.items[grant.item] = Math.min(
        99,
        (save.items[grant.item] || 0) + (grant.amount || 1),
      );
  if (r.item && r.item !== "starter_supplies")
    save.items[r.item] = Math.min(
      99,
      (save.items[r.item] || 0) + (r.amount || 1),
    );
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
    mode = "menu";
    openFieldwork(layer, o.name, field.device, choice => {
      if (field.device === "atlas") flag("atlas_cover_" + choice);
      const reward = field.device === "promise" ? { ...o.reward, item: choice } : o.reward;
      finishErrand(o, reward);
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
      '<p>The excavator can revive one of two fossils for you.</p><div class="buttons"><button data-fossil="138">Helix · Omanyte</button><button data-fossil="140">Dome · Kabuto</button><button class="secondary" id="back">Decide later</button></div>',
    );
    p.querySelector("#back")!.addEventListener("click", close);
    p.querySelectorAll<HTMLButtonElement>("[data-fossil]").forEach(
      (b) =>
        (b.onclick = () =>
          finishErrand(o, { ...o.reward, species: Number(b.dataset.fossil) })),
    );
    return;
  }
  finishErrand(o, o.reward);
}
function finishErrand(o: WorldObject, reward?: Reward) {
  const receipt = rewardReceipt(reward);
  flag(o.setsFlag);
  flag(pitchFlag(o.id));
  updateChart(save.flags, save.map);
  applyReward(reward);
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
      partner: id => ({ name: engine.species(id).name, sprite: sprite(id) }),
      onSurvey: id => { save.survey = id; persist(); },
      onCancel: menu,
    });
    return;
  } else if (v === "map") {
    title = "Astra region";
    body = `<header class="atlas-header"><h2>Astra region</h2><div><button data-zoom aria-pressed="false">Zoom +</button><button id="local-map">Local map</button><button id="back">Back</button></div></header>
      <div class="atlas-paper"><canvas class="region-chart" role="img"></canvas></div>
      <div class="atlas-key"><span><i class="pin-player"></i>You</span><span><i class="pin-goal">✦</i>Journal</span><span><i class="pin-town"></i>Town</span><span><i class="pin-site"></i>Site</span></div>
      <div class="atlas-readout"><button data-turn="-1" aria-label="Previous place">◀</button><div aria-live="polite"><strong data-place></strong><small data-links></small></div><button data-turn="1" aria-label="Next place">▶</button></div>
      <button class="atlas-fly" data-travel="" hidden>Fly here</button>`;
  } else if (v === "local-map") {
    const map = currentField(),
      goal = directions(save, has);
    title = map.name;
    body = `<div class="map-layout"><canvas class="field-map" aria-label="Local terrain map with your position and next destination"></canvas><div><div class="map-key small">● You &nbsp; <b>■</b> Objective &nbsp; ▪ Exit</div><div class="objective"><strong>${escapeHtml(goal.title)}</strong><br>${escapeHtml(goal.hint)}</div>${goal.fly ? `<button data-travel="${goal.fly}">Fly to ${escapeHtml(WORLD[goal.fly].name)}</button>` : ""}</div></div><h3>Ways out</h3><div class="journal-entries">${map.exits.map((e) => `<article><strong>${escapeHtml(WORLD[e.to].name)}</strong> · ${bearings(save.x, save.y, e)}${has(e.requires) ? "" : `<p class="small muted">${escapeHtml(e.lockedDialogue || "Currently closed.")}</p>`}</article>`).join("")}</div>${
      save.abilities.includes("fly")
        ? `<h3>Fly to a town</h3><div class="list">${save.visited
            .filter(
              (id) =>
                WORLD[id].kind === "town" && id !== save.map && id !== goal.fly,
            )
            .map(
              (id) =>
                `<button data-travel="${id}">${escapeHtml(WORLD[id].name)}</button>`,
            )
            .join("")}</div>`
        : ""
    }`;
  } else {
    title = "Settings & save";
    body = `<div class="save-retry" hidden><p class="error" role="alert"></p><button id="retry-save"></button></div><p>Battle speed: ${save.settings.battleSpeed}×</p><div class="buttons"><button id="speed">Change speed</button><button id="time">${save.settings.night ? "Switch to day" : "Camp until night"}</button><button id="music">${sound.enabled ? "Mute sound" : "Play sound"}</button><button id="how">How to play</button><button id="export">Export save</button><button data-backup-picker id="choose-save">Import save</button><input hidden id="import" type="file" accept="application/json,.json"></div><p class="small muted">Controller: ${escapeHtml(
      Array.from(navigator.getGamepads?.() || [])
        .filter((p): p is Gamepad => !!p)
        .map((p) => p.id)
        .join(", ") || "No gamepad connected",
    )}. Standard 8BitDo modes use A, B, Start and the D-pad or left stick.</p><p class="small muted">To install: on iPhone or iPad, open Share and choose Add to Home Screen. On Android, use your browser’s Install app or Add to Home screen menu.</p><p class="small muted">Your adventure saves automatically in this browser. Export a backup to keep it safe.</p>`;
  }
  const p = panel(
    layer,
    title,
    v === "map" ? body : `${body}<div class="buttons"><button class="secondary" id="back">Back</button></div>`,
    v === "map" ? "atlas-screen" : "", fieldCursors[v] ??= {},
  );
  if (v === "map") {
    const objective = campaignObjective(save);
    const marker = objective && regionPosition(objective.map.id, objective.object.x + 0.5, objective.object.y + 0.5);
    mountRegionChart(p, save, marker?.point);
    p.querySelector("#local-map")!.addEventListener("click", () => view("local-map"));
  }
  const chart = p.querySelector<HTMLCanvasElement>(".field-map");
  if (chart)
    drawFieldMap(
      chart,
      currentField(),
      save.x,
      save.y,
      directions(save, has).marker,
    );
  p.querySelector("#back")!.addEventListener("click", v === "local-map" ? () => view("map") : menu);
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
    mountSaveRetry(p);
    bindBackupPicker(p, () => message("Save imported successfully."), error => message(error, () => view("settings")));
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
    sprite: sprite(mon.species), level: mon.level, status: mon.status,
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
    engine, image: sprite(mon.species), itemName,
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
    [58, 60, 69].find((id) => save.flags.includes("starter_" + id)) ??
    save.caught[0];
  const families: Record<number, number[]> = {
    58: [60, 61, 62, 62],
    60: [69, 70, 71, 71],
    69: [58, 58, 59, 59],
  };
  return families[partner]?.[Number(o.id.slice(6)) - 1] ?? original;
}
function useItem(item: string) {
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
    encounterTarget = 1;
    persist();
    message(
      "The lure will attract one of this habitat's rarer Pokémon on your next grass encounter.",
      () => view("bag"),
    );
    return;
  }
  if (item === "repel") {
    if (save.repel) {
      message("Your Repel is still working.", () => view("bag"));
      return;
    }
    save.items.repel--;
    save.repel = 100;
    persist();
    message("Repel will keep wild Pokémon away for a while.", () =>
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
    title: itemName(item),
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
        p.querySelector<HTMLButtonElement>("#back")!.onclick = () => useItem(item);
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
            party: (o.id.startsWith("rematch_") ? o.trainer.team : fieldTeam(o, save)).map((m, i) =>
              engine.makePokemon(rivalSpecies(o, i, m.species), m.level),
            ),
          }
        : { species, level };
    battle = engine.startBattle({
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
    });
    mode = "encounter";
    sound.refreshMusic();
    layer.innerHTML =
      '<div class="encounter-transition" aria-hidden="true"></div>';
    window.setTimeout(() => showBattle(fishing), 620);
  } catch (e) {
    message(
      `Battle could not start: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}
function showBattle(fishing = false) {
  mode = "battle";
  const s = battle.snapshot();
  if (s.outcome && s.result) {
    const result = s.result;
    const caughtSpecies =
      result.caught !== null ? result.party[result.caught]?.species : undefined;
    const firstCatch = caughtSpecies !== undefined && !save.caught.includes(caughtSpecies);
    const catchDestination = (result.caught ?? -1) >= 6 ? "storage" : "party";
    save.party = result.party.slice(0, 6);
    for (const mon of result.party.slice(6)) storePokemon(save.storage, mon);
    save.money = result.money;
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
    const won = ["win", "won", "victory"].includes(s.outcome.toLowerCase());
    const earnedBadge = won && !!battleObject?.reward?.badge && !(badgeMask(save) & (1 << (battleObject.reward.badge - 1)));
    let receipt = "";
    if (
      battleObject &&
      ((isWildEncounter(battleObject) && caughtSpecies === battleSpecies) ||
        (!isWildEncounter(battleObject) && won))
    ) {
      flag(battleObject.setsFlag || battleObject.id);
      // Custom Astra trainers have authored prizes; the native cartridge's
      // trainer-class payout table does not describe these new teams.
      if (won && !isWildEncounter(battleObject))
        save.money = Math.min(
          999999,
          save.money + (battleObject.trainer?.reward ?? 0),
        );
      receipt = rewardReceipt(battleObject.reward);
      applyReward(battleObject.reward);
    }
    const blackout =
      !won &&
      (["lose", "loss", "lost", "defeat"].includes(s.outcome.toLowerCase()) ||
        !save.party.some((m) => m.hp > 0));
    if (blackout) {
      save.party = save.party.map((m) => engine.healPokemon(m));
      if (
        battleObject?.id.startsWith("league_") &&
        !save.flags.includes("champion")
      )
        save.flags = save.flags.filter((f) => !/^league_[0-3]_won$/.test(f));
      save.map =
        save.center && WORLD[save.center] ? save.center : "dewdrop_center";
      const door = WORLD[save.map].exits[0];
      save.x = door.x + 0.5;
      save.y = door.y - 0.5;
      save.facing = "up";
      save = normalizeSavePosition(save);
      exitLock = true;
    }
    if (won && battleObject?.id === "league_4")
      save.hallOfFame = save.party.map(({ species, level }) => ({
        species,
        level,
      }));
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
      if (earnedBadge) sound.overworld("badge");
      const afterVictory = receipt ? () => showReceipt(receipt, wrapUp, battleMusic) : wrapUp;
      if (victory) message(victory, afterVictory, battleObject?.name, battleMusic);
      else afterVictory();
      return;
    }
    if (!blackout && s.outcome === "draw" && escapeAnnounced(s.events)) {
      wrapUp();
      return;
    }
    const afterCatch = receipt ? () => showReceipt(receipt, wrapUp, battleMusic) : wrapUp;
    if (firstCatch) {
      mode = "registration";
      specimenCard(layer, "New Pokédex entry", specimen(caughtSpecies),
        `${catchDestination === "storage" ? "Sent to the Center PC" : "Joined your party"} · ${save.caught.length} / 251 caught`,
        "Continue", afterCatch);
      return;
    }
    if (blackout) sound.heal();
    message(
      caughtSpecies
        ? `${engine.species(caughtSpecies).name} ${catchDestination === "storage" ? "was sent to the Center PC" : "joined your party"}!`
        : blackout
          ? `Your team was exhausted. You returned to ${WORLD[save.map].name}, where your Pokémon were healed.`
          : s.outcome.toLowerCase() === "draw"
            ? "The battle ended in a draw."
            : s.outcome.toLowerCase().includes("enemy")
              ? "The wild Pokémon fled."
              : "Got away safely!",
      afterCatch,
      undefined,
      battleMusic,
    );
    return;
  }
  battlePresenter = new BattlePresenter({
    layer,
    trainerName:
      battleObject?.trainer && !isWildEncounter(battleObject)
        ? battleObject.trainer.name || battleObject.name
        : undefined,
    gymBackdrop: gymBattleBackdrop(currentField()),
    fieldBackdrop: renderer.battleBackdrop(currentField(), save.x, save.y, fishing),
    arena: battleObject?.id.endsWith("league_4")
      ? "champion"
      : battleObject?.id.includes("league_")
        ? "league"
        : undefined,
    wildEncounter: battleObject?.kind === "legendary" ? "legendary" : undefined,
    caught: save.caught,
    prizeMoney: battleObject?.trainer?.reward ?? 0,
    snapshot: s,
    act: (index) => battle.act(index),
    sprite,
    species: (id) => engine.species(id),
    move: (id) => engine.move(id),
    cry,
    music: (cue) => {
      battleMusic = cue === "Capture" ? "capture" : victoryTheme(battleObject);
      sound.refreshMusic();
    },
    sound: (id) => sound.soundEffect(id),
    animationSound: (...args) => sound.battleAnimation(...args),
    itemName: (id) =>
      (
        ({
          1: "Master Ball",
          2: "Ultra Ball",
          4: "Great Ball",
          5: "Poké Ball",
          18: "Potion",
        }) as Record<number, string>
      )[id] ||
      Object.values(MEDICINE).find((m) => m.id === id)?.name ||
      "item",
    party: () => save.party,
    speed: save.settings.battleSpeed,
    finish: () => {
      battlePresenter = undefined;
      showBattle();
    },
    error: (e) =>
      message(`Battle error: ${e instanceof Error ? e.message : String(e)}`),
  });
}
function hallOfFame(done: () => void) {
  mode = "ceremony";
  sound.refreshMusic();
  const p = panel(
    layer,
    "Hall of Fame",
    `<p>The team that brought the dawn back to Astra.</p><div class="hall-party">${(save.hallOfFame || save.party).map((m) => `<div><img alt="" src="${sprite(m.species)}"><span>${escapeHtml(engine.species(m.species).name)}<br>Lv ${m.level}</span></div>`).join("")}</div><p class="small">The Aurora Trail is open west of Dewdrop Village.</p><button id="continue">Continue exploring</button>`,
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
    from: sprite(current.species),
    to: sprite(species),
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
    countTravel(Math.hypot(save.x - oldX, save.y - oldY));
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
    void showHatch(layer, sprite(253), sprite(hatch.mon.species), name,
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
  if (input.hit("a")) {
    interact();
    return;
  }
  if (input.hit("menu")) {
    menu();
    return;
  }
  const moving = (a: "right" | "left" | "down" | "up") =>
    Number(input.held(a) || input.hit(a));
  let dx = moving("right") - moving("left"),
    dy = moving("down") - moving("up");
  if (!dx && !dy) {
    bumpLatched = false;
    return;
  }
  const len = Math.hypot(dx, dy);
  dx /= len;
  dy /= len;
  const heading =
    Math.abs(dx) > Math.abs(dy)
      ? dx > 0
        ? "right"
        : "left"
      : dy > 0
        ? "down"
        : "up";
  save.facing = heading;
  if (currentMap.tiles[Math.floor(save.y)]?.[Math.floor(save.x)] === "i") {
    glide = iceLanding(currentMap, save, heading, blocked);
    return;
  }
  const dist = dt * (input.held("speed") ? 7.2 : 5.2);
  const oldX = save.x,
    oldY = save.y;
  // Short collision steps keep movement smooth and prevent tunnelling on slow frames.
  const steps = Math.max(1, Math.ceil(dist / 0.12));
  for (let i = 0; i < steps; i++) {
    const nx = save.x + (dx * dist) / steps,
      ny = save.y + (dy * dist) / steps;
    if (!blocked(nx, save.y)) save.x = nx;
    if (!blocked(save.x, ny)) save.y = ny;
    if (currentMap.tiles[Math.floor(save.y)]?.[Math.floor(save.x)] === "i") {
      const entered = Math.floor(save.x) !== Math.floor(oldX)
        ? dx > 0 ? "right" : "left" : dy > 0 ? "down" : "up";
      save.facing = entered;
      glide = iceLanding(currentMap, save, entered, blocked);
      break;
    }
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
  countTravel(moved);
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
      updateChart(save.flags, save.map);
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
      if (!save.visited.includes(save.map) && WORLD[save.map].kind === "town")
        save.visited.push(save.map);

      persist();
    });
    return;
  }
  if (save.repel) {
    save.repel = Math.max(0, save.repel - moved);
    if (!save.repel) {
      persist();
      message("The Repel wore off. Pokémon can appear in tall grass again.");
      return;
    }
  }
  if (
    map.tiles[Math.floor(save.y)]?.[Math.floor(save.x)] === "g" &&
    save.party.length &&
    !save.repel
  ) {
    encounterDistance += moved;
    if (encounterDistance >= encounterTarget && map.encounters.length) {
      encounterDistance = 0;
      encounterTarget = 8 + Math.random() * 14;
      const lured = save.flags.includes("lure_ready");
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
function countTravel(distance: number) {
  recordTravel(save, distance);
  if (save.steps - lastAutosave >= 10) {
    lastAutosave = save.steps;
    persist();
  }
}
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.15);
  last = now;
  input.update();
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
    layer.querySelector<HTMLButtonElement>("#cancel")?.click();
  } else if (mode === "menu" && input.hit("menu")) close();
  else if (mode === "battle" && input.hit("b")) battlePresenter?.back();
  else if (mode === "evolution-result") {
    if (input.hit("a") || input.hit("b"))
      layer.querySelector<HTMLButtonElement>(".evolution-continue")?.click();
  } else if (!["world", "loading", "saving", "dialogue", "evolution"].includes(mode)) {
    menuInput.update(layer, input, now, mode === "battle");
  }
  if (wasWorld) update(dt);
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
        npcs: actors.states, hideHud: mode !== "world", exitOpen: isExitOpen,
        confirmLabel: input.confirmLabel, canFish: mode === "world" && canFish(map),
      },
    );
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    const status = document.createElement("span");
    status.id = "offline-status";
    status.setAttribute("role", "status");
    status.textContent = "Saving for offline play…";
    document.querySelector(".statusbar > span")?.replaceWith(status);
    const hadController = !!navigator.serviceWorker.controller;
    let updateReady = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController) return;
      updateReady = true;
      status.textContent = "Update ready · reload to play";
    });
    void navigator.serviceWorker
      .register("./sw.js", { updateViaCache: "none" })
      .then(async (registration) => {
        if (hadController) void registration.update().catch(() => {});
        await navigator.serviceWorker.ready;
        if (!updateReady) status.textContent = "✓ Offline ready";
      })
      .catch((error) => {
        status.textContent = "Offline setup unavailable — retry online";
        console.warn("Offline setup failed", error);
      });
  } else {
    void navigator.serviceWorker
      .getRegistrations()
      .then((rs) => Promise.all(rs.map((r) => r.unregister())));
  }
}
mode = "welcome";
openCartridge(layer, ready => {
  engine = ready;
  renderer.setEngine(engine);
  void readJourney();
});
