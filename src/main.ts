import { Input } from "./game/input";
import { Renderer } from "./game/render";
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
  renderer = new Renderer(canvas);
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
  levelsBefore: number[] = [],
  partyBefore: any[] = [],
  lastAutosave = 0,
  battleCategory = "",
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
      c.width = pixels.width;
      c.height = pixels.height;
      c.getContext("2d")!.putImageData(pixels, 0, 0);
      spriteCache.set(key, c.toDataURL());
    } catch {
      return "";
    }
  }
  return spriteCache.get(key)!;
}
function cry(id: number) {
  try {
    const data = engine.cry(id),
      ctx = new AudioContext(),
      buffer = ctx.createBuffer(1, data.length, 47662);
    buffer.copyToChannel(new Float32Array(data), 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => void ctx.close();
    source.start();
  } catch {}
}
let musicContext: AudioContext | undefined,
  musicTimer: number | undefined,
  musicNext = 0,
  musicScene = "",
  musicPlaying = false;
function scene() {
  if (mode === "battle")
    return battleObject?.trainer
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
const tracks: Record<string, [number, number]> = {
  town: [0x3a, 0x72d3],
  route: [0x3c, 0x4386],
  cave: [0x3a, 0x62be],
  center: [0x3b, 0x55c6],
  wild: [0x3d, 0x5dc5],
  trainer: [0x3d, 0x6096],
  gym: [0x3a, 0x650d],
  champion: [0x3a, 0x69c1],
};
function scheduleMusic() {
  if (!musicPlaying || !musicContext) return;
  try {
    const current = scene();
    if (current !== musicScene) {
      musicScene = current;
      engine.startMusic(...tracks[current]);
      musicNext = musicContext.currentTime;
    }
    while (musicNext < musicContext.currentTime + 0.8) {
      const data = engine.nextMusicChunk(24000),
        buffer = musicContext.createBuffer(1, data.length, 48000);
      buffer.copyToChannel(new Float32Array(data), 0);
      const source = musicContext.createBufferSource(),
        gain = musicContext.createGain();
      gain.gain.value = 0.15;
      source.buffer = buffer;
      source.connect(gain).connect(musicContext.destination);
      source.start(musicNext);
      musicNext += buffer.duration;
    }
    musicTimer = window.setTimeout(scheduleMusic, 250);
  } catch {
    musicPlaying = false;
  }
}
function toggleMusic() {
  if (musicPlaying) {
    musicPlaying = false;
    if (musicTimer) clearTimeout(musicTimer);
    void musicContext?.close();
    musicContext = undefined;
    musicScene = "";
    return;
  }
  try {
    musicContext = new AudioContext();
    musicPlaying = true;
    musicNext = 0;
    scheduleMusic();
  } catch {
    musicPlaying = false;
  }
}
const flag = (f?: string) => {
  if (f && !save.flags.includes(f)) save.flags.push(f);
};
function persist() {
  void set("save", save);
}
function message(text: string, callback?: () => void) {
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
    layer.innerHTML = `<div class="dialogue" role="status">${escapeHtml(next)}</div>`;
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
    `<p>The beacons of Astra are fading. Choose a partner, explore a new region, and follow the light of the Aurora Current.</p><div class="drop" id="drop"><p><strong>Bring your own Pokémon Crystal ROM</strong><br><span class="small muted">Your ROM stays in this browser, stored locally. It is never uploaded.</span></p><label class="file-label">Choose ROM<input id="rom" type="file" accept=".gbc,application/octet-stream"></label><p class="small muted">or drop your file here</p></div>${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}<p class="small muted">A compatible Pokémon Crystal ROM is required to play.</p>`,
  );
  const file = p.querySelector<HTMLInputElement>("#rom")!;
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
  const existing = await get<Save>("save");
  if (isValidSave(existing)) {
    save = normalizeSavePosition(existing);
    renderer.setNight(!!save.settings.night);
    title();
  } else {
    save = freshSave();
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
  });
  p.querySelector("#new")!.addEventListener("click", () => {
    const confirm = panel(
      layer,
      "Start a new adventure?",
      `<p>Your existing browser save will be replaced when the new adventure begins. Export a backup first if you want to keep it.</p><div class="buttons"><button class="secondary" id="cancel">Keep my journey</button><button id="confirm">Start over</button></div>`,
    );
    confirm.querySelector("#cancel")!.addEventListener("click", title);
    confirm.querySelector("#confirm")!.addEventListener("click", () => {
      save = freshSave();
      intro();
    });
  });
}
function intro() {
  mode = "intro";
  const p = panel(
    layer,
    "The Astra region",
    `<p>Eight ancient beacons guide Pokémon along the Aurora Current. Lately, their lights have begun to fail.</p><p>Professor Alder is waiting in the lab. Find a partner and begin your survey.</p><div class="buttons"><button id="begin">Begin adventure</button></div>`,
  );
  p.querySelector("#begin")!.addEventListener("click", () => {
    mode = "world";
    layer.innerHTML = "";
    persist();
  });
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
        save.party = [engine.makePokemon(id, 6)];
        if (id === 58) {
          const slot = save.party[0].moves.findIndex(
            (move: number) => move === 0,
          );
          if (slot >= 0)
            save.party[0] = engine.teachMove(save.party[0], 52, slot);
        }
        cry(id);
        save.seen.push(id);
        save.caught.push(id);
        flag("partner");
        persist();
        message(
          `${engine.species(id).name} joined your party! Alder tutored your partner and gave you Poké Balls, Potions, running shoes and a journal.`,
        );
      }),
  );
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
  const tx = save.x + dx * 0.75,
    ty = save.y + dy * 0.75;
  const o = map.objects
    .map((o) => ({ o, d: Math.hypot(o.x + 0.5 - tx, o.y + 0.5 - ty) }))
    .filter((v) => v.d < 1.65)
    .sort((a, b) => a.d - b.d)[0]?.o;
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
    message("There is nothing to inspect here.");
    return;
  }
  if (!has(o.requires)) {
    message(o.lockedDialogue || "There is more to do before this opens.");
    return;
  }
  if (o.kind === "starter" && !save.flags.includes("partner")) {
    starter();
    return;
  }
  if (o.kind === "healer") {
    save.center = save.map;
    save.party = save.party.map((m) => engine.healPokemon(m));
    persist();
    message("Your Pokémon are fully rested. Take care out there!");
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
    if (!save.party.length) {
      message("Visit Professor Alder and choose a partner first.");
      return;
    }
    if (o.id === "league_0" && !save.flags.includes("league_0_won"))
      save.party = save.party.map((m) => engine.healPokemon(m));
    message(o.dialogue, () =>
      startBattle(o.trainer!.team[0].species, o.trainer!.team[0].level, o),
    );
    return;
  }
  if (o.kind === "legendary" && !save.flags.includes(o.setsFlag || o.id)) {
    const species = o.reward?.species;
    if (species) {
      message(o.dialogue, () => startBattle(species, o.reward?.level || 50, o));
      return;
    }
  }
  if (o.setsFlag && save.flags.includes(o.setsFlag) && !o.repeatable) {
    message(`${o.name}: Already completed.`);
    return;
  }
  flag(o.setsFlag);
  applyReward(o.reward);
  persist();
  message(o.dialogue);
}
function shop() {
  mode = "menu";
  const stock: [string, string, number, number][] = [
    ["poke_ball", "Poké Ball", 200, 0],
    ["potion", "Potion", 300, 0],
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
          `<button data-item="${id}" data-cost="${cost}">${name} · ₽${cost}</button>`,
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
function nextObjective() {
  if (!save.flags.includes("partner"))
    return "Meet Professor Alder in the Dewdrop lab and choose a partner.";
  const story: [string, string][] = [
    [
      "surveyor",
      "Rescue the surveyor in Lantern Wood, then challenge Fern in Bramble.",
    ],
    [
      "fog_signal",
      "Repair the fog signal in Undertow Cave, then challenge Marina in Tideglass.",
    ],
    [
      "power_restored",
      "Investigate the power theft in Copperworks, then challenge Volt in Copperwick.",
    ],
    [
      "lens_restored",
      "Restore the lens in Hourglass Ruins, then challenge Sable in Sunspire.",
    ],
    [
      "pokemon_freed",
      "Help the Reedhaven ranger, free the Pokémon in Ember Mine, then challenge Flint.",
    ],
    [
      "pass_open",
      "Reopen Frostvault passage, then challenge Neve in Rimepeak.",
    ],
    [
      "revelation",
      "Discover the truth in Echo Bell Tower, then challenge Lyra in Bellweather.",
    ],
    [
      "engine_stopped",
      "Stop the Celestial Engine at Starfall Observatory, then challenge Orion in Aster.",
    ],
  ];
  if (save.badges < 8) {
    const [flagName, text] = story[save.badges];
    return save.flags.includes(flagName)
      ? `Complete the gym puzzle and challenge ${["Fern in Bramble", "Marina in Tideglass", "Volt in Copperwick", "Sable in Sunspire", "Flint in Cinderfall", "Neve in Rimepeak", "Lyra in Bellweather", "Orion in Aster"][save.badges]}.`
      : text;
  }
  if (!save.flags.includes("ascent_complete"))
    return "Reach Crown Summit and complete Victory Ascent.";
  if (!save.flags.includes("champion"))
    return "Challenge the Astral League at Crown Summit.";
  if (!save.flags.includes("aurora_restored"))
    return "Explore Aurora Sanctuary and restore the Aurora Current.";
  return "Complete the Living Atlas and discover Astra’s remaining secrets.";
}
function menu() {
  mode = "menu";
  const p = panel(
    layer,
    "Your journey",
    `<p>${escapeHtml(WORLD[save.map].name)} · ${save.badges} / 8 badges · ₽${save.money}</p><div class="menu-grid"><button data-view="party">Party</button><button data-view="bag">Bag</button><button data-view="dex">Pokédex</button><button data-view="journal">Journal</button><button data-view="map">Map &amp; travel</button><button data-view="storage">Storage</button><button data-view="settings">Settings &amp; save</button><button data-view="close">Resume</button></div>`,
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
function view(v: string) {
  mode = "menu";
  let title = "",
    body = "";
  if (v === "party") {
    title = "Your party";
    body = save.party.length
      ? save.party
          .map(
            (m, i) =>
              `<button data-switch="${i}">${escapeHtml(engine.species(m.species).name)} · Lv ${m.level}<br><span class="small">HP ${m.hp} / ${m.stats?.[0] ?? "?"}</span></button>`,
          )
          .join("")
      : "<p>Your party is empty. Visit Alder in the lab.</p>";
    body = `<p class="small">Select a Pokémon to move it to the front.</p><div class="list">${body}</div>`;
  } else if (v === "bag") {
    title = "Your bag";
    body = `<p class="small">Choose a Potion, evolution stone or Link Cable to use it.</p><div class="list">${Object.entries(
      save.items,
    )
      .filter(([, n]) => n > 0)
      .map(
        ([k, n]) =>
          `<button data-use="${escapeHtml(k)}">${escapeHtml(k.replaceAll("_", " "))} × ${n}</button>`,
      )
      .join("")}</div>`;
  } else if (v === "dex") {
    title = `Pokédex · ${save.caught.length} / 251`;
    body = `<p class="small">Seen ${save.seen.length} · Caught ${save.caught.length}</p><div class="list">${Array.from(
      { length: 251 },
      (_, i) => {
        const id = i + 1;
        return `<div>${String(id).padStart(3, "0")} &nbsp; ${save.seen.includes(id) ? escapeHtml(engine.species(id).name) : "— — —"} ${save.caught.includes(id) ? "✦" : ""} ${
          save.seen.includes(id)
            ? `<span class="small muted">${escapeHtml(
                Object.values(WORLD)
                  .filter((m) => m.encounters.some((e) => e.species === id))
                  .slice(0, 3)
                  .map((m) => m.name)
                  .join(", ") || "Special encounter",
              )}</span>`
            : ""
        }</div>`;
      },
    ).join("")}</div>`;
  } else if (v === "journal") {
    title = "Beacon journal";
    body = `<p><strong>Next objective</strong><br>${escapeHtml(nextObjective())}</p><p>${save.badges ? BADGES.slice(0, save.badges).join(" · ") : "Begin your survey with Professor Alder."}</p><div class="list">${QUESTS.map((q) => `<div><strong>${save.flags.includes(q.completedFlag) ? "✓" : "○"} ${escapeHtml(q.name)}</strong><br><span class="small muted">${escapeHtml(q.description)}</span></div>`).join("")}</div>`;
  } else if (v === "map") {
    title = "Astra region";
    body = `<p class="small">Places visited: ${save.visited.length}. ${save.abilities.includes("fly") ? "Choose a place to fly." : ""}</p><div class="list">${save.visited.map((id) => `<button data-travel="${id}" ${save.abilities.includes("fly") ? "" : "disabled"}>${escapeHtml(WORLD[id]?.name || id)}</button>`).join("")}</div>`;
  } else if (v === "storage") {
    title = "Pokémon storage";
    body = `<p class="small">Deposit a party member to make room for captures. Select a stored Pokémon to withdraw it.</p><strong>Party</strong><div class="list">${save.party.map((m, i) => `<button data-deposit="${i}">Deposit ${escapeHtml(engine.species(m.species).name)} · Lv ${m.level}</button>`).join("")}</div><strong>Storage</strong><div class="list">${save.storage.map((m, i) => `<button data-store="${i}">Withdraw ${escapeHtml(engine.species(m.species).name)} · Lv ${m.level}</button>`).join("") || "<p>No Pokémon in storage yet.</p>"}</div>`;
  } else {
    title = "Settings & save";
    body = `<p>Battle speed: ${save.settings.battleSpeed}×</p><div class="buttons"><button id="speed">Change speed</button><button id="time">${save.settings.night ? "Switch to day" : "Camp until night"}</button><button id="music">${musicPlaying ? "Mute music" : "Play music"}</button><button id="export">Export save</button><label class="file-label">Import save<input id="import" type="file" accept="application/json,.json"></label></div><p class="small muted">Controller: ${escapeHtml(
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
  p.querySelector("#back")!.addEventListener("click", menu);
  p.querySelectorAll<HTMLButtonElement>("[data-use]").forEach(
    (b) => (b.onclick = () => useItem(b.dataset.use!)),
  );
  p.querySelectorAll<HTMLButtonElement>("[data-switch]").forEach(
    (b) =>
      (b.onclick = () => {
        const i = Number(b.dataset.switch);
        [save.party[0], save.party[i]] = [save.party[i], save.party[0]];
        persist();
        view(v);
      }),
  );
  p.querySelectorAll<HTMLButtonElement>("[data-deposit]").forEach(
    (b) =>
      (b.onclick = () => {
        if (save.party.length <= 1) {
          message("Keep at least one Pokémon in your party.", () =>
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
      (b.onclick = () => {
        save.map = b.dataset.travel!;
        save.x = 12.5;
        save.y = 8.5;
        save = normalizeSavePosition(save);
        exitLock = true;
        close();
      }),
  );
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
    .querySelector<HTMLInputElement>("#import")
    ?.addEventListener("change", async (e) => {
      try {
        const f = (e.target as HTMLInputElement).files?.[0];
        if (!f) return;
        const data = JSON.parse(await f.text()) as Save;
        if (!isValidSave(data)) throw Error("Invalid save");
        save = normalizeSavePosition(data);
        renderer.setNight(!!save.settings.night);
        exitLock = true;
        persist();
        message("Save imported successfully.");
      } catch {
        message("This save file could not be imported.", () =>
          view("settings"),
        );
      }
    });
}
function useItem(item: string) {
  if (item === "repel") {
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
        const held: Record<string, number> = {
          metal_coat: 143,
          dragon_scale: 151,
          kings_rock: 82,
          up_grade: 172,
        };
        if (held[item]) {
          if (mon.item) {
            message("This Pokémon is already holding an item.", () =>
              view("bag"),
            );
            return;
          }
          mon.item = held[item];
          save.items[item]--;
          persist();
          message(
            `${engine.species(mon.species).name} is holding ${item.replaceAll("_", " ")}.`,
            () => view("bag"),
          );
          return;
        }
        if (item === "potion") {
          if (mon.hp <= 0 || mon.hp >= mon.stats[0]) {
            message("That Pokémon cannot use a Potion now.", () => view("bag"));
            return;
          }
          mon.hp = Math.min(mon.stats[0], mon.hp + 20);
          save.items[item]--;
          persist();
          message("HP was restored.", () => view("bag"));
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
    battleCategory = "";
    levelsBefore = save.party.map((m) => m.level);
    partyBefore = structuredClone(save.party);
    if (!save.seen.includes(species)) save.seen.push(species);
    const opponent =
      o?.trainer && o.kind !== "legendary"
        ? {
            party: o.trainer.team.map((m) =>
              engine.makePokemon(m.species, m.level),
            ),
          }
        : { species, level };
    battle = engine.startBattle({
      party: save.party,
      opponent,
      balls: Object.entries(ballIds).map(
        ([key, id]) => [id, save.items[key] || 0] as [number, number],
      ),
      items: [[18, save.items.potion || 0]],
      money: save.money,
      badges: (1 << save.badges) - 1,
      seen: save.seen,
      caught: save.caught,
    });
    showBattle();
  } catch (e) {
    message(
      `Battle could not start: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}
function battleText(event: any) {
  const m = event?.Message;
  if (!m) return "";
  if (typeof m === "string")
    return (
      (
        {
          CriticalHit: "A critical hit!",
          SuperEffective: "It is super effective!",
          NotVeryEffective: "It is not very effective.",
          BallBrokeFree: "Oh no! The Pokémon broke free!",
          BallAppearedCaught: "It looked like it was caught!",
          BallAlmostHadIt: "Almost had it!",
          BallSoClose: "So close! One more try?",
          BallBlocked: "The trainer blocked the ball!",
          BallDontBeAThief: "You cannot catch another trainer's Pokémon.",
        } as Record<string, string>
      )[m] || m.replace(/([a-z])([A-Z])/g, "$1 $2")
    );
  const [kind, data] = Object.entries(m)[0] as [string, any];
  if (kind === "UsedMove")
    return `${data.user.name} used ${engine.move(data.mv).name}!`;
  if (kind === "GainedExp") return `${data.mon} gained ${data.exp} EXP!`;
  if (kind === "MonFainted" || kind === "EnemyMonFainted")
    return `${data.mon} fainted!`;
  if (kind === "AttackMissed") return `${data.user.name}'s attack missed!`;
  if (kind === "WildAppeared") return `Wild ${data.mon} appeared!`;
  if (kind === "EnemySentOut") return `The trainer sent out ${data.mon}!`;
  if (kind === "PlayerSentOut") return `Go, ${data.mon}!`;
  return kind.replace(/([a-z])([A-Z])/g, "$1 $2");
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
    save.items.potion =
      result.bag.items.find((v: [number, number]) => v[0] === 18)?.[1] || 0;
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
    if (
      !won &&
      ["lose", "loss", "lost", "defeat"].includes(s.outcome.toLowerCase())
    ) {
      save.party = save.party.map((m) => engine.healPokemon(m));
      if (battleObject?.id.startsWith("league_"))
        save.flags = save.flags.filter((f) => !/^league_[0-3]_won$/.test(f));
      save.map =
        save.center && WORLD[save.center] ? save.center : "dewdrop_center";
      save.x = 12.5;
      save.y = 8.5;
      save = normalizeSavePosition(save);
      exitLock = true;
    }
    persist();
    const victory = won ? battleObject?.victoryDialogue : undefined;
    message(
      caughtSpecies
        ? `${engine.species(caughtSpecies).name} was caught!`
        : `Battle finished: ${s.outcome}.`,
      () =>
        victory
          ? message(victory, () => postBattle(result.may_evolve))
          : postBattle(result.may_evolve),
    );
    return;
  }
  const a = s.state.player.active,
    e = s.state.enemy.active;
  const learnEvent = s.events
    .map((x: any) => x.Message?.AskForgetMove)
    .find(Boolean);
  const learningMon = learnEvent
    ? s.state.player.party?.[s.state.player.active_slot] || a
    : a;
  const actions = s.legal as any[];
  const label = (v: any) => {
    if (typeof v === "string") return v;
    const [key, value] = Object.entries(v)[0] as [string, any];
    if (key === "Move")
      return `${engine.move(a.moves[value.slot]).name} · PP ${a.pp[value.slot]}`;
    if (key === "Switch" || key === "ForcedSwitch")
      return `Switch: ${engine.species(save.party[value.slot]?.species || 1).name}`;
    if (key === "Item")
      return `Use ${
        Object.entries(ballIds)
          .find(([, id]) => id === value.id)?.[0]
          .replaceAll("_", " ") ||
        (value.id === 18 ? "Potion" : `item ${value.id}`)
      }`;
    if (key === "LearnMove")
      return value.slot === null
        ? "Keep current moves"
        : `Forget ${engine.move(learningMon.moves[value.slot]).name}`;
    if (key === "OfferSwitch")
      return value.keep ? "Keep battling" : `Switch Pokémon`;
    return key;
  };
  const group = (v: any) => {
    const k = typeof v === "string" ? v : Object.keys(v)[0];
    return k === "Move" || k === "Fight"
      ? "FIGHT"
      : k === "Item"
        ? "BAG"
        : k === "Switch"
          ? "PARTY"
          : k === "Run"
            ? "RUN"
            : "";
  };
  const standard = s.site === "BattleMenu";
  const visible =
    standard && battleCategory
      ? actions
          .map((v, i) => ({ v, i }))
          .filter(({ v }) => group(v) === battleCategory)
      : actions.map((v, i) => ({ v, i }));
  const controls =
    standard && !battleCategory
      ? ["FIGHT", "BAG", "PARTY", "RUN"]
          .filter((g) => actions.some((v) => group(v) === g))
          .map((g) => `<button data-group="${g}">${g}</button>`)
          .join("")
      : visible
          .map(
            ({ v, i }) =>
              `<button data-action-index="${i}">${escapeHtml(label(v))}</button>`,
          )
          .join("") + (standard ? "<button data-back>Back</button>" : "");
  const p = panel(
    layer,
    `${battleObject?.trainer?.name || "Wild Pokémon"} battle`,
    `<div class="battle-sprites"><img src="${sprite(a.species, true)}" alt=""><img src="${sprite(e.species)}" alt=""></div><div class="battle-hud"><div><strong>${escapeHtml(engine.species(e.species).name)}</strong> · Lv ${e.level}<progress max="${e.max_hp}" value="${e.hp}"></progress><span>${e.hp} / ${e.max_hp}</span></div><div><strong>${escapeHtml(engine.species(a.species).name)}</strong> · Lv ${a.level}<progress max="${a.max_hp}" value="${a.hp}"></progress><span>${a.hp} / ${a.max_hp}</span></div></div><p class="small muted">${escapeHtml(s.events.map(battleText).filter(Boolean).slice(-4).join(" · "))}</p>${s.site === "LearnMove" ? `<p>${escapeHtml(learnEvent?.mon || "Your Pokémon")} wants to learn ${learnEvent ? escapeHtml(engine.move(learnEvent.mv).name) : "a move"}. Choose a move to forget, or keep your current moves.</p>` : ""}<div class="menu-grid">${controls}</div>`,
    "battle-panel",
  );
  p.style.setProperty(
    "--battle-duration",
    `${450 / save.settings.battleSpeed}ms`,
  );
  p.querySelectorAll<HTMLButtonElement>("[data-group]").forEach(
    (b) =>
      (b.onclick = () => {
        battleCategory = b.dataset.group!;
        showBattle();
      }),
  );
  p.querySelector("[data-back]")?.addEventListener("click", () => {
    battleCategory = "";
    showBattle();
  });
  p.querySelectorAll<HTMLButtonElement>("[data-action-index]").forEach(
    (b) =>
      (b.onclick = () => {
        try {
          battle.act(Number(b.dataset.actionIndex));
          battleCategory = "";
          showBattle();
        } catch (e) {
          message(
            `Battle error: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }),
  );
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
  const map = WORLD[save.map],
    r = 0.22;
  return [
    [x - r, y - r],
    [x + r, y - r],
    [x - r, y + r],
    [x + r, y + r],
  ].some(([px, py]) => {
    const t = map.tiles[Math.floor(py)]?.[Math.floor(px)];
    return (
      !t ||
      "#rwBCPTS".includes(t) ||
      (t === "~" && !save.abilities.includes("surf"))
    );
  });
}
function update(dt: number) {
  if (mode !== "world") return;
  if (input.hit("a")) {
    interact();
    return;
  }
  if (input.hit("menu") || input.hit("b")) {
    menu();
    return;
  }
  let dx = Number(input.held("right")) - Number(input.held("left")),
    dy = Number(input.held("down")) - Number(input.held("up"));
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
  const dist = dt * (input.held("speed") ? 5 : 3.2);
  const oldX = save.x,
    oldY = save.y;
  const nx = save.x + dx * dist,
    ny = save.y + dy * dist;
  if (!blocked(nx, save.y)) save.x = nx;
  if (!blocked(save.x, ny)) save.y = ny;
  const moved = Math.hypot(save.x - oldX, save.y - oldY);
  if (moved === 0) return;
  const map = WORLD[save.map];
  const exit = map.exits.find(
    (e) => Math.floor(save.x) === e.x && Math.floor(save.y) === e.y,
  );
  if (!exit) exitLock = false;
  else if (!exitLock) {
    exitLock = true;
    if (!has(exit.requires)) {
      message(exit.lockedDialogue || "The way is closed.");
      return;
    }
    save.map = exit.to;
    save.x = exit.toX + 0.5;
    save.y = exit.toY + 0.5;
    if (!save.visited.includes(save.map) && WORLD[save.map].kind === "town")
      save.visited.push(save.map);
    renderer.cameraX = 0;
    renderer.cameraY = 0;
    persist();
    return;
  }
  if (save.repel) save.repel = Math.max(0, save.repel - moved);
  if (
    map.tiles[Math.floor(save.y)]?.[Math.floor(save.x)] === "g" &&
    save.party.length &&
    !save.repel
  ) {
    encounterDistance += moved;
    if (encounterDistance >= encounterTarget && map.encounters.length) {
      encounterDistance = 0;
      encounterTarget = 8 + Math.random() * 14;
      const total = map.encounters.reduce((n, e) => n + e.weight, 0);
      let roll = Math.random() * total;
      const e =
        map.encounters.find((e) => (roll -= e.weight) < 0) || map.encounters[0];
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
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  input.update();
  const wasWorld = mode === "world";
  if (mode === "dialogue" && (input.hit("a") || input.hit("b"))) advance();
  else if (mode === "menu" && input.hit("b")) close();
  else if (!["world", "loading", "dialogue"].includes(mode)) {
    const buttons = Array.from(
      layer.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
    );
    if (buttons.length) {
      const current = buttons.indexOf(
        document.activeElement as HTMLButtonElement,
      );
      if (input.hit("down") || input.hit("right"))
        buttons[(current + 1) % buttons.length].focus();
      if (input.hit("up") || input.hit("left"))
        buttons[
          (current < 0 ? 0 : current - 1 + buttons.length) % buttons.length
        ].focus();
      if (input.hit("a")) buttons[current < 0 ? 0 : current]?.click();
    }
  }
  if (wasWorld) update(dt);
  if (WORLD[save.map])
    renderer.render(
      WORLD[save.map],
      save.x,
      save.y,
      save.facing,
      now,
      save.flags,
    );
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if ("serviceWorker" in navigator)
  window.addEventListener("load", () => {
    if (import.meta.env.PROD) void navigator.serviceWorker.register("/sw.js");
    else
      void navigator.serviceWorker
        .getRegistrations()
        .then((rs) => Promise.all(rs.map((r) => r.unregister())));
  });
void get<Uint8Array>("rom")
  .then((rom) => (rom ? start(rom).catch(() => welcome()) : welcome()))
  .catch(() => welcome());
