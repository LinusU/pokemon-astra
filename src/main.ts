import { iceLanding, advanceGlide } from "./game/skating";
import { gymState } from "./world/gyms";
import { awardBadge, badgeMask, fieldHabitats, fieldTeam } from "./game/badges";
import { fishingPool } from "./game/pokedex";
import { Input } from "./game/input";
import { Renderer } from "./game/render";
import { WorldActors, interactionTarget } from "./game/actors";
import {
  barrierTarget,
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
import { MenuInput } from "./ui/menu-input";
import { MEDICINE, isMedicine, useMedicine } from "./game/medicine";
import { GameAudio } from "./game/audio";
import { battleTheme, trainerIntroMusic, victoryTheme, type MusicScene } from "./game/music";
import { BattlePresenter } from "./ui/battle";
import { playEvolution } from "./ui/evolution";
import { get, set, download } from "./game/storage";
import {
  freshSave,
  isValidSave,
  normalizeSavePosition,
  restoreQuestItems,
  meetsRequirement,
  type Save,
} from "./game/save";
import { createShell, panel, escapeHtml, type PanelCursor } from "./ui/shell";
import {
  WORLD,
  QUESTS,
  BADGES,
  type Exit,
  type Requirement,
  type Reward,
  type WorldObject,
} from "./world";
import { initEngine, type Engine } from "./engine";
import "./styles.css";
import "./ui/region-map.css";

const input = new Input(),
  { canvas, layer } = createShell(input),
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
  battle: any,
  battleObject: WorldObject | undefined,
  approachingTrainer: WorldObject | undefined,
  battleMusic: MusicScene | undefined,
  interactionMusic: MusicScene | undefined,
  battleSpecies = 0,
  lastAutosave = 0,
  encounterTarget = 6;
const ballIds: Record<string, number> = {
  master_ball: 1,
  ultra_ball: 2,
  great_ball: 4,
  poke_ball: 5,
};
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
  return gymState(WORLD[save.map], save.flags);
}
function scene(): MusicScene {
  if (mode === "title") return "title";
  if (mode === "ceremony") return "hallOfFame";
  if (mode === "evolution") return "evolution";
  if (mode === "evolution-result") return "silent";
  if (mode === "battle" || mode === "encounter")
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
function persist() {
  if (!engine || ["welcome", "loading", "title", "intro"].includes(mode))
    return;
  void set("save", save).catch(() => {
    const status = document.querySelector(".statusbar > span");
    if (status)
      status.textContent = "Save unavailable · export a backup in Settings";
  });
}
function restoreSession(data: Save) {
  save = normalizeSavePosition(restoreQuestItems(data));
  fieldBagState = {};
  fieldDexState = {};
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
    layer.innerHTML = `<div class="dialogue" role="status">${speaker ? `<strong class="speaker">${escapeHtml(speaker)}</strong>` : ""}${escapeHtml(next)}<span class="advance">A ▸</span></div>`;
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
function welcome(error = "") {
  mode = "welcome";
  const p = panel(
    layer,
    "Pokémon Astra",
    `<p>Choose your English Pokémon Crystal 1.1 cartridge file (.gbc) to begin.</p><div class="drop" id="drop"><button id="choose-rom">Choose ROM</button><input hidden id="rom" type="file" accept=".gbc,application/octet-stream"><span class="drop-hint small"> or drop your file here</span></div><p class="small muted">Your cartridge and save stay in this browser.</p>${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}`,
    "rom-import",
  );
  const file = p.querySelector<HTMLInputElement>("#rom")!;
  p.querySelector("#choose-rom")!.addEventListener("click", () => file.click());
  file.onchange = () => {
    if (file.files?.[0]) void loadRom(file.files[0]);
  };
  const drop = p.querySelector<HTMLElement>("#drop")!;
  drop.ondragover = (e) => {
    e.preventDefault();
    drop.classList.add("drag");
  };
  drop.ondragleave = () => drop.classList.remove("drag");
  drop.ondrop = (e) => {
    e.preventDefault();
    drop.classList.remove("drag");
    if (e.dataTransfer?.files[0]) void loadRom(e.dataTransfer.files[0]);
  };
}
async function loadRom(file: File) {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await start(bytes);
    await set("rom", bytes);
  } catch (e) {
    welcome(
      `Could not load this ROM: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}
async function start(bytes: Uint8Array) {
  mode = "loading";
  panel(layer, "Preparing Astra", "<p>Reading your local game data…</p>");
  engine = await initEngine(bytes);
  renderer.setEngine(engine);
  actors.reset();
  glide = undefined;
  const existing = await get<Save>("save");
  if (isValidSave(existing)) {
    restoreSession(existing);
    title();
  } else if (existing !== undefined) {
    mode = "recovery";
    const p = panel(
      layer,
      "Recover your journey",
      '<p>This browser save could not be read. Export it for safekeeping or import a working backup to continue.</p><div class="buttons"><button id="export">Export current save</button><button id="choose">Choose backup</button><input hidden type="file" accept=".json"></div>',
    );
    p.querySelector("#export")!.addEventListener("click", () =>
      download("pokemon-astra-recovery.json", existing),
    );
    const input = p.querySelector("input")!;
    p.querySelector("#choose")!.addEventListener("click", () => input.click());
    input.onchange = async () => {
      try {
        const file = input.files?.[0];
        if (!file) return;
        const data = JSON.parse(await file.text());
        if (!isValidSave(data)) throw Error();
        restoreSession(data);
        await set("save", save);
        title();
      } catch {
        input.value = "";
        p.querySelector("p")!.textContent =
          "That backup could not be read. Choose an Astra JSON save.";
      }
    };
  } else {
    save = freshSave();
    sound.attach(engine, true);
    intro();
  }
}
function title() {
  mode = "title";
  const p = panel(
    layer,
    "Welcome back",
    `<p>Continue your journey in ${escapeHtml(WORLD[save.map].name)}.</p><div class="buttons"><button id="continue">Continue journey</button><button class="secondary" id="new">New adventure</button></div>`,
    "", fieldCursors.title ??= {},
  );
  p.querySelector("#continue")!.addEventListener("click", () => {
    mode = "world";
    layer.innerHTML = "";
    void sound.unlock();
  });
  p.querySelector("#new")!.addEventListener("click", () => {
    const confirm = panel(
      layer,
      "Start a new adventure?",
      `<p>Your existing browser save will be replaced when the new adventure begins. Export a backup first if you want to keep it.</p><div class="buttons"><button class="secondary" id="cancel">Keep my journey</button><button id="confirm">Start over</button></div>`,
    );
    confirm.querySelector("#cancel")!.addEventListener("click", title);
    confirm.querySelector("#confirm")!.addEventListener("click", () => {
      restoreSession(freshSave());
      intro();
    });
  });
}
function intro() {
  mode = "intro";
  const p = panel(
    layer,
    "Dewdrop Village",
    `<p>Professor Alder has a Pokémon for you. Meet him at the lab in the north garden.</p><p class="small">Walk with the D-pad. Face Alder and press A to talk.</p><div class="buttons"><button id="begin">Begin adventure</button><button id="how" class="secondary">How to play</button></div>`,
    "", fieldCursors.intro ??= {},
  );
  p.querySelector("#how")!.addEventListener("click", () => fieldBasics(intro));
  p.querySelector("#begin")!.addEventListener("click", () => {
    mode = "world";
    layer.innerHTML = "";
    void sound.unlock();
    persist();
  });
}
function fieldBasics(back: () => void) {
  mode = "guide";
  const p = panel(
    layer,
    "Field basics",
    `<div class="journal-entries"><article><strong>Find your way</strong><p>Walk with the D-pad, arrows or WASD. Face a person or object and press A or Z. Open Menu with Start or M to see your next stop on the map.</p></article><article><strong>Build your team</strong><p>Walk through tall grass to find Pokémon. Weaken a wild Pokémon, then choose Bag and throw a Poké Ball. Extra catches go to Storage.</p></article><article><strong>Train and recover</strong><p>Pokémon that fight earn experience. A teammate holding Exp. Share can earn some too. Talk to a road trainer again for a practice battle. A Center heals your whole party.</p></article><article><strong>Follow the beacons</strong><p>Your journal follows the survey and records blocked paths. Each badge unlocks a field ability you can use without teaching a move.</p></article></div><button class="secondary" id="back">Back</button>`,
  );
  p.querySelector("#back")!.addEventListener("click", back);
}
function starter() {
  mode = "starter";
  const p = panel(
    layer,
    "Choose your partner",
    `<p>Which Pokémon will you take with you?</p><div class="list"><button data-id="58"><img class="mini-sprite" src="${sprite(58)}" alt=""> Growlithe <span class="muted">· Fire</span></button><button data-id="60"><img class="mini-sprite" src="${sprite(60)}" alt=""> Poliwag <span class="muted">· Water</span></button><button data-id="69"><img class="mini-sprite" src="${sprite(69)}" alt=""> Bellsprout <span class="muted">· Grass</span></button></div>`,
  );
  p.querySelectorAll<HTMLButtonElement>("[data-id]").forEach(
    (b) =>
      (b.onclick = () => {
        const id = Number(b.dataset.id);
        save.party = [engine.makeStarter(id)];
        flag("starter_" + id);
        cry(id);
        save.seen.push(id);
        save.caught.push(id);
        // Earlier saves already included these supplies before meeting Alder.
        if (save.flags.includes("starter_supplies_pending")) {
          applyReward({
            items: [
              { item: "poke_ball", amount: 10 },
              { item: "potion", amount: 5 },
            ],
          });
          save.flags = save.flags.filter(
            (f) => f !== "starter_supplies_pending",
          );
          sound.overworld("item");
        }
        flag("partner");
        persist();
        message(
          `${engine.species(id).name} joined your party! Alder packed 10 Poké Balls and 5 Potions in your Bag. Take the east road to Mossford.`,
        );
      }),
  );
}
function itemName(key: string) {
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
        (save.party.length >= 6 ? " joined storage" : " joined your party"),
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
    (save.party.length < 6 ? save.party : save.storage).push(mon);
    if (!save.caught.includes(r.species)) save.caught.push(r.species);
    if (!save.seen.includes(r.species)) save.seen.push(r.species);
  }
}
const isExitOpen = (exit: Exit) => exitOpen(exit, has, save.flags);

const fieldActions: Record<string, [string, string, string]> = {
  cut: [
    "Overgrown tree",
    "Use Cut",
    "The branches fell away. The path is clear.",
  ],
  strength: [
    "Heavy boulder",
    "Use Strength",
    "You pushed the boulder off the trail.",
  ],
  whirlpool: [
    "Whirlpool",
    "Use Whirlpool",
    "The spinning water settled. You can cross.",
  ],
  surf: [
    "Water crossing",
    "Use Surf",
    "Your Pokémon carried you onto the water.",
  ],
  rockSmash: ["Cracked rock", "Use Rock Smash", "The cracked rock crumbled."],
  flash: ["Dark passage", "Use Flash", "The passage lit up."],
  waterfall: [
    "Waterfall",
    "Use Waterfall",
    "Your Pokémon found a way up the falls.",
  ],
};
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
function interact() {
  const map = currentField(),
    dx = save.facing === "left" ? -1 : save.facing === "right" ? 1 : 0,
    dy = save.facing === "up" ? -1 : save.facing === "down" ? 1 : 0;
  actors.enter(map);
  const barrier = barrierTarget(map, save, isExitOpen);
  if (barrier) {
    sound.overworld("interact");
    inspectBarrier(barrier);
    return;
  }
  const tx = save.x + dx * 0.75,
    ty = save.y + dy * 0.75;
  const o = interactionTarget(map, save, new Set(save.flags), (o) =>
    actors.position(o),
  );
  if (!o) {
    if (
      save.flags.includes("quest_angler_complete") &&
      map.tiles[Math.floor(ty)]?.[Math.floor(tx)] === "~" &&
      save.party.length
    ) {
      const fish = fishingPool(map, (id) =>
        engine.species(id).types.includes(21), save,
      );
      const pick = fish[Math.floor(Math.random() * fish.length)];
      message("A Pokémon took the bait!", () =>
        startBattle(pick.species, pick.minLevel),
      );
      return;
    }
    // A stray confirm while walking should leave movement uninterrupted.
    return;
  }
  sound.overworld("interact");
  actors.face(o, save.x, save.y);
  if (o.wildlife) {
    if (!save.seen.includes(o.wildlife)) {
      save.seen.push(o.wildlife);
      persist();
    }
    cry(o.wildlife);
    message(o.dialogue, undefined, o.name);
    return;
  }
  if (o.quest) {
    flag("met_" + o.id);
    persist();
  }
  // Finished errands remain finished even after a party or held item changes.
  if (o.setsFlag && save.flags.includes(o.setsFlag) && !o.repeatable) {
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
    const finished = o.quest ? QUESTS.find((q) => q.id === o.quest) : undefined;
    message(
      finished
        ? `${finished.name} complete. Thank you for your help!`
        : o.kind === "starter"
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
      o.lockedDialogue || "There is more to do before this opens.",
      undefined,
      o.name,
    );
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
  if (o.kind === "legendary" && !save.flags.includes(o.setsFlag || o.id)) {
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
function shop(selected?: string) {
  mode = "menu";
  const stock: [string, string, number, number][] = [
    ["poke_ball", "Poké Ball", 200, 0],
    ...Object.entries(MEDICINE).map(
      ([key, m]): [string, string, number, number] => [
        key,
        m.name,
        m.price,
        m.badges,
      ],
    ),
    ["repel", "Repel", 350, 0],
    ["great_ball", "Great Ball", 600, 2],
    ["ultra_ball", "Ultra Ball", 1200, 5],
    ["fire_stone", "Fire Stone", 2100, 2],
    ["water_stone", "Water Stone", 2100, 2],
    ["leaf_stone", "Leaf Stone", 2100, 2],
    ["thunder_stone", "Thunder Stone", 2100, 3],
    ["moon_stone", "Moon Stone", 2100, 4],
    ["sun_stone", "Sun Stone", 2100, 4],
    ["link_cable", "Link Cable", 2500, 4],
    ["metal_coat", "Metal Coat", 2500, 5],
    ["kings_rock", "King’s Rock", 2500, 5],
    ["dragon_scale", "Dragon Scale", 2500, 6],
    ["up_grade", "Up-Grade", 2500, 6],
  ];
  const p = panel(
    layer,
    "Astra Mart",
    `<p>Funds: ₽${save.money}</p><div class="list">${stock
      .filter((v) => save.badges >= v[3])
      .map(
        ([id, name, cost]) =>
          `<button data-item="${id}" data-cost="${cost}">${name} · ₽${cost}<span class="stock-count">Bag ${save.items[id] || 0}</span></button>`,
      )
      .join("")}</div><button class="secondary" id="back">Leave</button>`,
  );
  p.querySelectorAll<HTMLButtonElement>("[data-item]").forEach(
    (b) =>
      (b.onclick = () => {
        const key = b.dataset.item!,
          cost = Number(b.dataset.cost);
        const back = () => shop(key);
        const max = Math.min(
          99 - (save.items[key] || 0),
          Math.floor(save.money / cost),
        );
        if (max < 1) {
          message(
            (save.items[key] || 0) >= 99
              ? "Your Bag already holds 99 of those."
              : "You don’t have enough money.",
            back,
          );
          return;
        }
        const buy = (quantity: number) => {
          save.money -= cost * quantity;
          save.items[key] = (save.items[key] || 0) + quantity;
          persist();
          sound.overworld("purchase");
          message(
            `You put ${itemName(key)} × ${quantity} in your Bag.`,
            back,
            "Shopkeeper",
          );
        };
        const quantities = [1, 5, 10].filter((q) => q <= max);
        const sale = panel(
          layer,
          itemName(key),
          `<p>${escapeHtml(itemInfo(key).description || "")}</p><p class="small">Money ₽${save.money} · In Bag ${save.items[key] || 0}</p><div class="list">${quantities
            .map(
              (q) =>
                `<button data-quantity="${q}">Buy ${q}<span class="stock-count">₽${q * cost}</span></button>`,
            )
            .join(
              "",
            )}</div><button class="secondary" id="back">Cancel</button>`,
        );
        sale.querySelector("#back")!.addEventListener("click", back);
        sale
          .querySelectorAll<HTMLButtonElement>("[data-quantity]")
          .forEach(
            (button) =>
              (button.onclick = () => buy(Number(button.dataset.quantity))),
          );
      }),
  );
  p.querySelector("#back")!.addEventListener("click", close);
  if (selected) {
    const row = p.querySelector<HTMLButtonElement>(`[data-item="${selected}"]`);
    row?.focus({ preventScroll: true });
    if (row) p.scrollTop = Math.max(0, row.offsetTop - p.clientHeight / 2);
  }
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
let fieldDexState: DexState = {};
let fieldCursors: Record<string, PanelCursor> = {};
function menu() {
  mode = "menu";
  const options = [
    ["party", "Pokémon"],
    ["bag", "Bag"],
    ["dex", "Pokédex"],
    ["map", "Map"],
    ["journal", "Journal"],
    ["storage", "Storage"],
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
  if (v === "storage" && duringLeagueChallenge()) {
    message(
      "Your League team is registered. Storage reopens when you leave the challenge.",
      menu,
    );
    return;
  }
  let title = "",
    body = "";
  if (v === "party") {
    showFieldParty(pageIndex);
    return;
  } else if (v === "bag") {
    layer.replaceChildren();
    mountBag(layer, {
      items: Object.entries(save.items)
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
      save, state: fieldDexState, species: id => engine.species(id), sprite, cry, onCancel: menu,
    });
    return;
  } else if (v === "journal") {
    title = "Beacon journal";
    const goal = directions(save, has);
    const gates = Object.values(WORLD)
      .flatMap((m) =>
        m.exits
          .filter((e) => save.flags.includes(`gate_${m.id}_${e.to}`))
          .map(
            (e) =>
              `<article><strong>${escapeHtml(WORLD[e.to].name)}</strong> · ${escapeHtml(m.name)}<p class="small">${isExitOpen(e) ? "The way is open." : has(e.requires) && e.barrier ? (fieldActions[e.barrier.kind]?.[1] || "Inspect the path") + " here." : escapeHtml(e.lockedDialogue || "Check the next beacon objective.")}</p></article>`,
          ),
      )
      .join("");
    const entries = QUESTS.flatMap((q) => {
      const who = Object.values(WORLD).find((m) =>
        m.objects.some((o) => o.quest === q.id),
      )!;
      const npc = who.objects.find((o) => o.quest === q.id)!;
      const done = save.flags.includes(q.completedFlag);
      if (
        !done &&
        !save.flags.includes("met_" + npc.id) &&
        !(q.id === "parcel" && save.flags.includes("found_parcel"))
      )
        return [];
      let clue = npc.lockedDialogue || q.description;
      if (q.id === "parcel")
        clue = save.flags.includes("found_parcel")
          ? "Take the parcel to the Bramble courier."
          : "Speak to the Mossford courier.";
      const ready =
        !done &&
        (q.id === "parcel"
          ? save.flags.includes("found_parcel")
          : has(npc.requires));
      return {
        done,
        ready,
        local: who.id === save.map,
        html: `<article><strong>${done ? "✓ " : ""}${escapeHtml(q.name)}</strong><p class="small">${escapeHtml(done ? "Received " + q.reward : ready ? "Return to " + npc.name + " in " + who.name + "." : clue)}</p>${done || ready ? "" : `<span class="small muted">${escapeHtml(who.name)} · ${escapeHtml(q.reward)}</span>`}</article>`,
      };
    }).sort(
      (a, b) =>
        Number(a.done) - Number(b.done) ||
        Number(b.ready) - Number(a.ready) ||
        Number(b.local) - Number(a.local),
    );
    const shores = save.badges >= 3 && save.badges < 6
      ? `<h3>Choose your next beacon</h3><div class="buttons">${["Sunspire · Sable", "Cinderfall · Flint", "Rimepeak · Neve"].map((label, i) => save.flags.includes("badge" + (i + 4)) ? "" : `<button data-survey="${i + 4}" aria-pressed="${save.survey === i + 4}">${label}</button>`).join("")}</div>` : "";
    body = `${shores}<div class="objective"><strong>${escapeHtml(goal.title)}</strong><br>${escapeHtml(goal.hint)}</div><h3>Beacon badges</h3><p>${save.badges ? BADGES.filter((_, i) => badgeMask(save) & (1 << i)).join(" · ") : "Your first keeper is Fern in Bramble."}</p>${save.hallOfFame ? '<button id="hall">Hall of Fame</button>' : ""}${gates ? `<h3>Paths to revisit</h3><div class="journal-entries">${gates}</div>` : ""}<h3>Field requests</h3><div class="journal-entries">${entries.map((e) => e.html).join("") || "<p>No requests yet. Talk to people along the way.</p>"}</div>`;
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
  } else if (v === "storage") {
    title = "Pokémon storage";
    body = `<p class="small">Deposit a party member to make room for captures. Select a stored Pokémon to withdraw it.</p><strong>Party</strong><div class="list">${save.party.map((m, i) => `<button data-deposit="${i}">Deposit ${escapeHtml(engine.species(m.species).name)} · Lv ${m.level}</button>`).join("")}</div><strong>Storage</strong><div class="list">${save.storage.map((m, i) => `<button data-store="${i}">Withdraw ${escapeHtml(engine.species(m.species).name)} · Lv ${m.level}</button>`).join("") || "<p>No Pokémon in storage yet.</p>"}</div>`;
  } else {
    title = "Settings & save";
    body = `<p>Battle speed: ${save.settings.battleSpeed}×</p><div class="buttons"><button id="speed">Change speed</button><button id="time">${save.settings.night ? "Switch to day" : "Camp until night"}</button><button id="music">${sound.enabled ? "Mute sound" : "Play sound"}</button><button id="how">How to play</button><button id="export">Export save</button><button id="choose-save">Import save</button><input hidden id="import" type="file" accept="application/json,.json"></div><p class="small muted">Controller: ${escapeHtml(
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
  p
    .querySelector("#hall")
    ?.addEventListener("click", () => hallOfFame(() => view("journal")));
  p.querySelectorAll<HTMLButtonElement>("[data-survey]").forEach(button => {
    button.onclick = () => {
      save.survey = Number(button.dataset.survey);
      persist();
      view("journal");
    };
  });
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
  p.querySelectorAll<HTMLButtonElement>("[data-deposit]").forEach(
    (b) =>
      (b.onclick = () => {
        if (
          save.party.length <= 1 ||
          !save.party.some(
            (m, i) => i !== Number(b.dataset.deposit) && m.hp > 0,
          )
        ) {
          message("Keep at least one healthy Pokémon in your party.", () =>
            view("storage"),
          );
          return;
        }
        save.storage.push(save.party.splice(Number(b.dataset.deposit), 1)[0]);
        persist();
        view("storage");
      }),
  );
  p.querySelectorAll<HTMLButtonElement>("[data-store]").forEach(
    (b) =>
      (b.onclick = () => {
        if (save.party.length >= 6) {
          message("Your party is full.", () => view("storage"));
          return;
        }
        save.party.push(save.storage.splice(Number(b.dataset.store), 1)[0]);
        persist();
        view(v);
      }),
  );
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
  p
    .querySelector("#choose-save")
    ?.addEventListener("click", () =>
      p.querySelector<HTMLInputElement>("#import")?.click(),
    );
  p
    .querySelector<HTMLInputElement>("#import")
    ?.addEventListener("change", async (e) => {
      try {
        const f = (e.target as HTMLInputElement).files?.[0];
        if (!f) return;
        const data = JSON.parse(await f.text()) as Save;
        if (!isValidSave(data)) throw Error("Invalid save");
        restoreSession(data);
        persist();
        message("Save imported successfully.");
      } catch {
        message("This save file could not be imported.", () =>
          view("settings"),
        );
      }
    });
}
const heldItems: Record<string, number> = {
  exp_share: 57,
  metal_coat: 143,
  dragon_scale: 151,
  kings_rock: 82,
  up_grade: 172,
};
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
  const name = engine.species(mon.species).name;
  const held = Object.keys(heldItems).find(
    (key) => heldItems[key] === mon.item,
  );
  const status = mon.hp === 0 ? "Fainted" : battleStatus(mon.status)?.[1] ?? "Healthy";
  const evolutions = engine.evolutionData(mon.species).evolutions.map((e) => {
    const stones: Record<number, string> = {
      8: "Moon Stone",
      22: "Fire Stone",
      23: "Thunder Stone",
      24: "Water Stone",
      34: "Leaf Stone",
      169: "Sun Stone",
    };
    const heldName = Object.keys(heldItems).find(
      (key) => heldItems[key] === e.parameter,
    );
    const method =
      e.method === 1
        ? "Lv " + e.parameter
        : e.method === 2
          ? stones[e.parameter]
          : e.method === 3
            ? "Link Cable" +
              (heldName ? " while holding " + itemName(heldName) : "")
            : e.method === 4
              ? "High friendship" +
                (e.parameter === 2
                  ? " by day"
                  : e.parameter === 3
                    ? " at night"
                    : "")
              : "Lv " +
                e.parameter +
                " · Attack " +
                ({ 1: ">", 2: "<", 3: "=" }[e.condition as 1 | 2 | 3] || "=") +
                " Defense";
    return escapeHtml(engine.species(e.species).name + " · " + method);
  });
  const p = panel(
    layer,
    name,
    `<div class="party-summary"><img class="party-portrait" src="${sprite(mon.species)}" alt=""><div>Lv ${mon.level} · ${status}<br>HP ${mon.hp} / ${mon.stats[0]}${held ? "<br>Holding " + itemName(held) : ""}</div></div><h3>Moves</h3><div class="move-list">${mon.moves.map((id, i) => (id ? `<div>${escapeHtml(engine.move(id).name)} <span>${mon.pp[i] & 63} PP</span></div>` : "")).join("")}</div>${evolutions.length ? `<h3>Evolution</h3><p class="small">${evolutions.join("<br>")}</p>` : ""}<div class="buttons">${index ? '<button id="lead">Make lead</button>' : ""}${held ? '<button id="take">Take held item</button>' : ""}<button class="secondary" id="back">Back</button></div>`,
  );
  p.querySelector("#lead")?.addEventListener("click", () => {
    [save.party[0], save.party[index]] = [mon, save.party[0]];
    persist();
    view("party");
  });
  p.querySelector("#take")?.addEventListener("click", () => {
    if (!held) return;
    if ((save.items[held] || 0) >= 99) {
      message("Your bag already holds 99 of those.", () => partyDetails(index));
      return;
    }
    mon.item = 0;
    save.items[held] = (save.items[held] || 0) + 1;
    persist();
    partyDetails(index);
  });
  p.querySelector("#back")!.addEventListener("click", () => view("party", index));
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
  const stones: Record<string, number> = {
    fire_stone: 22,
    water_stone: 24,
    thunder_stone: 23,
    leaf_stone: 34,
    moon_stone: 8,
    sun_stone: 169,
  };
  const targets = save.party.map((mon) => {
    const healed = isMedicine(item)
      ? useMedicine(item, mon, engine)
      : undefined;
    const evo =
      !heldItems[item] && !isMedicine(item) && item !== "friendship_charm"
        ? engine
            .evolutionData(mon.species)
            .evolutions.find(
              (e) =>
                (e.method === 2 && e.parameter === stones[item]) ||
                (e.method === 3 &&
                  item === "link_cable" &&
                  (e.parameter === 255 || e.parameter === mon.item)),
            )
        : undefined;
    const eligible = isMedicine(item)
      ? !!healed
      : heldItems[item]
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
      note: targets[i].eligible ? undefined : heldItems[item] ? "Holding item" : "No effect",
    })),
    confirm: heldItems[item] ? "Give item" : "Use item", onBack: () => view("bag"),
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
      if (heldItems[item]) {
        mon.item = heldItems[item];
        save.items[item]--;
        persist();
        message(
          `${engine.species(mon.species).name} is holding ${itemName(item)}.`,
          () => view("bag"),
        );
        return;
      }
      if (healed) {
        save.party[index] = healed;
        save.items[item]--;
        persist();
        sound.overworld(item === "max_elixer" ? "restorePp" : "potion");
        message(
          item === "max_elixer"
            ? `${engine.species(mon.species).name}’s move PP was restored.`
            : `${engine.species(mon.species).name} recovered with the ${itemName(item)}. HP ${healed.hp}/${healed.stats[0]}.`,
          () => view("bag"),
        );
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
function startBattle(species: number, level: number, o?: WorldObject) {
  try {
    battleObject = o;
    battleMusic = undefined;
    interactionMusic = undefined;
    battleSpecies = species;
    if (!save.seen.includes(species)) save.seen.push(species);
    const opponent =
      o?.trainer && o.kind !== "legendary"
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
      seen: save.seen,
      caught: save.caught,
    });
    mode = "encounter";
    sound.refreshMusic();
    layer.innerHTML =
      '<div class="encounter-transition" aria-hidden="true"></div>';
    window.setTimeout(showBattle, 620);
  } catch (e) {
    message(
      `Battle could not start: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}
function showBattle() {
  mode = "battle";
  const s = battle.snapshot();
  if (s.outcome && s.result) {
    const result = s.result;
    const caughtSpecies =
      result.caught !== null ? result.party[result.caught]?.species : undefined;
    save.party = result.party.slice(0, 6);
    if (result.party.length > 6) save.storage.push(...result.party.slice(6));
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
      ((battleObject.kind === "legendary" && caughtSpecies === battleSpecies) ||
        (battleObject.kind !== "legendary" && won))
    ) {
      flag(battleObject.setsFlag || battleObject.id);
      // Custom Astra trainers have authored prizes; the native cartridge's
      // trainer-class payout table does not describe these new teams.
      if (won && battleObject.kind !== "legendary")
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
    persist();
    const victory = won ? battleObject?.victoryDialogue : undefined;
    const wrapUp = () => {
      if (won && battleObject?.id === "league_4")
        hallOfFame(() => postBattle(result.may_evolve));
      else postBattle(result.may_evolve);
    };
    if (won) {
      if (earnedBadge) sound.overworld("badge");
      const afterVictory = receipt ? () => showReceipt(receipt, wrapUp, battleMusic) : wrapUp;
      if (victory) message(victory, afterVictory, battleObject?.name, battleMusic);
      else afterVictory();
      return;
    }
    if (blackout) sound.heal();
    message(
      caughtSpecies
        ? `${engine.species(caughtSpecies).name} joined ${result.caught >= 6 ? "your storage" : "your party"}!`
        : blackout
          ? `Your team was exhausted. You returned to ${WORLD[save.map].name}, where your Pokémon were healed.`
          : s.outcome.toLowerCase() === "draw"
            ? "The battle ended in a draw."
            : s.outcome.toLowerCase().includes("enemy")
              ? "The wild Pokémon fled."
              : "Got away safely!",
      receipt ? () => showReceipt(receipt, wrapUp, battleMusic) : wrapUp,
      undefined,
      battleMusic,
    );
    return;
  }
  battlePresenter = new BattlePresenter({
    layer,
    trainerName:
      battleObject?.trainer && battleObject.kind !== "legendary"
        ? battleObject.trainer.name || battleObject.name
        : undefined,
    arena: battleObject?.id.endsWith("league_4")
      ? "champion"
      : battleObject?.id.includes("league_")
        ? "league"
        : undefined,
    wildEncounter: battleObject?.kind === "legendary" ? "legendary" : undefined,
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
      next();
      sound.refreshMusic();
    },
  });
}
function postBattle(evolvable: number[]) {
  const tasks: (() => void)[] = [];
  save.party.forEach((mon, index) => {
    const data = engine.evolutionData(mon.species);
    if (evolvable.includes(index)) {
      const evolution = data.evolutions.find(
        (e) =>
          (e.method === 1 && mon.level >= e.parameter) ||
          (e.method === 4 &&
            mon.happiness >= 220 &&
            (e.parameter === 1 ||
              (e.parameter === 2 && !save.settings.night) ||
              (e.parameter === 3 && !!save.settings.night))) ||
          (e.method === 5 &&
            mon.level >= e.parameter &&
            ((e.condition === 1 && mon.stats[1] > mon.stats[2]) ||
              (e.condition === 2 && mon.stats[1] < mon.stats[2]) ||
              (e.condition === 3 && mon.stats[1] === mon.stats[2]))),
      );
      if (evolution)
        tasks.push(() => {
          const current = save.party[index];
          const p = panel(
            layer,
            "Evolution",
            `<p>${escapeHtml(engine.species(current.species).name)} is ready to evolve into ${escapeHtml(engine.species(evolution.species).name)}!</p><div class="buttons"><button id="evolve">Evolve</button><button class="secondary" id="later">Not now</button></div>`,
          );
          mode = "menu";
          p.querySelector("#evolve")!.addEventListener("click", () =>
            evolvePartyMember(index, evolution.species, next),
          );
          p.querySelector("#later")!.addEventListener("click", next);
        });
    }
  });
  function next() {
    const task = tasks.shift();
    if (task) task();
    else close();
  }
  next();
}
function blocked(x: number, y: number) {
  const map = currentField();
  return (
    connectedBlocked(map, x, y, save.abilities.includes("surf"), isExitOpen) ||
    actors.solid(map, x, y)
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
  const currentMap = currentField();
  actors.update(currentMap, dt, save);
  if (glide) {
    if (advanceGlide(save, glide, dt)) glide = undefined;
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
  save.steps += moved;
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
  else if ((mode === "menu" || mode === "guide") && input.hit("b")) {
    const back = layer.querySelector<HTMLButtonElement>(
      "[data-bag-cancel], #back, #later",
    );
    if (back) back.click();
    else close();
  } else if (mode === "title" && input.hit("b")) {
    layer.querySelector<HTMLButtonElement>("#cancel")?.click();
  } else if (mode === "menu" && input.hit("menu")) close();
  else if (mode === "battle" && input.hit("b")) battlePresenter?.back();
  else if (mode === "evolution-result") {
    if (input.hit("a") || input.hit("b"))
      layer.querySelector<HTMLButtonElement>(".evolution-continue")?.click();
  } else if (!["world", "loading", "dialogue", "evolution"].includes(mode)) {
    menuInput.update(layer, input, now, mode === "battle");
  }
  if (wasWorld) update(dt);
  const screen = canvas.parentElement!;
  screen.dataset.scene = ["welcome", "title", "intro", "loading"].includes(mode)
    ? "title"
    : mode;
  actors.enter(currentField());
  if (WORLD[save.map])
    renderer.render(
      currentField(),
      save.x,
      save.y,
      save.facing,
      now,
      save.flags,
      { npcs: actors.states, hideHud: mode !== "world", exitOpen: isExitOpen },
    );
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
void get<Uint8Array>("rom")
  .then((rom) => (rom ? start(rom).catch(() => welcome()) : welcome()))
  .catch(() => welcome());
