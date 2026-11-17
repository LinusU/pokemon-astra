import { Input } from "./game/input";
import { Renderer } from "./game/render";
import { WorldActors, interactionTarget } from "./game/actors";
import {
  connectionAt,
  connectedBlocked,
  crossConnection,
} from "./game/navigation";
import { directions, bearings } from "./game/journal";
import { drawFieldMap } from "./ui/field-map";
import { MenuInput } from "./ui/menu-input";
import { MEDICINE, isMedicine, useMedicine } from "./game/medicine";
import { GameAudio } from "./game/audio";
import { BattlePresenter } from "./ui/battle";
import { get, set, download } from "./game/storage";
import {
  freshSave,
  isValidSave,
  normalizeSavePosition,
  type Save,
} from "./game/save";
import { createShell, panel, escapeHtml } from "./ui/shell";
import {
  WORLD,
  QUESTS,
  BADGES,
  type Ability,
  type Requirement,
  type Reward,
  type WorldObject,
} from "./world";
import { initEngine, type Engine } from "./engine";
import "./styles.css";

const input = new Input(),
  { canvas, layer } = createShell(input),
  renderer = new Renderer(canvas),
  menuInput = new MenuInput(),
  actors = new WorldActors();
let battlePresenter: BattlePresenter | undefined;
let engine: Engine,
  save = freshSave(),
  mode = "loading",
  dialogueCallback: (() => void) | undefined,
  last = performance.now(),
  encounterDistance = 0,
  exitLock = true,
  battle: any,
  battleObject: WorldObject | undefined,
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
  !r ||
  ((!r.flags || r.flags.every((f) => save.flags.includes(f))) &&
    (!r.badges || save.badges >= r.badges) &&
    (!r.ability || save.abilities.includes(r.ability)) &&
    (!r.caught || save.caught.length >= r.caught) &&
    (!r.items || r.items.every((item) => (save.items[item] || 0) > 0)) &&
    (!r.species ||
      r.species.some((id) => save.party.some((m) => m.species === id))) &&
    (!r.types ||
      r.types.every(
        (t) =>
          save.caught.filter((id) =>
            engine
              .species(id)
              .types.includes(
                (
                  { bug: 7, water: 21, grass: 22, fire: 20 } as Record<
                    string,
                    number
                  >
                )[t.type] ?? -1,
              ),
          ).length >= t.count,
      )));
const spriteCache = new Map<string, string>();
function sprite(id: number, back = false) {
  const key = `${id}:${back}`;
  if (!spriteCache.has(key)) {
    try {
      const pixels = engine.sprite(id, back),
        c = document.createElement("canvas");
      c.width = 56;
      c.height = 56;
      c.getContext("2d")!.putImageData(
        pixels,
        Math.floor((56 - pixels.width) / 2),
        56 - pixels.height,
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
function scene() {
  if (mode === "battle" || mode === "encounter")
    return battleObject?.trainer && battleObject.kind !== "legendary"
      ? battleObject.name === "Champion Mira"
        ? "champion"
        : "trainer"
      : "wild";
  const map = WORLD[save.map];
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
  save = normalizeSavePosition(data);
  actors.reset();
  encounterDistance = 0;
  encounterTarget = 6;
  lastAutosave = save.steps;
  exitLock = true;
  renderer.setNight(!!save.settings.night);
  sound.attach(engine, save.settings.music !== false);
}
function message(text: string, callback?: () => void, speaker?: string) {
  const words = text.trim().split(/\s+/),
    pages: string[] = [];
  let page = "";
  for (const word of words) {
    if (page && `${page} ${word}`.length > 180) {
      pages.push(page);
      page = word;
    } else page = page ? `${page} ${word}` : word;
  }
  if (page) pages.push(page);
  function show() {
    mode = "dialogue";
    const next = pages.shift() || "";
    dialogueCallback = pages.length ? show : callback;
    layer.innerHTML = `<div class="dialogue" role="status">${speaker ? `<strong class="speaker">${escapeHtml(speaker)}</strong>` : ""}${escapeHtml(next)}<span class="advance">A ▸</span></div>`;
    layer.querySelector(".dialogue")?.addEventListener("click", advance);
  }
  show();
}
function advance() {
  if (mode !== "dialogue") return;
  layer.innerHTML = "";
  mode = "world";
  const cb = dialogueCallback;
  dialogueCallback = undefined;
  cb?.();
}
function welcome(error = "") {
  mode = "welcome";
  const p = panel(
    layer,
    "A new adventure awaits",
    `<p>The beacons of Astra are fading. Choose a partner, explore a new region, and follow the light of the Aurora Current.</p><div class="drop" id="drop"><p><strong>Bring your own Pokémon Crystal ROM</strong><br><span class="small muted">Your ROM stays in this browser, stored locally. It is never uploaded.</span></p><button id="choose-rom">Choose ROM</button><input hidden id="rom" type="file" accept=".gbc,application/octet-stream"><p class="small muted">or drop your file here</p></div>${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}<p class="small muted">Use the English release, revision 1.1 (.gbc).</p>`,
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
    "The Astra region",
    `<p>Eight ancient beacons guide Pokémon along the Aurora Current. Lately, their lights have begun to fail.</p><p>Leave home and follow the village path to Alder’s lab. Open the menu for a field map, and face people to speak with them.</p><div class="buttons"><button id="begin">Begin adventure</button><button id="how" class="secondary">How to play</button></div>`,
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
    `<div class="journal-entries"><article><strong>Find your way</strong><p>Walk with the D-pad, arrows or WASD. Face a person or object and press A or Z. Open Menu with Start or M to see your next stop on the map.</p></article><article><strong>Build your team</strong><p>Walk through tall grass to find Pokémon. Weaken a wild Pokémon, then choose Bag and throw a Poké Ball. Extra catches go to Storage.</p></article><article><strong>Train and recover</strong><p>Trainer battles help healthy teammates catch up. The Party screen shows moves and evolution hints. A red-roofed Center restores HP, status and all move uses.</p></article><article><strong>Follow the beacons</strong><p>Your journal follows the survey and records blocked paths. Each badge unlocks a field ability you can use without teaching a move.</p></article></div><button class="secondary" id="back">Back</button>`,
  );
  p.querySelector("#back")!.addEventListener("click", back);
}
function starter() {
  mode = "starter";
  const p = panel(
    layer,
    "Choose your partner",
    `<p>Professor Alder offers three companions. Your adventure begins together at level 6.</p><div class="list"><button data-id="58"><img class="mini-sprite" src="${sprite(58)}" alt=""> Growlithe <span class="muted">· Fire</span></button><button data-id="60"><img class="mini-sprite" src="${sprite(60)}" alt=""> Poliwag <span class="muted">· Water</span></button><button data-id="69"><img class="mini-sprite" src="${sprite(69)}" alt=""> Bellsprout <span class="muted">· Grass</span></button></div>`,
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
        flag("partner");
        persist();
        message(
          `${engine.species(id).name} joined your party! You received 10 Poké Balls and 5 Potions. Follow Dewpath east to Mossford. Look in the tall grass for wild Pokémon.`,
        );
      }),
  );
}
function itemName(key: string) {
  const name =
    (isMedicine(key) ? MEDICINE[key].name : undefined) ??
    (
      {
        poke_ball: "Poké Ball",
        great_ball: "Great Ball",
        ultra_ball: "Ultra Ball",
        master_ball: "Master Ball",
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
  if (r.badge) save.badges = Math.max(save.badges, r.badge);
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
function interact() {
  const map = WORLD[save.map],
    dx = save.facing === "left" ? -1 : save.facing === "right" ? 1 : 0,
    dy = save.facing === "up" ? -1 : save.facing === "down" ? 1 : 0;
  actors.enter(map);
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
      const fish = map.encounters.filter((e) =>
        engine.species(e.species).types.includes(21),
      );
      const pick = fish[Math.floor(Math.random() * fish.length)];
      message("A Pokémon took the bait!", () =>
        startBattle(pick?.species || 129, pick?.minLevel || 10),
      );
      return;
    }
    // A stray confirm while walking should leave movement uninterrupted.
    return;
  }
  actors.face(o, save.x, save.y);
  // Finished errands remain finished even after a party or held item changes.
  if (o.setsFlag && save.flags.includes(o.setsFlag) && !o.repeatable) {
    if (
      save.flags.includes("champion") &&
      (o.kind === "leader" || o.id.startsWith("league_"))
    ) {
      offerRematch(o);
      return;
    }
    const finished = o.quest ? QUESTS.find((q) => q.id === o.quest) : undefined;
    message(
      finished
        ? `${finished.name} complete. Thank you for your help!`
        : o.kind === "starter"
          ? "Your partner looks happy. Check the beacon journal whenever you need a lead."
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
    sound.cue("heal");
    save.center = save.map;
    save.party = save.party.map((m) => engine.healPokemon(m));
    persist();
    message(
      "Your team’s HP, moves and status are fully restored. If your team faints, we’ll bring you back here.",
      undefined,
      o.name,
    );
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
      const p = panel(
        layer,
        "Enter the Astral League?",
        `<p>Your team will be fully healed for Rowan. Bring enough medicine for four specialists and Mira. Leaving the League restarts the challenge.</p><div class="buttons"><button id="enter">Face Rowan</button><button class="secondary" id="back">Prepare first</button></div>`,
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
  message(
    o.dialogue,
    receipt ? () => message(receipt, undefined, "Received") : undefined,
    o.name,
  );
}
function offerRematch(o: WorldObject) {
  const team = o.trainer!.team.map((m) => ({
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
  const p = panel(
    layer,
    `${o.name}’s rematch`,
    `<p>Face ${escapeHtml(o.name)} again at Lv ${team[0].level}–${team.at(-1)!.level}. Prize money is ₽${o.trainer!.reward}.</p><div class="buttons"><button id="fight">Battle</button><button class="secondary" id="back">Later</button></div>`,
  );
  p.querySelector("#fight")!.addEventListener("click", () =>
    startBattle(team[0].species, team[0].level, {
      ...o,
      id: "rematch_" + o.id,
      setsFlag: "rematch_" + o.id,
      reward: undefined,
      victoryDialogue: "You keep finding new ways to surprise me, Champion.",
      trainer: { ...o.trainer!, team },
    }),
  );
  p.querySelector("#back")!.addEventListener("click", close);
}
function shop() {
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
        const cost = Number(b.dataset.cost);
        if ((save.items[b.dataset.item!] || 0) >= 99) {
          message("Your bag already holds 99 of that item.", shop);
          return;
        }
        if (save.money >= cost) {
          save.money -= cost;
          save.items[b.dataset.item!] = (save.items[b.dataset.item!] || 0) + 1;
          persist();
          shop();
        } else message("You do not have enough money.", shop);
      }),
  );
  p.querySelector("#back")!.addEventListener("click", close);
}
function close() {
  mode = "world";
  layer.innerHTML = "";
  persist();
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
function menu() {
  mode = "menu";
  const goal = directions(save, has);
  const p = panel(
    layer,
    "Your journey",
    `<p>${escapeHtml(WORLD[save.map].name)} · ${save.badges} / 8 badges · ₽${save.money}</p><div class="objective"><strong>${escapeHtml(goal.title)}</strong><br>${escapeHtml(goal.hint)}</div><div class="menu-grid"><button data-view="party">Party</button><button data-view="bag">Bag</button><button data-view="dex">Pokédex</button><button data-view="journal">Journal</button><button data-view="map">Map &amp; travel</button><button data-view="storage">Storage</button><button data-view="settings">Settings &amp; save</button><button data-view="close">Resume</button></div>`,
  );
  p.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(
    (b) =>
      (b.onclick = () => {
        const v = b.dataset.view;
        if (v === "close") close();
        else view(v!);
      }),
  );
}
function view(v: string, pageIndex = 0, missingOnly = false) {
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
    title = "Your party";
    body = save.party.length
      ? save.party
          .map(
            (m, i) =>
              `<button data-switch="${i}"><img class="mini-sprite" alt="" src="${sprite(m.species)}"> ${escapeHtml(engine.species(m.species).name)} · Lv ${m.level}<br><span class="small">${i === 0 ? "Lead · " : ""}HP ${m.hp} / ${m.stats[0]}</span></button>`,
          )
          .join("")
      : "<p>Your party is empty. Visit Alder in the lab.</p>";
    body = `<p class="small">Select a Pokémon to inspect its moves or change your lead.</p><div class="list">${body}</div>`;
  } else if (v === "bag") {
    title = "Your bag";
    body = `<p class="small">Select an item to use it or read what it does.</p><div class="list">${Object.entries(
      save.items,
    )
      .filter(([, n]) => n > 0)
      .map(
        ([k, n]) =>
          `<button data-use="${escapeHtml(k)}">${escapeHtml(itemName(k))} × ${n}</button>`,
      )
      .join("")}</div>`;
  } else if (v === "dex") {
    title = `Pokédex · ${save.caught.length} / 251`;
    const ids = Array.from({ length: 251 }, (_, i) => i + 1).filter(
      (id) => !missingOnly || !save.caught.includes(id),
    );
    const perPage = 12;
    const pages = Math.max(1, Math.ceil(ids.length / perPage));
    body = `<div class="buttons"><button id="filter">${missingOnly ? "Show all" : "Show missing"}</button><button id="prev" ${pageIndex === 0 ? "disabled" : ""}>◂</button><span class="page-count">${pageIndex + 1} / ${pages}</span><button id="next" ${pageIndex + 1 >= pages ? "disabled" : ""}>▸</button></div><div class="journal-entries">${
      ids
        .slice(perPage * pageIndex, perPage * (pageIndex + 1))
        .map((id) => {
          const maps = Object.values(WORLD).filter(
            (m) =>
              m.encounters.some((e) => e.species === id) ||
              m.objects.some(
                (o) =>
                  (o.kind === "legendary" &&
                    o.trainer?.team[0].species === id) ||
                  o.reward?.species === id,
              ),
          );
          const name = save.seen.includes(id)
            ? escapeHtml(engine.species(id).name)
            : "Unknown";
          return `<article><strong>${String(id).padStart(3, "0")} · ${name}${save.caught.includes(id) ? " ✓" : ""}</strong><br><span class="small muted">${escapeHtml(
            maps
              .slice(0, 3)
              .map((m) => m.name)
              .join(", ") || "Alder’s lab",
          )}</span></article>`;
        })
        .join("") || "<p>You’ve caught every species!</p>"
    }</div>`;
  } else if (v === "journal") {
    title = "Beacon journal";
    const goal = directions(save, has);
    const gates = Object.values(WORLD)
      .flatMap((m) =>
        m.exits
          .filter((e) => save.flags.includes(`gate_${m.id}_${e.to}`))
          .map(
            (e) =>
              `<article><strong>${escapeHtml(WORLD[e.to].name)}</strong> · ${escapeHtml(m.name)}<p class="small">${has(e.requires) ? "The way is open." : escapeHtml(e.lockedDialogue || "Check the next beacon objective.")}</p></article>`,
          ),
      )
      .join("");
    const entries = QUESTS.map((q) => {
      const who = Object.values(WORLD).find((m) =>
        m.objects.some((o) => o.quest === q.id),
      )!;
      const npc = who.objects.find((o) => o.quest === q.id)!;
      const done = save.flags.includes(q.completedFlag);
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
    body = `<div class="objective"><strong>${escapeHtml(goal.title)}</strong><br>${escapeHtml(goal.hint)}</div><h3>Beacon badges</h3><p>${save.badges ? BADGES.slice(0, save.badges).join(" · ") : "Your first keeper is Fern in Bramble."}</p>${save.hallOfFame ? '<button id="hall">Hall of Fame</button>' : ""}${gates ? `<h3>Paths to revisit</h3><div class="journal-entries">${gates}</div>` : ""}<h3>Field requests</h3><div class="journal-entries">${entries.map((e) => e.html).join("")}</div>`;
  } else if (v === "map") {
    const map = WORLD[save.map],
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
    `${body}<div class="buttons"><button class="secondary" id="back">Back</button></div>`,
  );
  p
    .querySelector("#filter")
    ?.addEventListener("click", () => view(v, 0, !missingOnly));
  p
    .querySelector("#prev")
    ?.addEventListener("click", () => view(v, pageIndex - 1, missingOnly));
  p
    .querySelector("#next")
    ?.addEventListener("click", () => view(v, pageIndex + 1, missingOnly));
  p
    .querySelector("#hall")
    ?.addEventListener("click", () => hallOfFame(() => view("journal")));
  const chart = p.querySelector<HTMLCanvasElement>(".field-map");
  if (chart)
    drawFieldMap(
      chart,
      WORLD[save.map],
      save.x,
      save.y,
      directions(save, has).marker,
    );
  p.querySelector("#back")!.addEventListener("click", menu);
  p.querySelectorAll<HTMLButtonElement>("[data-use]").forEach(
    (b) => (b.onclick = () => useItem(b.dataset.use!)),
  );
  p.querySelectorAll<HTMLButtonElement>("[data-switch]").forEach(
    (b) =>
      (b.onclick = () => {
        partyDetails(Number(b.dataset.switch));
      }),
  );
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
function partyDetails(index: number) {
  const mon = save.party[index];
  const name = engine.species(mon.species).name;
  const held = Object.keys(heldItems).find(
    (key) => heldItems[key] === mon.item,
  );
  const status =
    mon.hp === 0
      ? "Fainted"
      : mon.status & 7
        ? "Asleep"
        : mon.status & 8
          ? "Poisoned"
          : mon.status & 16
            ? "Burned"
            : mon.status & 32
              ? "Frozen"
              : mon.status & 64
                ? "Paralyzed"
                : "Healthy";
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
  p.querySelector("#back")!.addEventListener("click", () => view("party"));
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
  mode = "menu";
  const p = panel(
    layer,
    "Choose a Pokémon",
    `<p>Use ${escapeHtml(item.replaceAll("_", " "))} on whom?</p><div class="list">${save.party.map((m, i) => `<button data-target="${i}">${escapeHtml(engine.species(m.species).name)} · Lv ${m.level} · HP ${m.hp}/${m.stats[0]}</button>`).join("")}</div><button class="secondary" id="back">Back</button>`,
  );
  p.querySelector("#back")!.addEventListener("click", () => view("bag"));
  p.querySelectorAll<HTMLButtonElement>("[data-target]").forEach(
    (b) =>
      (b.onclick = () => {
        const index = Number(b.dataset.target),
          mon = save.party[index];
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
          if (mon.item) {
            message("This Pokémon is already holding an item.", () =>
              view("bag"),
            );
            return;
          }
          mon.item = heldItems[item];
          save.items[item]--;
          persist();
          message(
            `${engine.species(mon.species).name} is holding ${item.replaceAll("_", " ")}.`,
            () => view("bag"),
          );
          return;
        }
        if (isMedicine(item)) {
          const healed = useMedicine(item, mon, engine);
          if (!healed) {
            message("That Pokémon does not need this medicine.", () =>
              view("bag"),
            );
            return;
          }
          save.party[index] = healed;
          save.items[item]--;
          persist();
          message(
            `${engine.species(mon.species).name} used the ${itemName(item)}. HP ${healed.hp}/${healed.stats[0]}.`,
            () => view("bag"),
          );
          return;
        }
        const evo = engine
          .evolutionData(mon.species)
          .evolutions.find(
            (e) =>
              (e.method === 2 && e.parameter === stones[item]) ||
              (e.method === 3 &&
                item === "link_cable" &&
                (e.parameter === 255 || e.parameter === mon.item)),
          );
        if (!evo) {
          message("It will not have an effect.", () => view("bag"));
          return;
        }
        save.party[index] = engine.evolvePokemon(mon, evo.species);
        if (evo.method === 3 && evo.parameter !== 255)
          save.party[index].item = 0;
        save.items[item]--;
        if (!save.seen.includes(evo.species)) save.seen.push(evo.species);
        if (!save.caught.includes(evo.species)) save.caught.push(evo.species);
        persist();
        message(
          `${engine.species(mon.species).name} evolved into ${engine.species(evo.species).name}!`,
          () => view("bag"),
        );
      }),
  );
}
function startBattle(species: number, level: number, o?: WorldObject) {
  try {
    battleObject = o;
    battleSpecies = species;
    if (!save.seen.includes(species)) save.seen.push(species);
    const opponent =
      o?.trainer && o.kind !== "legendary"
        ? {
            party: o.trainer.team.map((m, i) =>
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
      training: !!o?.trainer && o.kind !== "legendary",
      money: save.money,
      badges: (1 << save.badges) - 1,
      seen: save.seen,
      caught: save.caught,
    });
    mode = "encounter";
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
      save.x = 12.5;
      save.y = 8.5;
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
      if (victory) message(victory, wrapUp, battleObject?.name);
      else wrapUp();
      return;
    }
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
      wrapUp,
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
    sound: (id) => sound.soundEffect(id),
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
  const p = panel(
    layer,
    "Hall of Fame",
    `<p>The team that brought the dawn back to Astra.</p><div class="hall-party">${(save.hallOfFame || save.party).map((m) => `<div><img alt="" src="${sprite(m.species)}"><span>${escapeHtml(engine.species(m.species).name)}<br>Lv ${m.level}</span></div>`).join("")}</div><p class="small">The Aurora Trail is open south of Dewdrop Village.</p><button id="continue">Continue exploring</button>`,
    "champion-record",
  );
  p.querySelector("#continue")!.addEventListener("click", done);
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
          p.querySelector("#evolve")!.addEventListener("click", () => {
            save.party[index] = engine.evolvePokemon(
              current,
              evolution.species,
            );
            if (!save.seen.includes(evolution.species))
              save.seen.push(evolution.species);
            if (!save.caught.includes(evolution.species))
              save.caught.push(evolution.species);
            persist();
            next();
          });
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
  const map = WORLD[save.map];
  return (
    connectedBlocked(map, x, y, save.abilities.includes("surf"), (e) =>
      has(e.requires),
    ) || actors.solid(map, x, y)
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
  );
}
function update(dt: number) {
  if (mode !== "world") return;
  const currentMap = WORLD[save.map];
  actors.update(currentMap, dt, save);
  if (actors.approaching) {
    const challenger = actors.approach(currentMap, dt, save);
    if (challenger) challengeTrainer(challenger);
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
      sound.cue("notice");
      return;
    }
  }
  if (input.hit("a")) {
    interact();
    return;
  }
  if (input.hit("menu") || input.hit("b")) {
    menu();
    return;
  }
  const moving = (a: "right" | "left" | "down" | "up") =>
    Number(input.held(a) || input.hit(a));
  let dx = moving("right") - moving("left"),
    dy = moving("down") - moving("up");
  if (!dx && !dy) return;
  const len = Math.hypot(dx, dy);
  dx /= len;
  dy /= len;
  save.facing =
    Math.abs(dx) > Math.abs(dy)
      ? dx > 0
        ? "right"
        : "left"
      : dy > 0
        ? "down"
        : "up";
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
  }
  const moved = Math.hypot(save.x - oldX, save.y - oldY);
  if (moved === 0) return;
  const map = WORLD[save.map];
  const exit =
    connectionAt(map, save.x, save.y) ||
    map.exits.find((e) => {
      if (!e.direction)
        return Math.floor(save.x) === e.x && Math.floor(save.y) === e.y;
      if (has(e.requires)) return false;
      const width = (e.span ?? 1) + 0.3;
      if (e.direction === "west")
        return dx < 0 && save.x < 0.6 && Math.abs(save.y - e.y - 0.5) < width;
      if (e.direction === "east")
        return (
          dx > 0 &&
          save.x > map.width - 0.6 &&
          Math.abs(save.y - e.y - 0.5) < width
        );
      if (e.direction === "north")
        return dy < 0 && save.y < 0.6 && Math.abs(save.x - e.x - 0.5) < width;
      return (
        dy > 0 &&
        save.y > map.height - 0.6 &&
        Math.abs(save.x - e.x - 0.5) < width
      );
    });
  if (!exit) exitLock = false;
  else if (!exitLock || (exit.direction && has(exit.requires))) {
    exitLock = true;
    if (!has(exit.requires)) {
      const key = `gate_${map.id}_${exit.to}`,
        newlyFound = !save.flags.includes(key);
      flag(key);
      persist();
      message(
        (exit.lockedDialogue || "The way is closed.") +
          (newlyFound ? " Marked in your journal." : ""),
      );
      return;
    }
    depart(exit.to, () => {
      const arrival = crossConnection(map, exit, save.x, save.y);
      save.map = exit.to;
      save.x = arrival.x;
      save.y = arrival.y;
      actors.enter(WORLD[save.map]);
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
      const minWeight = Math.min(...map.encounters.map((e) => e.weight));
      const pool = lured
        ? map.encounters.filter((e) => e.weight === minWeight)
        : map.encounters;
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
    const back = layer.querySelector<HTMLButtonElement>("#back, #later");
    if (back) back.click();
    else close();
  } else if (mode === "menu" && input.hit("menu")) close();
  else if (mode === "battle" && input.hit("b")) battlePresenter?.back();
  else if (!["world", "loading", "dialogue"].includes(mode)) {
    menuInput.update(layer, input, now, mode === "battle");
  }
  if (wasWorld) update(dt);
  const screen = canvas.parentElement!;
  screen.dataset.scene = ["welcome", "title", "intro", "loading"].includes(mode)
    ? "title"
    : mode;
  actors.enter(WORLD[save.map]);
  if (WORLD[save.map])
    renderer.render(
      WORLD[save.map],
      save.x,
      save.y,
      save.facing,
      now,
      save.flags,
      { npcs: actors.states, hideHud: mode !== "world" },
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
      .register("/sw.js", { updateViaCache: "none" })
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
