/** Pokémon Astra's authored campaign. Species numbers use the National Pokédex. */
export type Ability =
  | "cut"
  | "surf"
  | "flash"
  | "strength"
  | "rockSmash"
  | "whirlpool"
  | "waterfall"
  | "fly";
export interface Requirement {
  flags?: string[];
  badges?: number;
  ability?: Ability;
  caught?: number;
  items?: string[];
  species?: number[];
  types?: { type: string; count: number }[];
}
export interface TeamMember {
  species: number;
  level: number;
}
export interface Trainer {
  id: string;
  name: string;
  team: TeamMember[];
  reward?: number;
}
export interface Reward {
  items?: { item: string; amount?: number }[];
  item?: string;
  amount?: number;
  species?: number;
  level?: number;
  badge?: number;
  ability?: Ability;
  money?: number;
}
export type ObjectKind =
  | "person"
  | "sign"
  | "item"
  | "switch"
  | "trainer"
  | "leader"
  | "legendary"
  | "healer"
  | "shop"
  | "starter"
  | "gate";
export type Direction = "north" | "south" | "east" | "west";
export interface WorldObject {
  id: string;
  kind: ObjectKind;
  x: number;
  y: number;
  name: string;
  dialogue: string;
  requires?: Requirement;
  lockedDialogue?: string;
  victoryDialogue?: string;
  setsFlag?: string;
  reward?: Reward;
  trainer?: Trainer;
  repeatable?: boolean;
  quest?: string;
  facing?: "up" | "down" | "left" | "right";
  roam?: number;
  sightRange?: number;
}
export interface Exit {
  direction?: Direction;
  span?: number;
  entrance?: "door" | "cave" | "stairs";
  x: number;
  y: number;
  to: string;
  toX: number;
  toY: number;
  requires?: Requirement;
  lockedDialogue?: string;
  label: string;
}
export interface Encounter {
  species: number;
  minLevel: number;
  maxLevel: number;
  weight: number;
}
export interface WorldMap {
  id: string;
  name: string;
  width: number;
  height: number;
  tiles: string[];
  palette: string;
  exits: Exit[];
  objects: WorldObject[];
  encounters: Encounter[];
  kind: "town" | "route" | "dungeon" | "gym" | "interior";
}
export interface Quest {
  id: string;
  name: string;
  description: string;
  prerequisite?: Requirement;
  completedFlag: string;
  reward: string;
}
export const ABILITIES: Ability[] = [
  "cut",
  "surf",
  "flash",
  "strength",
  "rockSmash",
  "whirlpool",
  "waterfall",
  "fly",
];
export const BADGES = [
  "Canopy",
  "Tidal",
  "Dynamo",
  "Mirage",
  "Ember",
  "Rime",
  "Chime",
  "Astral",
];
export const WORLD: Record<string, WorldMap> = {};
export const QUESTS: Quest[] = [];

// # is impassable; . is path/floor, g is encounter grass, ~ is decorative water.
function terrain(
  kind: WorldMap["kind"],
  W: number,
  H: number,
  variant = 0,
): string[] {
  const rows: string[][] = Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) =>
      x === 0 || y === 0 || x === W - 1 || y === H - 1 ? "#" : ".",
    ),
  );
  if (kind === "route") {
    for (let y = 2; y < H - 2; y++)
      for (let x = 2; x < W - 2; x++) {
        if (
          (y < Math.floor(H / 2) - 3 || y > Math.floor(H / 2) + 3) &&
          x > 3 &&
          x < W - 4 &&
          (x + y + variant) % 5 !== 0
        )
          rows[y][x] = "g";
      }
    for (let x = 3; x < W - 3; x++) {
      rows[5][x] = ".";
      rows[H - 6][x] = ".";
    }
  } else if (kind === "town") {
    for (const [x, y] of [
      [3, 5],
      [W - 4, 5],
      [3, H - 6],
      [W - 4, H - 6],
    ])
      rows[y][x] = "f";
  } else if (kind === "dungeon") {
    for (let y = 3; y < H - 3; y++)
      if (y !== Math.floor(H / 2) - 1 && y !== Math.floor(H / 2)) {
        rows[y][5] = "#";
        rows[y][W - 6] = "#";
      }
  }
  return rows.map((row) => row.join(""));
}
function map(
  id: string,
  name: string,
  kind: WorldMap["kind"],
  palette: string,
  variant = 0,
): WorldMap {
  const [W, H] =
    kind === "town"
      ? variant % 3 === 2
        ? [40, 32]
        : [32, 28]
      : kind === "route"
        ? variant % 3 === 1
          ? [28, 40]
          : [40, 24]
        : kind === "dungeon"
          ? [28, 24]
          : kind === "gym"
            ? [28, 24]
            : [24, 16];
  const value: WorldMap = {
    id,
    name,
    kind,
    palette,
    width: W,
    height: H,
    tiles: terrain(kind, W, H, variant),
    exits: [],
    objects: [],
    encounters: [],
  };
  WORLD[id] = value;
  return value;
}
function portalSlots(m: WorldMap): [number, number][] {
  const w = m.width,
    h = m.height,
    cx = Math.floor(w / 2),
    cy = Math.floor(h / 2);
  return [
    [1, cy],
    [w - 2, cy],
    [cx, 1],
    [cx, h - 2],
    [1, cy + 1],
    [w - 2, cy + 1],
    [cx - 1, 1],
    [cx + 1, h - 2],
    [1, cy - 1],
    [w - 2, cy - 1],
    [cx - 2, 1],
    [cx + 2, h - 2],
    [1, cy + 2],
    [w - 2, cy + 2],
    [cx - 3, 1],
    [cx + 3, h - 2],
  ];
}
function connect(
  a: string,
  b: string,
  labelA: string,
  labelB: string,
  requiresAB?: Requirement,
  requiresBA?: Requirement,
) {
  const left = WORLD[a],
    right = WORLD[b];
  const p = portalSlots(left)[left.exits.length],
    q = portalSlots(right)[right.exits.length];
  if (!p || !q) throw new Error(`Too many exits: ${a} or ${b}`);
  left.exits.push({
    x: p[0],
    y: p[1],
    to: b,
    toX: q[0],
    toY: q[1],
    label: labelA,
    requires: requiresAB,
    lockedDialogue: requiresAB
      ? "The way is closed. Check your journal for the next objective."
      : undefined,
  });
  right.exits.push({
    x: q[0],
    y: q[1],
    to: a,
    toX: p[0],
    toY: p[1],
    label: labelB,
    requires: requiresBA,
    lockedDialogue: requiresBA ? "A field ability is needed here." : undefined,
  });
}
function obj(
  mapId: string,
  value: Omit<WorldObject, "x" | "y"> & Partial<Pick<WorldObject, "x" | "y">>,
) {
  const m = WORLD[mapId];
  const slots: [[number, number], ...[number, number][]] = [
    [10, 7],
    [13, 7],
    [8, 8],
    [15, 8],
    [10, 10],
    [13, 10],
    [8, 6],
    [15, 6],
    [11, 5],
    [12, 11],
    [7, 7],
    [16, 7],
    [9, 9],
    [14, 9],
    [11, 9],
    [12, 9],
  ];
  const pos = slots[m.objects.length % slots.length];
  const dx = Math.floor((m.width - 24) / 2),
    dy = Math.floor((m.height - 16) / 2);
  m.objects.push({
    ...value,
    x: value.x ?? pos[0] + dx,
    y: value.y ?? pos[1] + dy,
  });
}
const townData: [string, string, string][] = [
  ["dewdrop", "Dewdrop Village", "meadow"],
  ["mossford", "Mossford", "orchard"],
  ["bramble", "Bramble Town", "autumn"],
  ["tideglass", "Tideglass Port", "coast"],
  ["copperwick", "Copperwick City", "industrial"],
  ["sunspire", "Sunspire Town", "desert"],
  ["reedhaven", "Reedhaven", "wetland"],
  ["cinderfall", "Cinderfall City", "volcanic"],
  ["rimepeak", "Rimepeak Village", "snow"],
  ["bellweather", "Bellweather City", "violet"],
  ["aster", "Aster City", "night"],
  ["crown", "Crown Summit", "mountain"],
];
townData.forEach(([id, name, palette], i) => map(id, name, "town", palette, i));
const routeData: [string, string, string, string, string][] = [
  ["01", "Dewpath", "dewdrop", "mossford", "meadow"],
  ["02", "Orchard Lane", "mossford", "bramble", "orchard"],
  ["03", "Lantern Approach", "bramble", "lantern_1", "autumn"],
  ["04", "Amberbank", "bramble", "tideglass", "autumn"],
  ["05", "Saltwind Coast", "tideglass", "undertow_1", "coast"],
  ["06", "Canal Road", "tideglass", "copperwick", "coast"],
  ["07", "Switchyard", "copperwick", "copperworks_1", "industrial"],
  ["08", "Saffron Dunes", "copperwick", "sunspire", "desert"],
  ["09", "Glassway", "sunspire", "hourglass_1", "desert"],
  ["10", "Reedwalk", "sunspire", "reedhaven", "wetland"],
  ["11", "Bamboo Reach", "reedhaven", "bamboo_1", "wetland"],
  ["12", "Ashen Trail", "reedhaven", "cinderfall", "volcanic"],
  ["13", "Ember Slope", "cinderfall", "ember_1", "volcanic"],
  ["14", "High Pass", "cinderfall", "rimepeak", "mountain"],
  ["15", "Snowmelt Road", "rimepeak", "frostvault_1", "snow"],
  ["16", "Bellflower Way", "rimepeak", "bellweather", "violet"],
  ["17", "Pilgrim Walk", "bellweather", "echo_1", "violet"],
  ["18", "Starlit Avenue", "bellweather", "aster", "night"],
  ["19", "Observatory Approach", "aster", "starfall_1", "night"],
  ["20", "Crown Road", "aster", "crown", "mountain"],
  ["21", "Dewdrop Grove", "dewdrop", "bramble", "meadow"],
  ["22", "Tidal Crossing", "tideglass", "reedhaven", "coast"],
  ["23", "Old Quarry", "mossford", "cinderfall", "mountain"],
  ["24", "Moonwater Reach", "tideglass", "bellweather", "coast"],
  ["25", "Aurora Trail", "dewdrop", "aurora_1", "night"],
];
routeData.forEach(([n, name, , , palette], i) =>
  map(`route${n}`, `Route ${n} · ${name}`, "route", palette, i),
);
const dungeonData: [string, string, string, string, string, string][] = [
  [
    "lantern",
    "Lantern Wood",
    "autumn",
    "wood trail marker",
    "survey_rope",
    "surveyor",
  ],
  [
    "undertow",
    "Undertow Cave",
    "coast",
    "tidal sluice",
    "low_tide",
    "fog_signal",
  ],
  [
    "copperworks",
    "Copperworks",
    "industrial",
    "power relay",
    "relay_on",
    "power_restored",
  ],
  [
    "hourglass",
    "Hourglass Ruins",
    "desert",
    "rotating runestone",
    "stone_aligned",
    "lens_restored",
  ],
  [
    "bamboo",
    "Bamboo Sanctuary",
    "wetland",
    "bridge winch",
    "bridge_lowered",
    "ranger_report",
  ],
  [
    "ember",
    "Ember Mine",
    "volcanic",
    "boulder winch",
    "mine_clear",
    "pokemon_freed",
  ],
  [
    "frostvault",
    "Frostvault Cavern",
    "snow",
    "thaw valve",
    "ice_thawed",
    "pass_open",
  ],
  [
    "echo",
    "Echo Bell Tower",
    "violet",
    "memory bell",
    "bell_rung",
    "revelation",
  ],
  [
    "meridian",
    "Meridian HQ",
    "industrial",
    "keycard terminal",
    "keycard",
    "vale_defeated",
  ],
  [
    "starfall",
    "Starfall Observatory",
    "night",
    "constellation switch",
    "stars_aligned",
    "last_lens",
  ],
  [
    "victory",
    "Victory Ascent",
    "mountain",
    "summit mechanism",
    "summit_open",
    "ascent_complete",
  ],
  [
    "aurora",
    "Aurora Sanctuary",
    "night",
    "research seal",
    "research_seal",
    "aurora_restored",
  ],
];
dungeonData.forEach(([id, name, palette]) => {
  for (let i = 1; i <= 3; i++)
    map(
      `${id}_${i}`,
      `${name} · ${["Entrance", "Depths", "Inner chamber"][i - 1]}`,
      "dungeon",
      palette,
      i,
    );
});
const leaders: [string, string, string, TeamMember[]][] = [
  [
    "Fern",
    "Bug",
    "bramble",
    [
      { species: 167, level: 11 },
      { species: 165, level: 11 },
      { species: 123, level: 13 },
    ],
  ],
  [
    "Marina",
    "Water",
    "tideglass",
    [
      { species: 194, level: 16 },
      { species: 120, level: 17 },
      { species: 117, level: 18 },
    ],
  ],
  [
    "Volt",
    "Electric",
    "copperwick",
    [
      { species: 100, level: 22 },
      { species: 81, level: 22 },
      { species: 181, level: 24 },
    ],
  ],
  [
    "Sable",
    "Ground",
    "sunspire",
    [
      { species: 27, level: 26 },
      { species: 207, level: 27 },
      { species: 232, level: 29 },
    ],
  ],
  [
    "Flint",
    "Fire",
    "cinderfall",
    [
      { species: 126, level: 33 },
      { species: 78, level: 34 },
      { species: 59, level: 36 },
    ],
  ],
  [
    "Neve",
    "Ice",
    "rimepeak",
    [
      { species: 215, level: 39 },
      { species: 87, level: 40 },
      { species: 221, level: 42 },
    ],
  ],
  [
    "Lyra",
    "Psychic",
    "bellweather",
    [
      { species: 178, level: 44 },
      { species: 122, level: 45 },
      { species: 196, level: 47 },
    ],
  ],
  [
    "Orion",
    "Dragon",
    "aster",
    [
      { species: 148, level: 49 },
      { species: 230, level: 50 },
      { species: 149, level: 52 },
    ],
  ],
];
leaders.forEach(([name, type, town], i) => {
  map(`gym${i + 1}`, `${name}'s ${type} Gym`, "gym", WORLD[town].palette);
  connect(town, `gym${i + 1}`, `${name}'s Gym`, town);
});
// Homes, services and facilities are real maps, not decorative buildings.
for (const [town, name] of townData) {
  for (const [suffix, title] of [
    ["center", "Pokémon Center"],
    ["mart", "Mart"],
  ] as const) {
    const id = `${town}_${suffix}`;
    map(id, `${name} ${title}`, "interior", WORLD[town].palette);
    connect(town, id, title, name);
    obj(id, {
      id: `${id}_clerk`,
      kind: suffix === "center" ? "healer" : "shop",
      name: suffix === "center" ? "Nurse" : "Shopkeeper",
      dialogue:
        suffix === "center"
          ? "Welcome! Your Pokémon can rest here."
          : "Welcome! Stock up for the road.",
    });
  }
}
for (const [id, name, town] of [
  ["home", "Your home", "dewdrop"],
  ["lab", "Professor Alder's Lab", "dewdrop"],
  ["league", "Astral League", "crown"],
] as const) {
  map(id, name, "interior", WORLD[town].palette);
  connect(town, id, name, town);
}
obj("home", {
  id: "mother",
  kind: "person",
  name: "Mom",
  dialogue:
    "Alder is waiting at the lab. The whole region is yours to discover.",
});
obj("lab", {
  id: "alder",
  kind: "starter",
  name: "Professor Alder",
  dialogue:
    "Choose Growlithe, Poliwag, or Bellsprout. Take these supplies and survey the beacons with Robin.",
  setsFlag: "partner",
  reward: { item: "starter_supplies", amount: 1 },
});
obj("dewdrop", {
  id: "robin_start",
  kind: "person",
  name: "Robin",
  dialogue:
    "The Aurora Current guides Pokémon across Astra. Let’s find out why the beacons are failing!",
  requires: { flags: ["partner"] },
});
// Main road gates ensure each community's story is completed before leaving.
const gates: Record<string, Requirement> = {
  "01": { flags: ["partner"] },
  "04": { badges: 1 },
  "06": { badges: 2 },
  "08": { badges: 3 },
  "10": { badges: 4 },
  "12": { flags: ["ranger_report"] },
  "14": { badges: 5 },
  "16": { badges: 6 },
  "18": { badges: 7 },
  "20": { badges: 8, flags: ["engine_stopped"] },
  "21": { ability: "cut" },
  "22": { ability: "surf", badges: 4 },
  "23": { ability: "strength", badges: 5 },
  "24": { ability: "whirlpool", badges: 7 },
  "25": { flags: ["champion"] },
};
for (const [n, name, a, b] of routeData) {
  const id = `route${n}`;
  connect(a, id, name, WORLD[a].name, gates[n]);
  connect(
    id,
    b,
    WORLD[b].name,
    name,
    undefined,
    ["21", "22", "23", "24", "25"].includes(n) ? gates[n] : undefined,
  );
}
connect("bellweather", "meridian_1", "Meridian HQ", "Bellweather", {
  flags: ["revelation"],
});
connect("crown", "victory_1", "Victory Ascent", "Crown Summit", {
  badges: 8,
  flags: ["engine_stopped"],
});
for (const [id, name, , mechanism, intermediate, final] of dungeonData) {
  connect(`${id}_1`, `${id}_2`, "Into the depths", "Entrance");
  connect(`${id}_2`, `${id}_3`, "Inner chamber", "Depths", {
    flags: [intermediate],
  });
  obj(`${id}_2`, {
    id: `${id}_mechanism`,
    kind: "switch",
    name: mechanism,
    dialogue: `You operate the ${mechanism}. A passage opens deeper into ${name}.`,
    setsFlag: intermediate,
  });
  obj(`${id}_3`, {
    id: `${id}_objective`,
    kind: "switch",
    name: final.replaceAll("_", " "),
    dialogue: `You complete the ${name} objective. The beacon's light grows steadier.`,
    setsFlag: final,
  });
  // Inner chamber exit is a usable shortcut back to the entrance.
  connect(
    `${id}_3`,
    `${id}_1`,
    "Return shortcut",
    "Inner chamber",
    { flags: [final] },
    { flags: [final] },
  );
}
const objectives = [
  "surveyor",
  "fog_signal",
  "power_restored",
  "lens_restored",
  "pokemon_freed",
  "pass_open",
  "revelation",
  "last_lens",
];
const puzzles = [
  "leaf marker",
  "sluice",
  "relay",
  "pressure plate",
  "furnace vent",
  "thaw channel",
  "memory bell",
  "constellation",
];
leaders.forEach(([name, type, , team], i) => {
  const id = `gym${i + 1}`;
  let previous: string | undefined;
  for (let n = 1; n <= 3; n++) {
    const flag = `gym${i + 1}_puzzle${n}`;
    obj(id, {
      id: flag,
      kind: "switch",
      name: `${puzzles[i]} ${n}`,
      dialogue: `The ${puzzles[i]} clicks into place.`,
      requires: previous ? { flags: [previous] } : undefined,
      lockedDialogue: "Follow the markers in order.",
      setsFlag: flag,
    });
    previous = flag;
  }
  obj(id, {
    id: `leader_${i + 1}`,
    kind: "leader",
    name,
    dialogue: `I am ${name}, keeper of this beacon. Show me the bond you have built!`,
    requires: { flags: [objectives[i], previous!], badges: i },
    lockedDialogue:
      "Help the community and finish the gym puzzle before challenging the keeper.",
    setsFlag: `badge${i + 1}`,
    reward: { badge: i + 1, ability: ABILITIES[i] },
    trainer: { id: `leader_${i + 1}`, name, team, reward: 1000 * (i + 1) },
  });
});
// Every habitat has a small, deterministic pool. All species are distributed across
// the region, including evolved forms and otherwise trade-exclusive species.
const habitats = routeData.map(([n]) => WORLD[`route${n}`]);
// Early habitat pools are hand-selected for terrain and the opening level curve.
// The reserve routes contain the remaining native and introduced species.
const earlyPools: number[][] = [
  [10, 13, 16, 19, 21, 25, 29, 32, 46, 163, 165, 167],
  [43, 48, 69, 108, 161, 179, 187, 191, 209],
  [23, 37, 41, 52, 60, 72, 98, 116, 118, 120, 170, 194],
  [27, 39, 50, 56, 74, 77, 84, 95, 104, 111, 185, 207],
  [58, 66, 81, 100, 109, 125, 137, 172, 179, 190, 204, 239],
  [24, 28, 51, 75, 78, 82, 96, 101, 110, 112, 113, 143],
];
const legendaryIds = new Set([
  144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251,
]);
const reserveStarters = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 152, 153, 154, 155, 156, 157, 158, 159, 160,
];
const assigned = new Set([...earlyPools.flat(), ...reserveStarters]);
const reserve = Array.from({ length: 251 }, (_, i) => i + 1).filter(
  (n) => !legendaryIds.has(n) && !assigned.has(n),
);
habitats.forEach((habitat, i) => {
  const pool =
    i < earlyPools.length
      ? earlyPools[i]
      : reserve.splice(0, Math.ceil(reserve.length / (habitats.length - i)));
  const level = Math.min(48, 4 + i * 2);
  if (i === habitats.length - 1) pool.push(...reserveStarters);
  habitat.encounters = pool.map((species, j) => ({
    species,
    minLevel: level,
    maxLevel: Math.min(52, level + 2),
    weight: j < 4 ? 6 : 2,
  }));
});
routeData.forEach(([n, name], i) => {
  const id = `route${n}`,
    level = Math.min(53, 7 + i * 2);
  obj(id, {
    id: `trainer_route${n}`,
    kind: "trainer",
    name: `${["Scout", "Hiker", "Ranger", "Sailor", "Ace"][i % 5]} ${["Ari", "Bea", "Cleo", "Dara", "Emil"][i % 5]}`,
    dialogue: `The path through ${name} is a good place to train!`,
    setsFlag: `trainer_route${n}_won`,
    trainer: {
      id: `trainer_route${n}`,
      name: `${["Scout", "Hiker", "Ranger", "Sailor", "Ace"][i % 5]} ${["Ari", "Bea", "Cleo", "Dara", "Emil"][i % 5]}`,
      team: [{ species: habitats[i].encounters[0]?.species ?? 19, level }],
      reward: level * 40,
    },
  });
  obj(id, {
    id: `item_route${n}`,
    kind: "item",
    name: "Hidden supply",
    dialogue: "You found supplies tucked away beside the path.",
    setsFlag: `item_route${n}_found`,
    reward: {
      item: i < 4 ? "potion" : i < 12 ? "great_ball" : "ultra_ball",
      amount: 2,
    },
  });
});
// Robin's observations tie the communities together as the plot unfolds.
const scenes: [string, string, string, Requirement?][] = [
  [
    "mossford",
    "robin_mossford",
    "Meridian says its new machine will help the beacons. I hope they are right.",
    { flags: ["partner"] },
  ],
  [
    "copperwick",
    "robin_copperwick",
    "The power is being diverted from the canal. I will ask Meridian what is happening.",
    { badges: 2 },
  ],
  [
    "bellweather",
    "robin_bellweather",
    "I saw the trapped Pokémon. Vale must be stopped; I am leaving Meridian.",
    { flags: ["revelation"] },
  ],
  [
    "aster",
    "robin_aster",
    "The Engine is holding both guardians. I will help you reach the observatory.",
    { flags: ["vale_defeated"] },
  ],
];
scenes.forEach(([where, id, dialogue, requires]) =>
  obj(where, { id, kind: "person", name: "Robin", dialogue, requires }),
);
obj("reedhaven", {
  id: "ranger",
  kind: "person",
  name: "Ranger",
  dialogue:
    "The bamboo bridges are down. Please reach the sanctuary and bring back the ranger report.",
});
obj("bellweather", {
  id: "meridian_director",
  kind: "person",
  name: "Keeper",
  dialogue:
    "The bells remember what Meridian has forgotten. Follow their echo, then confront Vale at headquarters.",
});
// The Engine is inaccessible until Vale has been confronted at HQ.
const observatory = WORLD.route19.exits.find((e) => e.to === "starfall_1");
if (observatory) {
  observatory.requires = { flags: ["vale_defeated"] };
  observatory.lockedDialogue =
    "Meridian security requires the headquarters keycard.";
}
// Vale's defeat opens the observatory; its lens earns Orion's trust before
// the eight badges can be used to disable the Engine.
const vale = WORLD.meridian_3.objects.find(
  (o) => o.id === "meridian_objective",
)!;
vale.kind = "trainer";
vale.name = "Director Vale";
vale.dialogue =
  "A permanent dawn could have saved every habitat. Show me another way!";
vale.trainer = {
  id: "director_vale",
  name: "Director Vale",
  team: [
    { species: 82, level: 46 },
    { species: 89, level: 47 },
    { species: 233, level: 48 },
  ],
  reward: 4800,
};
obj("starfall_3", {
  id: "celestial_engine",
  kind: "switch",
  name: "Celestial Engine",
  dialogue:
    "The beacons reunite. Lugia and Ho-Oh are free, and the Aurora Current flows again.",
  requires: { badges: 8, flags: ["last_lens", "vale_defeated"] },
  lockedDialogue:
    "The Engine needs all eight badges and the recovered lens to shut down safely.",
  setsFlag: "engine_stopped",
});
const leagueTeam: [string, TeamMember[]][] = [
  [
    "Rowan",
    [
      { species: 3, level: 55 },
      { species: 45, level: 55 },
      { species: 71, level: 56 },
      { species: 169, level: 56 },
    ],
  ],
  [
    "Petra",
    [
      { species: 76, level: 56 },
      { species: 208, level: 56 },
      { species: 139, level: 57 },
      { species: 248, level: 57 },
    ],
  ],
  [
    "Nyx",
    [
      { species: 94, level: 57 },
      { species: 197, level: 57 },
      { species: 200, level: 58 },
      { species: 229, level: 58 },
    ],
  ],
  [
    "Gale",
    [
      { species: 18, level: 58 },
      { species: 130, level: 58 },
      { species: 142, level: 59 },
      { species: 227, level: 59 },
    ],
  ],
  [
    "Champion Mira",
    [
      { species: 135, level: 59 },
      { species: 131, level: 59 },
      { species: 214, level: 60 },
      { species: 229, level: 60 },
      { species: 248, level: 61 },
      { species: 251, level: 62 },
    ],
  ],
];
leagueTeam.forEach(([name, team], i) =>
  obj("league", {
    id: `league_${i}`,
    kind: "trainer",
    name,
    dialogue: `${name} awaits your challenge.`,
    requires: i
      ? { flags: [`league_${i - 1}_won`] }
      : { flags: ["ascent_complete"], badges: 8 },
    lockedDialogue: "Complete Victory Ascent and face the League in order.",
    setsFlag: i === 4 ? "champion" : `league_${i}_won`,
    trainer: { id: `league_${i}`, name, team, reward: 5000 },
  }),
);
const quests: [string, string, string, string, string, string, Requirement?][] =
  [
    [
      "parcel",
      "Lost Parcel",
      "mossford",
      "Courier",
      "Please deliver this parcel to Bramble.",
      "Great Balls",
    ],
    [
      "hearth",
      "A Warm Hearth",
      "dewdrop",
      "Elder",
      "A Growlithe or Vulpix would warm this hearth.",
      "Fire Stone",
    ],
    [
      "pollinators",
      "Orchard Pollinators",
      "mossford",
      "Orchard keeper",
      "Our orchard needs three kinds of Bug Pokémon.",
      "Leaf Stone",
    ],
    [
      "angler",
      "Tideglass Angler",
      "tideglass",
      "Angler",
      "Show me the variety of Water Pokémon in your travels.",
      "Water Stone",
    ],
    [
      "lighthouse",
      "Lighthouse Lens",
      "tideglass",
      "Lighthouse keeper",
      "Return over the water once you can Surf.",
      "Lapras",
    ],
    [
      "collector",
      "Copper Collector",
      "copperwick",
      "Collector",
      "Find three machine parts around the region.",
      "Thunder Stone",
    ],
    [
      "fossil",
      "Fossil Memory",
      "route23",
      "Excavator",
      "Old Quarry still holds ancient fossils.",
      "Omanyte or Kabuto",
    ],
    [
      "oasis",
      "Oasis Offering",
      "sunspire",
      "Glassworker",
      "Restore the markers in Hourglass Ruins.",
      "Moon Stone and Sun Stone",
      { flags: ["lens_restored"] },
    ],
    [
      "census",
      "Ranger’s Census",
      "reedhaven",
      "Ranger",
      "Record thirty species for the reserve.",
      "Exp Share",
      { caught: 30 },
    ],
    [
      "bamboo_friend",
      "Bamboo Friend",
      "bamboo_3",
      "Ranger",
      "A Farfetch’d is stranded beyond the grove.",
      "Rare lure",
      { ability: "cut" },
    ],
    [
      "furnace",
      "Furnace Delivery",
      "cinderfall",
      "Artisan",
      "Bring the ore from Ember Mine to my furnace.",
      "Metal Coat and Link Cable",
      { flags: ["pokemon_freed"] },
    ],
    [
      "medicine",
      "Mountain Medicine",
      "mossford",
      "Herbalist",
      "A snow herb from Frostvault will help my patients.",
      "Friendship charm",
      { flags: ["pass_open"] },
    ],
    [
      "echoes",
      "Echoes of the Past",
      "echo_3",
      "Historian",
      "The bells have revealed a forgotten chamber.",
      "Unown",
      { ability: "flash" },
    ],
    [
      "promise",
      "A Rival’s Promise",
      "aster",
      "Robin",
      "Our journey has changed both of us. Let’s make a promise to protect Astra.",
      "Eevee",
      { flags: ["champion"] },
    ],
    [
      "chart",
      "Stargazer’s Chart",
      "aster",
      "Stargazer",
      "The eight beacon keepers are the key to my chart.",
      "Master Ball",
      { badges: 8 },
    ],
    [
      "atlas",
      "Living Atlas",
      "aurora_3",
      "Researcher",
      "Complete the Pokédex and tell me what you learned.",
      "Aurora certificate",
      { caught: 251 },
    ],
  ];
const questRewards: Record<string, Reward> = {
  parcel: { item: "great_ball", amount: 5 },
  hearth: { item: "fire_stone" },
  pollinators: { item: "leaf_stone" },
  angler: { item: "water_stone" },
  lighthouse: { species: 131, level: 25 },
  collector: { item: "thunder_stone" },
  fossil: { species: 138, level: 20 },
  oasis: { items: [{ item: "moon_stone" }, { item: "sun_stone" }] },
  census: { item: "exp_share" },
  bamboo_friend: { item: "rare_lure" },
  furnace: { items: [{ item: "metal_coat" }, { item: "link_cable" }] },
  medicine: { item: "friendship_charm" },
  echoes: { species: 201, level: 25 },
  promise: { species: 133, level: 30 },
  chart: { item: "master_ball" },
  atlas: { item: "aurora_certificate" },
};
quests.forEach(([id, name, where, npc, description, reward, prerequisite]) => {
  const flag = `quest_${id}_complete`;
  QUESTS.push({
    id,
    name,
    description,
    prerequisite,
    completedFlag: flag,
    reward,
  });
  obj(where, {
    id: `quest_${id}`,
    kind: "person",
    name: npc,
    dialogue: `${description} ${prerequisite ? "Thank you for your help!" : "Here is something for your journey."}`,
    requires: prerequisite,
    lockedDialogue: description,
    setsFlag: flag,
    reward: questRewards[id],
    quest: id,
  });
});
const legendary: [string, string, number, Requirement][] = [
  ["frostvault_3", "Articuno", 144, { ability: "waterfall" }],
  ["copperworks_3", "Zapdos", 145, { flags: ["champion"] }],
  ["ember_3", "Moltres", 146, { ability: "rockSmash" }],
  ["meridian_3", "Mewtwo", 150, { flags: ["champion"] }],
  ["route21", "Mew", 151, { caught: 100 }],
  ["route22", "Raikou", 243, { flags: ["champion"] }],
  ["route23", "Entei", 244, { flags: ["champion"] }],
  ["route24", "Suicune", 245, { flags: ["champion"] }],
  ["undertow_3", "Lugia", 249, { ability: "whirlpool" }],
  ["echo_3", "Ho-Oh", 250, { flags: ["champion"] }],
  ["aurora_3", "Celebi", 251, { flags: ["champion"] }],
];
legendary.forEach(([where, name, species, requires]) =>
  obj(where, {
    id: `legendary_${species}`,
    kind: "legendary",
    name,
    dialogue: `${name} is waiting. The guardian will return if you cannot catch it.`,
    requires,
    lockedDialogue: "The guardian has not yet appeared.",
    setsFlag: `caught_legendary_${species}`,
    trainer: {
      id: `legendary_${species}`,
      name,
      team: [{ species, level: 60 }],
    },
    repeatable: true,
  }),
);

// Side objectives are explicit, persisted interactions. NPCs explain what is
// missing until the requirement is met; collecting an objective never consumes
// a unique Pokémon or permanently blocks a quest.
const questById = (id: string) =>
  Object.values(WORLD)
    .flatMap((m) => m.objects)
    .find((o) => o.id === `quest_${id}`)!;
function questRequirement(id: string, requires: Requirement, hint: string) {
  const o = questById(id);
  o.requires = requires;
  o.lockedDialogue = hint;
  const q = QUESTS.find((q) => q.id === id)!;
  q.prerequisite = requires;
}
function pickup(
  where: string,
  id: string,
  name: string,
  dialogue: string,
  requires?: Requirement,
) {
  obj(where, {
    id: `pickup_${id}`,
    kind: "item",
    name,
    dialogue,
    requires,
    setsFlag: `found_${id}`,
  });
}
// The courier starts the quest and the recipient finishes it.
const parcel = questById("parcel");
parcel.dialogue =
  "Heading to Bramble? Please take this delivery along Orchard Lane. You received the courier’s parcel!";
parcel.victoryDialogue =
  "The parcel is safely in your pack. Follow Orchard Lane east to Bramble and find the courier there.";
parcel.setsFlag = "found_parcel";
parcel.reward = undefined;
parcel.quest = undefined;
obj("bramble", {
  id: "parcel_recipient",
  kind: "person",
  name: "Bramble courier",
  dialogue:
    "My delivery from Mossford! Thank you for bringing it. Please take these Great Balls.",
  requires: { flags: ["found_parcel"] },
  lockedDialogue: "I am waiting for a delivery from Mossford.",
  setsFlag: "quest_parcel_complete",
  reward: { item: "great_ball", amount: 5 },
  quest: "parcel",
});
questRequirement(
  "hearth",
  { species: [58, 37] },
  "Bring a Growlithe or Vulpix to warm the hearth.",
);
questRequirement(
  "pollinators",
  { types: [{ type: "bug", count: 3 }] },
  "Show me three different Bug species to help the orchard.",
);
questRequirement(
  "angler",
  { types: [{ type: "water", count: 3 }] },
  "Show me three different Water species and I will share a fishing reward.",
);
questRequirement(
  "lighthouse",
  { ability: "surf" },
  "Return after earning Surf and I will introduce you to Lapras.",
);
for (const [where, id] of [
  ["route06", "part_a"],
  ["route07", "part_b"],
  ["copperworks_2", "part_c"],
] as const)
  pickup(where, id, "Machine part", "You found a Meridian machine part.");
questRequirement(
  "collector",
  { flags: ["found_part_a", "found_part_b", "found_part_c"] },
  "Find the three machine parts near Canal Road, Switchyard and Copperworks.",
);
pickup(
  "route23",
  "fossil",
  "Ancient fossil",
  "You carefully excavate a fossil.",
);
questRequirement(
  "fossil",
  { flags: ["found_fossil"] },
  "Excavate the fossil nearby and I can revive it.",
);
pickup(
  "frostvault_2",
  "snow_herb",
  "Snow herb",
  "You gathered the snow herb for Mossford.",
);
questRequirement(
  "medicine",
  { flags: ["found_snow_herb"] },
  "Please bring me a snow herb from Frostvault.",
);
pickup(
  "ember_2",
  "mine_ore",
  "Mine ore",
  "You collected ore for the Cinderfall artisan.",
);
questRequirement(
  "furnace",
  { flags: ["found_mine_ore", "pokemon_freed"] },
  "Bring mine ore and make sure the captive Pokémon are safe.",
);
questRequirement(
  "promise",
  { flags: ["rival_1_won", "rival_2_won", "rival_3_won", "rival_4_won"] },
  "Let us finish our friendly battles across Astra first.",
);
const rivals: [string, string, number, number, Requirement?][] = [
  ["route02", "rival_1", 12, 16],
  ["route06", "rival_2", 22, 17, { badges: 2 }],
  ["route12", "rival_3", 34, 18, { badges: 4 }],
  ["route18", "rival_4", 47, 18, { badges: 7 }],
];
rivals.forEach(([where, id, level, bird, requires]) =>
  obj(where, {
    id,
    kind: "trainer",
    name: "Robin",
    dialogue: "Let’s see how far we have come together!",
    requires,
    setsFlag: `${id}_won`,
    trainer: {
      id,
      name: "Robin",
      team: [
        { species: bird, level },
        { species: 133, level: level + 1 },
      ],
      reward: level * 80,
    },
  }),
);

// Town buildings have roofs, walls, and actual doorways linked to their interiors.
// Main streets remain open across the centre, while gardens occupy the corners.
for (const [id] of townData) {
  const m = WORLD[id],
    grid = m.tiles.map((r) => r.split(""));
  const entrances = m.exits.filter((e) =>
    ["interior", "gym"].includes(WORLD[e.to].kind),
  );
  const sites: [[number, number], ...[number, number][]] = [
    [2, 2],
    [11, 2],
    [20, 2],
    [2, m.height - 6],
    [11, m.height - 6],
    [20, m.height - 6],
  ];
  entrances.forEach((exit, i) => {
    const siteIndex =
      id === "dewdrop"
        ? ((
            { dewdrop_center: 0, lab: 1, dewdrop_mart: 2, home: 3 } as Record<
              string,
              number
            >
          )[exit.to] ?? i)
        : id === "mossford"
          ? ([2, 3][i] ?? i)
          : i;
    const [x, y] = sites[siteIndex];
    for (let dx = 0; dx < 7; dx++) {
      grid[y][x + dx] = "r";
      grid[y + 1][x + dx] = "r";
      grid[y + 2][x + dx] = "w";
    }
    const doorX = x + 3,
      doorY = y + 2;
    grid[doorY][doorX] = "d";
    exit.x = doorX;
    exit.y = doorY;
    const back = WORLD[exit.to].exits.find((e) => e.to === id)!;
    back.toX = doorX;
    back.toY = doorY;
  });
  // Open approach to each door from the street and retain all object positions.
  for (const entrance of entrances) {
    const y = entrance.y < m.height / 2 ? entrance.y + 1 : entrance.y + 1;
    grid[y][entrance.x] = ".";
  }
  for (const o of m.objects) grid[o.y][o.x] = ".";
  for (const e of m.exits)
    grid[e.y][e.x] =
      e.to && ["interior", "gym"].includes(WORLD[e.to].kind) ? "d" : ".";
  m.tiles = grid.map((r) => r.join(""));
}

// Route margins and side pockets use each landscape's own terrain, retaining a
// continuous central road and a second walkable loop through the grass.
routeData.forEach(([n, , , , palette], index) => {
  const m = WORLD[`route${n}`],
    grid = m.tiles.map((r) => r.split(""));
  for (let x = 3; x < m.width - 3; x++) {
    if (palette === "coast" && x % 5 !== 0) {
      grid[2][x] = "~";
      grid[m.height - 3][x] = "~";
    } else if (
      ["mountain", "snow", "volcanic"].includes(palette) &&
      (x + index) % 4 === 0
    ) {
      grid[2][x] = "#";
      grid[m.height - 3][x] = "#";
    } else if (
      ["orchard", "autumn", "meadow", "wetland"].includes(palette) &&
      (x + index) % 3 === 0
    ) {
      grid[2][x] = "f";
      grid[m.height - 3][x] = ",";
    } else if (palette === "desert" && x % 4 === 0) {
      grid[2][x] = "#";
      grid[m.height - 3][x] = ",";
    }
  }
  if (palette === "coast") {
    grid[2][11] = "=";
    grid[m.height - 3][12] = "=";
  }
  for (const e of m.exits) grid[e.y][e.x] = ".";
  for (const o of m.objects) grid[o.y][o.x] = ".";
  m.tiles = grid.map((r) => r.join(""));
});
// Each dungeon's mechanism names its actual steps and enforces their order.
const dungeonSteps: Record<string, [string, string]> = {
  lantern: ["Read the first leaf trail", "Tie the survey rope"],
  undertow: ["Drain the high sluice", "Open the low sluice"],
  copperworks: ["Isolate the live circuit", "Connect the return relay"],
  hourglass: ["Turn the sun stone east", "Turn the moon stone west"],
  bamboo: ["Release the bridge latch", "Turn the bridge winch"],
  ember: ["Brace the tunnel", "Move the ore boulder"],
  frostvault: ["Light the warming brazier", "Open the thaw valve"],
  echo: ["Ring the low bell", "Ring the high bell"],
  meridian: ["Recover the staff keycard", "Disable the security circuit"],
  starfall: ["Align the northern star", "Align the southern star"],
  victory: ["Clear the summit rocks", "Raise the climbing bridge"],
  aurora: ["Read the research inscription", "Place the restored beacon"],
};
for (const [id] of dungeonData) {
  const m = WORLD[`${id}_2`],
    mechanism = m.objects.find((o) => o.id === `${id}_mechanism`)!;
  const [first, second] = dungeonSteps[id];
  obj(m.id, {
    id: `${id}_step1`,
    kind: "switch",
    name: first,
    dialogue: `${first}: the mechanism responds.`,
    setsFlag: `${id}_step1`,
  });
  obj(m.id, {
    id: `${id}_step2`,
    kind: "switch",
    name: second,
    dialogue: `${second}: the next mechanism is ready.`,
    requires: { flags: [`${id}_step1`] },
    lockedDialogue: `First: ${first.toLowerCase()}.`,
    setsFlag: `${id}_step2`,
  });
  mechanism.requires = { flags: [`${id}_step2`] };
  mechanism.lockedDialogue = `First: ${second.toLowerCase()}.`;
}

// Each gym gives a clue to a distinct sequence. The physical marker order is
// scrambled so solving the clue, rather than walking left to right, opens it.
const gymClues: [string, string[]][] = [
  [
    "The leaf trail runs seed, sprout, then canopy.",
    ["Seed leaf", "Sprout leaf", "Canopy leaf"],
  ],
  [
    "Water flows from high tide to ebb to low tide.",
    ["High sluice", "Ebb sluice", "Low sluice"],
  ],
  [
    "Power runs from source through coil to lamp.",
    ["Source relay", "Coil relay", "Lamp relay"],
  ],
  [
    "The weights rise from pebble to stone to boulder.",
    ["Pebble plate", "Stone plate", "Boulder plate"],
  ],
  [
    "Vent cool air first, then smoke, then flame.",
    ["Cool vent", "Smoke vent", "Flame vent"],
  ],
  [
    "Thaw the spring, stream, then pool.",
    ["Spring channel", "Stream channel", "Pool channel"],
  ],
  [
    "The memory rises from low to middle to high.",
    ["Low bell", "Middle bell", "High bell"],
  ],
  [
    "Trace the sky from horizon to zenith to dawn.",
    ["Horizon star", "Zenith star", "Dawn star"],
  ],
];
gymClues.forEach(([clue, labels], i) => {
  const m = WORLD[`gym${i + 1}`],
    positions: [[number, number], [number, number], [number, number]] = [
      [11, 10],
      [17, 10],
      [14, 13],
    ];
  for (let n = 0; n < 3; n++) {
    const o = m.objects.find((o) => o.id === `gym${i + 1}_puzzle${n + 1}`)!;
    o.name = labels[n];
    [o.x, o.y] = positions[(n + i + 1) % 3];
    o.lockedDialogue = `The marker is still. ${clue}`;
  }
  obj(m.id, {
    id: `gym${i + 1}_clue`,
    kind: "sign",
    name: "Keeper’s clue",
    dialogue: clue,
    x: 14,
    y: 17,
  });
});

// Add optional side pockets and landmarks around the unobstructed road. Their
// shape changes with each route, with a gap connecting every pocket to the road.
for (const [n, , , , palette] of routeData) {
  const m = WORLD[`route${n}`],
    grid = m.tiles.map((r) => r.split("")),
    v = Number(n) % 6;
  const obstacle = ["coast"].includes(palette) ? "~" : "#";
  for (let y = 3; y < 8; y++)
    for (let x = 4; x < m.width - 4; x++) {
      if ((x + v * 3) % 11 < 2 && y !== 5) grid[y][x] = obstacle;
      if ((x + v * 2) % 13 < 2 && y !== 5) grid[m.height - 1 - y][x] = obstacle;
    }
  // A curved optional trail around each margin complements the central road.
  for (let x = 4; x < m.width - 4; x++) {
    grid[5][x] = ".";
    grid[m.height - 6][x] = ".";
  }
  for (const e of m.exits) grid[e.y][e.x] = ".";
  for (const o of m.objects) grid[o.y][o.x] = ".";
  m.tiles = grid.map((r) => r.join(""));
  const trainer = m.objects.find((o) => o.id === `trainer_route${n}`)?.trainer;
  if (trainer && Number(n) > 4) {
    const pool = m.encounters;
    trainer.team.push({
      species: pool[1]?.species ?? pool[0]?.species ?? 19,
      level: trainer.team[0].level,
    });
  }
}
const townFlavor: Record<string, string> = {
  dewdrop:
    "Alder’s garden points toward the lab. The first beacon watches over the village.",
  mossford:
    "The orchard windmills turn with the breeze. A courier prepares a delivery for Bramble.",
  bramble: "Lanterns mark the forest path. Fern keeps the Canopy beacon.",
  tideglass:
    "The fog signal guides ships through the harbor. Marina tends the Tidal beacon.",
  copperwick:
    "Canals carry water past the workshops. The beacon dims whenever the power fails.",
  sunspire:
    "Glass catches the desert sun above the oasis. The old stones remember its path.",
  reedhaven:
    "Rangers watch the bamboo bridges and count the reserve’s many inhabitants.",
  cinderfall:
    "Warm springs flow below the mine. The furnaces need clean air and careful hands.",
  rimepeak:
    "The mountain pass glitters with snow. Travelers rest here before the ascent.",
  bellweather:
    "Every bell has a memory. Listen closely to learn what Meridian has hidden.",
  aster:
    "The observatory watches the stars while the last beacon waits for its lens.",
  crown:
    "Beyond the ascent, the Astral League awaits those who have restored the beacons.",
};
for (const [id] of townData)
  obj(id, {
    id: `sign_${id}`,
    kind: "sign",
    name: "Town guide",
    dialogue: townFlavor[id],
  });
// Dungeon chambers have different wall breaks and side alcoves. Objective and
// exit cells are always cleared, so the extra passages never trap the player.
dungeonData.forEach(([id, , palette], di) => {
  for (let room = 1; room <= 3; room++) {
    const m = WORLD[`${id}_${room}`],
      grid = m.tiles.map((r) => r.split(""));
    const obstacle = ["coast", "wetland"].includes(palette) ? "~" : "#";
    const north = 4 + ((di + room) % 3),
      south = m.height - 5 - ((di + room) % 3);
    for (let x = 7; x < m.width - 7; x++) {
      if (x !== 9 + (di % 3) && x !== m.width - 10 - (room % 3)) {
        grid[north][x] = obstacle;
        grid[south][x] = obstacle;
      }
    }
    for (const e of m.exits) grid[e.y][e.x] = ".";
    for (const o of m.objects) grid[o.y][o.x] = ".";
    m.tiles = grid.map((r) => r.join(""));
  }
});

// Gardens and a narrow network of paths give each settlement a legible center.
// Buildings remain solid; lawn and flowers remain walkable.
townData.forEach(([id], index) => {
  const m = WORLD[id],
    grid = m.tiles.map((r) => r.split(""));
  for (let y = 1; y < m.height - 1; y++)
    for (let x = 1; x < m.width - 1; x++)
      if (grid[y][x] === ".") grid[y][x] = ",";
  const cx = Math.floor(m.width / 2),
    cy = Math.floor(m.height / 2);
  function path(x: number, y: number) {
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
    ] as const) {
      const xx = x + dx;
      if (
        xx > 0 &&
        xx < m.width - 1 &&
        y > 0 &&
        y < m.height - 1 &&
        !["r", "w", "d"].includes(grid[y][xx])
      )
        grid[y][xx] = ".";
    }
  }
  function connectPath(x: number, y: number) {
    let px = x,
      py = y;
    while (py !== cy) {
      path(px, py);
      py += py < cy ? 1 : -1;
    }
    while (px !== cx) {
      path(px, py);
      px += px < cx ? 1 : -1;
    }
    path(cx, cy);
  }
  for (const e of m.exits) connectPath(e.x, e.y);
  for (const o of m.objects) connectPath(o.x, o.y);
  if (id === "dewdrop") connectPath(12, 8);
  // Decorative trees and flowers occupy lawn pockets, never paths.
  for (let y = 5; y < m.height - 4; y++)
    for (let x = 2; x < m.width - 2; x++) {
      if (grid[y][x] !== ",") continue;
      if ((x * 7 + y * 11 + index * 3) % 47 === 0) grid[y][x] = "#";
      else if ((x * 5 + y * 3 + index) % 13 === 0) grid[y][x] = "f";
    }
  for (const e of m.exits)
    if (!["interior", "gym"].includes(WORLD[e.to].kind)) grid[e.y][e.x] = ".";
  for (const o of m.objects) grid[o.y][o.x] = ".";
  m.tiles = grid.map((r) => r.join(""));
});
// Route grass surrounds a three-tile winding road and short paths to landmarks.
routeData.forEach(([n], i) => {
  const m = WORLD[`route${n}`],
    grid = m.tiles.map((r) => r.split("")),
    cy = Math.floor(m.height / 2);
  for (let y = 1; y < m.height - 1; y++)
    for (let x = 1; x < m.width - 1; x++)
      if (grid[y][x] === ".") grid[y][x] = ",";
  const roadY = (x: number) => cy + Math.round(2 * Math.sin((x + i * 3) / 7));
  for (let x = 1; x < m.width - 1; x++)
    for (let dy = -1; dy <= 1; dy++) {
      const y = roadY(x) + dy;
      if (!"#~".includes(grid[y][x])) grid[y][x] = ".";
    }
  function approach(x: number, y: number) {
    const target = roadY(x);
    while (y !== target) {
      if (!"#~".includes(grid[y][x])) grid[y][x] = ".";
      y += y < target ? 1 : -1;
    }
  }
  for (const e of m.exits) {
    approach(e.x, e.y);
    grid[e.y][e.x] = ".";
  }
  for (const o of m.objects) {
    approach(o.x, o.y);
    grid[o.y][o.x] = ".";
  }
  m.tiles = grid.map((r) => r.join(""));
});

// Optional trainers provide experience between each community and its keeper.
// Their placement is selected from open cells after the authored terrain is built.
const firstRival = WORLD.route02.objects.find((o) => o.id === "rival_1")!;
firstRival.trainer!.team.forEach((mon, i) => {
  mon.level = 8 + i;
});
function freePosition(m: WorldMap): [number, number] {
  const cx = Math.floor(m.width / 2),
    cy = Math.floor(m.height / 2),
    candidates: [number, number][] = [];
  for (let y = 2; y < m.height - 2; y++)
    for (let x = 2; x < m.width - 2; x++)
      if (
        !"#rw~".includes(m.tiles[y][x]) &&
        m.objects.every((o) => Math.hypot(o.x - x, o.y - y) >= 2.5) &&
        m.exits.every((e) => Math.hypot(e.x - x, e.y - y) >= 2)
      )
        candidates.push([x, y]);
  candidates.sort(
    (a, b) =>
      Math.abs(a[0] - cx) +
      Math.abs(a[1] - cy) -
      Math.abs(b[0] - cx) -
      Math.abs(b[1] - cy),
  );
  if (!candidates.length) throw Error(`No trainer position in ${m.id}`);
  return candidates[0];
}
for (let i = 0; i < 20; i++) {
  const m = habitats[i],
    base = Math.max(5, 5 + i * 2);
  for (let j = 0; j < 2; j++) {
    const [x, y] = freePosition(m),
      name = `${["Youngster", "Picnicker", "Backpacker", "Ranger"][(i + j) % 4]} ${["Nell", "Kai", "Mika", "Tess", "Ollie"][(i * 2 + j) % 5]}`;
    const species = m.encounters[(j + 2) % m.encounters.length]?.species ?? 19;
    obj(m.id, {
      id: `${m.id}_optional_${j}`,
      kind: "trainer",
      name,
      x,
      y,
      dialogue: "Let’s practice together before the road ahead!",
      setsFlag: `${m.id}_optional_${j}_won`,
      trainer: {
        id: `${m.id}_optional_${j}`,
        name,
        team: [{ species, level: base + j }],
        reward: (base + j) * 35,
      },
    });
  }
}
dungeonData.forEach(([id, name], i) => {
  const m = WORLD[`${id}_1`],
    [x, y] = freePosition(m),
    level = Math.min(55, 9 + i * 4),
    species = habitats[Math.min(i * 2, 24)].encounters[0]?.species ?? 19;
  obj(m.id, {
    id: `${id}_guardian_trainer`,
    kind: "trainer",
    name: "Surveyor",
    x,
    y,
    dialogue: `I am studying ${name}. Let’s compare what we have learned!`,
    setsFlag: `${id}_guardian_trainer_won`,
    trainer: {
      id: `${id}_guardian_trainer`,
      name: "Surveyor",
      team: [{ species, level }],
      reward: level * 40,
    },
  });
});

// Interiors use actual furnishings: B bookcase, C counter, P plant, T table.
// Entrances face the room from the south; every important counter has a clear
// approach from that door. The symbols are impassable but never hide an object.
for (const m of Object.values(WORLD).filter((m) => m.kind === "interior")) {
  const grid = m.tiles.map((r) => r.split(""));
  const entrance = m.exits[0];
  if (entrance) {
    const back = WORLD[entrance.to].exits.find(
      (e) => e.to === m.id && e.toX === entrance.x && e.toY === entrance.y,
    );
    entrance.x = 12;
    entrance.y = 14;
    if (back) {
      back.toX = 12;
      back.toY = 14;
    }
  }
  const put = (x: number, y: number, ch: string) => {
    if (
      !m.objects.some((o) => o.x === x && o.y === y) &&
      !m.exits.some((e) => e.x === x && e.y === y)
    )
      grid[y][x] = ch;
  };
  if (m.id === "lab") {
    for (let x = 3; x <= 8; x++) put(x, 2, "B");
    for (let x = 15; x <= 20; x++) put(x, 2, "B");
    for (let x = 4; x <= 7; x++) put(x, 5, "T");
    for (let x = 16; x <= 19; x++) put(x, 5, "T");
    put(3, 11, "P");
    put(20, 11, "P");
    put(7, 11, "T");
    put(17, 11, "T");
  } else if (m.id.endsWith("_center")) {
    for (let x = 5; x <= 9; x++) put(x, 5, "C");
    for (let x = 13; x <= 18; x++) put(x, 5, "C");
    put(3, 3, "P");
    put(20, 3, "P");
    put(5, 10, "T");
    put(18, 10, "T");
    put(3, 12, "P");
  } else if (m.id.endsWith("_mart")) {
    for (let x = 5; x <= 9; x++) put(x, 5, "C");
    for (let x = 13; x <= 18; x++) put(x, 5, "C");
    for (const y of [9, 11]) for (const x of [4, 5, 18, 19]) put(x, y, "B");
    put(3, 3, "P");
    put(20, 3, "P");
  } else if (m.id === "home") {
    for (let x = 3; x <= 7; x++) put(x, 2, "B");
    for (let x = 16; x <= 20; x++) put(x, 2, "C");
    for (const [x, y] of [
      [5, 8],
      [6, 8],
      [17, 9],
      [18, 9],
    ] as const)
      put(x, y, "T");
    put(3, 12, "P");
    put(20, 12, "P");
  } else if (m.id === "league") {
    for (let x = 3; x < 21; x++) if (x !== 11 && x !== 12) put(x, 2, "B");
    for (const [x, y] of [
      [3, 5],
      [20, 5],
      [3, 11],
      [20, 11],
    ] as const)
      put(x, y, "P");
  }
  m.tiles = grid.map((r) => r.join(""));
}

// Evolution supplies can be found in the world as well as bought at later marts.
const evolutionSupplies: [string, string, string, Requirement?][] = [
  ["route02", "fire_stone", "Fire Stone"],
  ["route04", "water_stone", "Water Stone"],
  ["route07", "thunder_stone", "Thunder Stone"],
  ["route10", "leaf_stone", "Leaf Stone"],
  ["hourglass_3", "sun_stone", "Sun Stone"],
  ["route14", "moon_stone", "Moon Stone"],
  ["ember_3", "metal_coat", "Metal Coat"],
  ["undertow_3", "kings_rock", "King’s Rock"],
  ["route18", "dragon_scale", "Dragon Scale"],
  ["meridian_3", "up_grade", "Up-Grade"],
  ["route16", "link_cable", "Link Cable"],
  ["route20", "link_cable", "Link Cable"],
];
evolutionSupplies.forEach(([where, item, name], i) => {
  const m = WORLD[where],
    [x, y] = freePosition(m);
  obj(where, {
    id: `evolution_supply_${i}`,
    kind: "item",
    x,
    y,
    name,
    dialogue: `You found a ${name}!`,
    setsFlag: `evolution_supply_${i}_found`,
    reward: { item },
  });
});
// Three partner displays flank Alder; the professor remains reachable from the door.
{
  const m = WORLD.lab,
    grid = m.tiles.map((row) => row.split(""));
  const alder = m.objects.find((o) => o.id === "alder")!;
  alder.x = 12;
  alder.y = 4;
  for (const x of [8, 10, 14]) grid[4][x] = "S";
  grid[4][12] = ".";
  m.tiles = grid.map((row) => row.join(""));
}

// Dialogue carries the beacon survey through each location; flags and rewards
// remain independent from the prose so saved progression stays stable.
const dungeonStory: Record<string, { name: string; dialogue: string }> = {
  lantern: {
    name: "Stranded surveyor",
    dialogue:
      "You free the surveyor from the fallen branch. “Thank you! The beacon dimmed when Meridian’s machines arrived. Fern needs to hear this.” The surveyor marks a safe trail back to Bramble.",
  },
  undertow: {
    name: "Fog signal",
    dialogue:
      "The sluices settle and the lighthouse lens catches the sun. A clear signal sweeps the harbor. Marina discovers a Meridian intake pipe drawing water away from the cave and asks you to follow it inland.",
  },
  copperworks: {
    name: "Power regulator",
    dialogue:
      "You reconnect the town’s power. A maintenance log shows Meridian diverted the beacon’s current to its desert installation. Robin reads the record in disbelief: “They told us the brownouts were accidents.”",
  },
  hourglass: {
    name: "Ancient beacon lens",
    dialogue:
      "The runestones align and reveal the buried lens. Its inscription says the beacons guide living migrations, not merely electricity. Sable asks you to carry that warning to the Reedhaven rangers.",
  },
  bamboo: {
    name: "Ranger report",
    dialogue:
      "Across the repaired bridge, the ranger shares a disturbing census: Pokémon are leaving drained habitats. The report identifies a Meridian shipment bound for Ember Mine. The ranger asks you to stop it.",
  },
  ember: {
    name: "Captive Pokémon",
    dialogue:
      "You release the Pokémon from their transport cages. The miner says Meridian wanted their heat to feed the Engine. Flint promises to shelter them and restore the city’s beacon.",
  },
  frostvault: {
    name: "Icebound pass",
    dialogue:
      "The thawed channels carry warm water through the frozen gate. The mountain pass opens again. Neve finds a Meridian badge beside the abandoned pump: the freezing was caused by a deliberate diversion.",
  },
  echo: {
    name: "Beacon memory",
    dialogue:
      "The bells replay an old keeper’s warning: the Aurora Current must change with the seasons. Robin hears it too. “I believed Meridian was protecting Astra. I was wrong.” Together you decide to confront Vale.",
  },
  meridian: {
    name: "Director Vale",
    dialogue:
      "Vale studies the restored beacon records. “A storm once took everything I loved. A permanent dawn could prevent another loss.” He challenges you to prove Astra can be protected without controlling it.",
  },
  starfall: {
    name: "Final beacon lens",
    dialogue:
      "The constellations converge on the last lens. Orion can now restore the Astral beacon. Beyond the glass, the Celestial Engine holds the currents of Lugia and Ho-Oh in a trembling artificial dawn.",
  },
  victory: {
    name: "Summit gate",
    dialogue:
      "The ascent’s ancient locks open together. The path to the Astral League is clear. Rest at the center, then meet the four specialists and Champion Mira when you are ready.",
  },
  aurora: {
    name: "Restored sanctuary",
    dialogue:
      "The last research seal opens to a living grove. The restored current moves through its trees in a gentle cycle. The researchers can continue their work, and Celebi’s sanctuary is open to respectful visitors.",
  },
};
for (const [id] of dungeonData) {
  const o = WORLD[`${id}_3`].objects.find((o) => o.id === `${id}_objective`)!;
  Object.assign(o, dungeonStory[id]);
}
const valeStory = WORLD.meridian_3.objects.find(
  (o) => o.id === "meridian_objective",
)!;
valeStory.victoryDialogue =
  "Vale lowers his keycard. “I mistook stillness for safety. Take this; the Engine is yours to stop. I will help the communities repair what I damaged.”";
const engineStory = WORLD.starfall_3.objects.find(
  (o) => o.id === "celestial_engine",
)!;
engineStory.dialogue =
  "All eight badges illuminate the lens. The Engine winds down, releasing Lugia and Ho-Oh’s currents into the sky. Dawn gives way to moving clouds. Robin smiles: “Astra gets to choose its own tomorrow.”";
const leaderVictory = [
  "Your care for the forest is as strong as your team. Take the Canopy Badge; Cut will open the groves that connect our communities.",
  "You brought the harbor its light and earned the Tidal Badge. Surf will carry you across the marked shallows.",
  "You restored our power and earned the Dynamo Badge. Flash will reveal paths hidden in the dark.",
  "You listened to the ruins and earned the Mirage Badge. Strength will move the marked boulders in your path.",
  "You stood up for the Pokémon in the mine. Take the Ember Badge; Rock Smash will open cracked walls.",
  "You reopened the pass and earned the Rime Badge. Whirlpool will calm the marked marine currents.",
  "You heard the truth in the bells and earned the Chime Badge. Waterfall opens the summit pools.",
  "The final lens shines because you trusted the keepers. Take the Astral Badge and Fly between towns you have visited.",
];
leaders.forEach((_, i) => {
  WORLD[`gym${i + 1}`].objects.find(
    (o) => o.id === `leader_${i + 1}`,
  )!.victoryDialogue = leaderVictory[i];
});
const champion = WORLD.league.objects.find((o) => o.id === "league_4")!;
champion.dialogue =
  "I am Mira, Champion of the Astral League. You brought the beacons together without asking Astra to stand still. Let us see the strength of the bond that carried you here.";
champion.victoryDialogue =
  "Champion Mira welcomes you to the Hall of Fame. Across Astra, the beacons glow with the changing sky. Robin and Alder await your next discovery: the restored Aurora Sanctuary and the living atlas of all 251 species.";
const townVoices: Record<string, [string, string][]> = {
  dewdrop: [
    [
      "Gardener",
      "The flowers follow the morning light. Alder says the beacons help migrating Pokémon find their way.",
    ],
    [
      "Neighbor",
      "Robin has always wanted to make Astra safer. The two of you used to race down Dewpath.",
    ],
  ],
  mossford: [
    [
      "Miller",
      "The orchard windmills should turn steadily, but the wind has been strange since the beacon dimmed.",
    ],
    [
      "Courier’s friend",
      "The courier has a delivery for Bramble. Perhaps you could carry it along Orchard Lane.",
    ],
  ],
  bramble: [
    [
      "Woodcutter",
      "Lantern Wood used to be easy to cross. Follow the leaf trail if you go looking for the surveyor.",
    ],
    [
      "Keeper’s apprentice",
      "Fern will challenge you after the surveyor is safe. Read the leaf clues carefully.",
    ],
  ],
  tideglass: [
    [
      "Sailor",
      "Without the fog signal, boats wait outside the harbor. The cave sluices feed the lighthouse.",
    ],
    [
      "Dockworker",
      "The tide leaves old stones and unusual Pokémon along the shore. Surf can reach the distant crossing.",
    ],
  ],
  copperwick: [
    [
      "Mechanic",
      "The lights go out whenever Meridian’s new line draws power. The Switchyard leads to Copperworks.",
    ],
    [
      "Canal resident",
      "We were promised cleaner power. I only want the pumps to work and the water to keep moving.",
    ],
  ],
  sunspire: [
    [
      "Glassblower",
      "The old lens was made to follow the sun, not trap it. The ruins still hold its markings.",
    ],
    [
      "Oasis traveler",
      "Take water for the road. The rangers beyond the dunes know every trail through the reeds.",
    ],
  ],
  reedhaven: [
    [
      "Ranger apprentice",
      "Our census keeps track of which habitats are recovering. Please record what you catch.",
    ],
    [
      "Bridge keeper",
      "The bamboo bridge is raised. A winch in the sanctuary can lower it again.",
    ],
  ],
  cinderfall: [
    [
      "Miner",
      "Meridian sealed a lower tunnel and brought cages through after dark. The Pokémon sounded frightened.",
    ],
    [
      "Bath attendant",
      "The warm springs are gentler when the furnace vents are open in the right order.",
    ],
  ],
  rimepeak: [
    [
      "Climber",
      "The pass froze almost overnight. A pump in Frostvault once carried warm water beneath it.",
    ],
    [
      "Herbalist",
      "Snow herbs grow in the cavern. Mossford’s healer has been waiting for a fresh supply.",
    ],
  ],
  bellweather: [
    [
      "Bell keeper",
      "The bells remember more than any one person. Their tones can open the tower’s inner chamber.",
    ],
    [
      "Pilgrim",
      "Robin came through looking worried. They asked whether the ancient keepers feared the dark.",
    ],
  ],
  aster: [
    [
      "Astronomer",
      "The observatory charts a moving sky. Orion says the last lens can bring its beacon back.",
    ],
    [
      "Student",
      "The Engine makes a sunrise that never changes. Even the migrating Pokémon seem confused.",
    ],
  ],
  crown: [
    [
      "Mountaineer",
      "Victory Ascent has a gate built to test every keeper’s trust. The League lies just beyond.",
    ],
    [
      "League attendant",
      "Take time to prepare. Mira welcomes trainers who have crossed Astra with their Pokémon.",
    ],
  ],
};
for (const [id] of townData)
  townVoices[id].forEach(([name, dialogue], i) => {
    const m = WORLD[id],
      [x, y] = freePosition(m);
    obj(id, {
      id: `resident_${id}_${i}`,
      kind: "person",
      name,
      dialogue,
      x,
      y,
    });
  });
const questText: Record<string, string> = {
  parcel:
    "Speak to the Mossford courier, then deliver the parcel to the courier in Bramble for Great Balls.",
  hearth:
    "Show a Growlithe or Vulpix in your party to the Dewdrop elder for a Fire Stone.",
  pollinators:
    "Register three different Bug species, then speak with the orchard keeper in Mossford for a Leaf Stone.",
  angler:
    "Register three different Water species, then visit the Tideglass angler for a Water Stone.",
  lighthouse:
    "Earn Surf and return to the Tideglass lighthouse keeper to meet Lapras.",
  collector:
    "Find machine parts on Routes 06 and 07 and in Copperworks, then take them to the Copperwick collector for a Thunder Stone.",
  fossil:
    "Find the fossil in Old Quarry on Route 23 and speak to the excavator there to revive Omanyte.",
  oasis:
    "Restore the Hourglass Ruins lens, then speak to the Sunspire glassworker for Moon and Sun Stones.",
  census:
    "Register 30 species and report to the Reedhaven ranger for an Exp Share.",
  bamboo_friend:
    "Earn Cut and reach the ranger in Bamboo Sanctuary’s inner chamber for a rare lure.",
  furnace:
    "Collect ore in Ember Mine, free the captive Pokémon, then visit the Cinderfall artisan for a Metal Coat and Link Cable.",
  medicine:
    "Collect the snow herb in Frostvault and take it to the Mossford herbalist for a friendship charm.",
  echoes:
    "Earn Flash and reach the historian in the Echo Bell Tower inner chamber to meet Unown.",
  promise:
    "Defeat Robin on Routes 02, 06, 12 and 18, then speak to Robin in Aster for Eevee.",
  chart:
    "Earn all eight badges and show the Aster stargazer for a Master Ball.",
  atlas:
    "Register all 251 species and visit the researcher in Aurora Sanctuary for the Aurora certificate.",
};
QUESTS.forEach((q) => {
  q.description = questText[q.id] ?? q.description;
});
for (const [, id] of rivals) {
  const o = Object.values(WORLD)
    .flatMap((m) => m.objects)
    .find((o) => o.id === id)!;
  o.victoryDialogue =
    id === "rival_1"
      ? "You and your partner are already a great team. I’ll keep training too!"
      : id === "rival_2"
        ? "That was close! I still believe Meridian can help, but I want to understand the power records."
        : id === "rival_3"
          ? "The rangers’ report is hard to ignore. I’m going to find out what Meridian is hiding."
          : "We can protect Astra together. Let’s stop the Engine and meet again after the League.";
}

// Outdoor connections are roads, not interior warps. The main road travels east;
// the two northern and southern branches leave their origin in those directions.
// Each route carries that orientation through to its far end.
const branchDirections: Record<string, Direction> = {
  "21": "north",
  "22": "south",
  "23": "north",
  "24": "south",
  "25": "south",
};
const opposite: Record<Direction, Direction> = {
  north: "south",
  south: "north",
  east: "west",
  west: "east",
};
const edgeUse = new Map<string, number>();
function roadEndpoint(m: WorldMap, direction: Direction): [number, number] {
  const key = `${m.id}:${direction}`;
  const used = edgeUse.get(key) ?? 0;
  edgeUse.set(key, used + 1);
  // Space junctions apart so separate roads cannot trigger one another.
  const offset = used === 0 ? 0 : Math.ceil(used / 2) * 5 * (used % 2 ? -1 : 1);
  return direction === "west"
    ? [0, Math.floor(m.height / 2) + offset]
    : direction === "east"
      ? [m.width - 1, Math.floor(m.height / 2) + offset]
      : direction === "north"
        ? [Math.floor(m.width / 2) + offset, 0]
        : [Math.floor(m.width / 2) + offset, m.height - 1];
}
function moveRoad(m: WorldMap, exit: Exit, direction: Direction) {
  const old: [number, number] = [exit.x, exit.y];
  const [x, y] = roadEndpoint(m, direction);
  exit.x = x;
  exit.y = y;
  exit.direction = direction;
  exit.span = 1;
  // Find a corridor to the existing path without cutting through buildings.
  const grid = m.tiles.map((row) => row.split(""));
  const queue: [number, number][] = [[x, y]];
  const previous = new Map<string, string | null>([[`${x},${y}`, null]]);
  for (let i = 0; i < queue.length; i++) {
    const [cx, cy] = queue[i];
    if (cx === old[0] && cy === old[1]) break;
    for (const [nx, ny] of [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ]) {
      const key = `${nx},${ny}`;
      if (
        nx < 0 ||
        ny < 0 ||
        nx >= m.width ||
        ny >= m.height ||
        previous.has(key)
      )
        continue;
      if (
        (nx === 0 || ny === 0 || nx === m.width - 1 || ny === m.height - 1) &&
        !(nx === x && ny === y)
      )
        continue;
      if ("rwd".includes(grid[ny][nx])) continue;
      previous.set(key, `${cx},${cy}`);
      queue.push([nx, ny]);
    }
  }
  let key: string | null = `${old[0]},${old[1]}`;
  if (!previous.has(key)) throw Error(`No road to ${m.id} ${exit.label}`);
  while (key !== null) {
    const [px, py] = key.split(",").map(Number);
    grid[py][px] = grid[py][px] === "~" ? "=" : ".";
    key = previous.get(key)!;
  }
  m.tiles = grid.map((row) => row.join(""));
}
for (const [n, , a, b] of routeData) {
  const route = WORLD[`route${n}`],
    outward = branchDirections[n] ?? "east";
  const start = WORLD[a].exits.find((e) => e.to === route.id)!;
  const back = route.exits.find((e) => e.to === a)!;
  moveRoad(WORLD[a], start, outward);
  moveRoad(route, back, opposite[outward]);
  start.toX = back.x;
  start.toY = back.y;
  back.toX = start.x;
  back.toY = start.y;
  if (WORLD[b].kind === "town") {
    const forward = route.exits.find((e) => e.to === b)!;
    const arrival = WORLD[b].exits.find((e) => e.to === route.id)!;
    moveRoad(route, forward, outward);
    moveRoad(WORLD[b], arrival, opposite[outward]);
    forward.toX = arrival.x;
    forward.toY = arrival.y;
    arrival.toX = forward.x;
    arrival.toY = forward.y;
  }
}

// Irregular groves frame the roads, while the first settlements have their own
// landmarks: Dewdrop's pond and flower garden, Mossford's orchard and stream.
for (const m of Object.values(WORLD).filter(
  (m) => m.kind === "town" || m.kind === "route",
)) {
  const grid = m.tiles.map((row) => row.split(""));
  const protectedCell = (x: number, y: number) =>
    m.exits.some((e) => Math.abs(e.x - x) + Math.abs(e.y - y) <= 2) ||
    m.objects.some((o) => Math.abs(o.x - x) + Math.abs(o.y - y) <= 1);
  const seed = [...m.id].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  for (let y = 1; y < m.height - 1; y++)
    for (let x = 1; x < m.width - 1; x++) {
      const fringe = Math.min(x, y, m.width - 1 - x, m.height - 1 - y);
      if (
        fringe <= 2 &&
        grid[y][x] === "," &&
        !protectedCell(x, y) &&
        (x * 13 + y * 7 + seed) % 11 < (fringe === 1 ? 6 : 3)
      )
        grid[y][x] = "#";
    }
  if (m.id === "dewdrop") {
    for (let y = 18; y <= 20; y++)
      for (let x = 23; x <= 27; x++)
        if (grid[y][x] === "," && !protectedCell(x, y)) grid[y][x] = "~";
    for (let y = 8; y <= 10; y++)
      for (let x = 3; x <= 7; x++) if (grid[y][x] === ",") grid[y][x] = "f";
  }
  if (m.id === "route01") {
    // A meadow pond nestles north of the path; flowers mark its bank.
    for (let y = 3; y <= 5; y++)
      for (let x = 25; x <= 31; x++)
        if ((grid[y][x] === "," || grid[y][x] === "g") && !protectedCell(x, y))
          grid[y][x] = y === 3 && (x === 25 || x === 31) ? "f" : "~";
    for (let x = 23; x <= 32; x++) if (grid[6][x] === ",") grid[6][x] = "f";
  }
  if (m.id === "route02") {
    // Orchard rows run alongside the lane, with grassy clearings between them.
    for (let y = 4; y < m.height - 4; y += 5)
      for (const x of [4, 8, m.width - 9, m.width - 5])
        if ((grid[y][x] === "," || grid[y][x] === "g") && !protectedCell(x, y))
          grid[y][x] = "#";
  }
  if (m.id === "mossford") {
    for (let y = 6; y < m.height - 5; y += 4)
      for (let x = m.width - 8; x < m.width - 2; x += 3)
        if (grid[y][x] === "," && !protectedCell(x, y)) grid[y][x] = "#";
    for (let x = 2; x < m.width - 2; x++)
      if (grid[m.height - 3][x] === "," && !protectedCell(x, m.height - 3))
        grid[m.height - 3][x] = "~";
  }
  m.tiles = grid.map((row) => row.join(""));
}
for (const m of Object.values(WORLD))
  for (const o of m.objects) {
    if (["person", "healer", "shop", "starter"].includes(o.kind)) {
      o.facing = "down";
      if (o.kind === "person" && o.id.startsWith("resident_")) o.roam = 1;
    }
    if (o.kind === "trainer") {
      o.facing = "down";
      o.sightRange = 3;
    }
  }
// Ensure every landmark joins the street network even where a grove meets a door.
for (const m of Object.values(WORLD).filter(
  (m) => m.kind === "town" || m.kind === "route",
)) {
  const grid = m.tiles.map((row) => row.split(""));
  const origin = m.exits[0];
  for (const target of [...m.exits, ...m.objects]) {
    const queue: [number, number][] = [[origin.x, origin.y]];
    const prev = new Map<string, string | null>([
      [`${origin.x},${origin.y}`, null],
    ]);
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i];
      if (x === target.x && y === target.y) break;
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ]) {
        const k = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height || prev.has(k))
          continue;
        if (
          (nx === 0 || ny === 0 || nx === m.width - 1 || ny === m.height - 1) &&
          !(nx === target.x && ny === target.y)
        )
          continue;
        if ("rw".includes(grid[ny][nx])) continue;
        prev.set(k, `${x},${y}`);
        queue.push([nx, ny]);
      }
    }
    let key: string | null = `${target.x},${target.y}`;
    if (!prev.has(key)) throw Error(`No path to ${m.id} ${key}`);
    while (key !== null) {
      const [x, y] = key.split(",").map(Number);
      if ("#~".includes(grid[y][x]))
        grid[y][x] = grid[y][x] === "~" ? "=" : ".";
      key = prev.get(key)!;
    }
  }
  m.tiles = grid.map((row) => row.join(""));
}

// The opening is hand-composed as a village, riverside orchard town and two
// different stretches of countryside. Coordinates below are part of the map
// design: roads meet doors and junctions rather than being inferred from exits.
function openingMap(id: string, base: string) {
  const m = WORLD[id];
  const g = Array.from(
    { length: m.height },
    () => Array(m.width).fill(base) as string[],
  );
  const rect = (x1: number, y1: number, x2: number, y2: number, c: string) => {
    for (let y = Math.max(0, y1); y <= Math.min(m.height - 1, y2); y++)
      for (let x = Math.max(0, x1); x <= Math.min(m.width - 1, x2); x++)
        g[y][x] = c;
  };
  const road = (points: [number, number][], width = 1) => {
    for (let i = 1; i < points.length; i++) {
      let [x, y] = points[i - 1];
      const [tx, ty] = points[i];
      const paint = () => {
        for (let dy = -width; dy <= width; dy++)
          for (let dx = -width; dx <= width; dx++) {
            const xx = x + dx,
              yy = y + dy;
            if (xx >= 0 && yy >= 0 && xx < m.width && yy < m.height)
              g[yy][xx] = "~=".includes(g[yy][xx]) ? "=" : ".";
          }
      };
      paint();
      while (x !== tx) {
        x += Math.sign(tx - x);
        paint();
      }
      while (y !== ty) {
        y += Math.sign(ty - y);
        paint();
      }
    }
  };
  const building = (to: string, x: number, y: number) => {
    rect(x, y, x + 6, y + 1, "r");
    rect(x, y + 2, x + 6, y + 2, "w");
    const e = m.exits.find((e) => e.to === to)!;
    e.x = x + 3;
    e.y = y + 2;
    e.entrance = "door";
    g[e.y][e.x] = "d";
    const back = WORLD[to].exits.find((exit) => exit.to === id)!;
    back.toX = e.x;
    back.toY = e.y;
    back.entrance = "door";
  };
  const place = (positions: Record<string, [number, number]>) => {
    for (const [objectId, [x, y]] of Object.entries(positions)) {
      const o = m.objects.find((object) => object.id === objectId);
      if (o) {
        o.x = x;
        o.y = y;
        if ("#~rw".includes(g[y][x])) g[y][x] = ",";
      }
    }
  };
  // An uneven tree line suggests the landscape continues beyond the map.
  for (let x = 0; x < m.width; x++) {
    g[0][x] = "#";
    g[m.height - 1][x] = "#";
  }
  for (let y = 0; y < m.height; y++) {
    g[y][0] = "#";
    g[y][m.width - 1] = "#";
  }
  if (id === "dewdrop") {
    rect(1, 1, 4, 7, "#");
    rect(1, 2, 2, 11, "#");
    rect(27, 1, 30, 7, "#");
    rect(1, 18, 2, 26, "#");
    rect(27, 20, 30, 26, "#");
    rect(21, 24, 29, 26, "#");
    // Pond on the southeast green, with an irregular shore and flower garden.
    rect(22, 17, 27, 20, "~");
    rect(23, 16, 26, 21, "~");
    rect(3, 9, 8, 11, "f");
    rect(19, 5, 25, 7, "f");
    // The village green opens onto a square; lanes link homes and the lab.
    rect(12, 11, 19, 17, ".");
    road(
      [
        [0, 14],
        [31, 14],
      ],
      1,
    );
    road(
      [
        [16, 0],
        [16, 27],
      ],
      1,
    );
    road(
      [
        [5, 24],
        [5, 20],
        [16, 20],
      ],
      1,
    );
    road(
      [
        [6, 6],
        [6, 14],
      ],
      1,
    );
    road(
      [
        [14, 6],
        [14, 12],
      ],
      1,
    );
    road(
      [
        [24, 8],
        [24, 14],
      ],
      1,
    );
    building("home", 3, 21);
    building("lab", 11, 3);
    building("dewdrop_center", 3, 3);
    building("dewdrop_mart", 21, 5);
    place({
      robin_start: [14, 13],
      quest_hearth: [18, 16],
      sign_dewdrop: [12, 15],
      resident_dewdrop_0: [8, 10],
      resident_dewdrop_1: [21, 13],
    });
  } else if (id === "mossford") {
    // The river bends along the south side, crossed by a market bridge.
    rect(1, 21, 30, 23, "~");
    rect(1, 19, 7, 22, "~");
    rect(23, 23, 30, 25, "~");
    rect(1, 1, 4, 8, "#");
    rect(27, 1, 30, 6, "#");
    rect(1, 25, 4, 26, "#");
    // An orchard occupies the northwest terraces and eastern river bank.
    for (const [x, y] of [
      [6, 3],
      [9, 3],
      [6, 6],
      [9, 6],
      [5, 9],
      [9, 9],
      [24, 10],
      [27, 10],
      [24, 13],
      [27, 13],
      [23, 17],
      [27, 17],
    ] as const)
      rect(x, y, x + 1, y + 1, "#");
    rect(11, 11, 19, 17, ".");
    road(
      [
        [0, 14],
        [31, 14],
      ],
      1,
    );
    road(
      [
        [16, 0],
        [16, 26],
        [16, 27],
      ],
      1,
    );
    road(
      [
        [16, 8],
        [22, 8],
        [22, 6],
      ],
      1,
    );
    road(
      [
        [16, 19],
        [8, 19],
        [8, 25],
      ],
      1,
    );
    building("mossford_center", 19, 3);
    building("mossford_mart", 5, 16);
    place({
      robin_mossford: [13, 12],
      quest_parcel: [18, 13],
      quest_pollinators: [11, 10],
      quest_medicine: [19, 16],
      sign_mossford: [13, 17],
      resident_mossford_0: [21, 10],
      resident_mossford_1: [11, 19],
    });
  } else if (id === "route01") {
    // Meadow folds around a northern pond and a southern stand of old trees.
    rect(2, 2, 10, 4, "#");
    rect(1, 2, 3, 8, "#");
    rect(30, 1, 38, 4, "#");
    rect(2, 19, 12, 22, "#");
    rect(27, 19, 38, 22, "#");
    rect(25, 5, 33, 8, "~");
    rect(26, 4, 31, 9, "~");
    rect(8, 6, 17, 9, "f");
    rect(7, 16, 16, 18, "g");
    rect(23, 15, 33, 18, "g");
    road(
      [
        [0, 12],
        [8, 12],
        [8, 14],
        [20, 14],
        [20, 11],
        [32, 11],
        [32, 12],
        [39, 12],
      ],
      1,
    );
    road(
      [
        [20, 11],
        [20, 8],
      ],
      0,
    );
    road(
      [
        [26, 14],
        [26, 17],
      ],
      0,
    );
    place({
      trainer_route01: [13, 11],
      item_route01: [26, 17],
      route01_optional_0: [22, 10],
      route01_optional_1: [18, 17],
    });
  } else {
    // Long orchard lane: the path bends around the stream and through two groves.
    rect(1, 1, 5, 8, "#");
    rect(20, 1, 26, 8, "#");
    rect(1, 30, 6, 38, "#");
    rect(21, 30, 26, 38, "#");
    for (const y of [5, 10, 15, 25, 30, 35])
      for (const x of [7, 11, 18, 22]) rect(x, y, x + 1, y + 1, "#");
    rect(1, 25, 26, 27, "~");
    rect(1, 24, 8, 26, "~");
    rect(3, 10, 5, 15, "f");
    rect(22, 12, 25, 17, "g");
    rect(4, 31, 12, 34, "g");
    road(
      [
        [0, 20],
        [7, 20],
        [7, 17],
        [14, 17],
        [14, 23],
        [20, 23],
        [20, 20],
        [27, 20],
      ],
      1,
    );
    road(
      [
        [14, 23],
        [14, 29],
        [20, 29],
      ],
      1,
    );
    place({
      trainer_route02: [10, 15],
      item_route02: [20, 29],
      rival_1: [17, 20],
      route02_optional_0: [12, 22],
      route02_optional_1: [22, 18],
      evolution_supply_0: [8, 23],
    });
  }
  // Map-edge road mouths use the full width of their connected lanes.
  for (const e of m.exits)
    if (e.direction) {
      g[e.y][e.x] = ".";
      const dx = e.direction === "west" ? 1 : e.direction === "east" ? -1 : 0;
      const dy = e.direction === "north" ? 1 : e.direction === "south" ? -1 : 0;
      g[e.y + dy][e.x + dx] = ".";
    }
  m.tiles = g.map((row) => row.join(""));
}
openingMap("dewdrop", ",");
openingMap("mossford", ",");
openingMap("route01", "g");
openingMap("route02", "g");

for (const m of Object.values(WORLD))
  for (const e of m.exits) {
    if (e.direction) continue;
    const dest = WORLD[e.to];
    e.entrance =
      m.kind === "dungeon" && dest.kind === "dungeon"
        ? "stairs"
        : m.kind === "dungeon" || dest.kind === "dungeon"
          ? "cave"
          : "door";
  }
// Directions describe a person's pose or a trainer's actual line of sight.
const facings = ["down", "left", "up", "right"] as const;
for (const m of Object.values(WORLD))
  m.objects.forEach((o, i) => {
    if (o.facing) o.facing = facings[(i + m.id.length) % facings.length];
  });
for (const [mapId, id, facing] of [
  ["route01", "trainer_route01", "down"],
  ["route01", "route01_optional_0", "down"],
  ["route01", "route01_optional_1", "up"],
  ["route02", "trainer_route02", "down"],
  ["route02", "route02_optional_0", "up"],
  ["route02", "route02_optional_1", "down"],
  ["route02", "rival_1", "left"],
  ["dewdrop", "robin_start", "down"],
  ["mossford", "quest_parcel", "left"],
] as const) {
  const o = WORLD[mapId].objects.find((object) => object.id === id);
  if (o) o.facing = facing;
}
// The road span is one tile on either side of its center. Keep the matching
// destination's edge and inner approach clear for every preserved lateral offset.
for (const m of Object.values(WORLD)) {
  const roads = m.exits.filter((e) => e.direction);
  if (!roads.length) continue;
  const grid = m.tiles.map((row) => row.split(""));
  for (const e of roads)
    for (let lateral = -1; lateral <= 1; lateral++)
      for (let inset = 0; inset <= 1; inset++) {
        const vertical = e.direction === "north" || e.direction === "south";
        const x =
          e.x + (vertical ? lateral : e.direction === "west" ? inset : -inset);
        const y =
          e.y +
          (vertical ? (e.direction === "north" ? inset : -inset) : lateral);
        if (
          x >= 0 &&
          y >= 0 &&
          x < m.width &&
          y < m.height &&
          !"rwd".includes(grid[y][x])
        )
          grid[y][x] = "~=".includes(grid[y][x]) ? "=" : ".";
      }
  m.tiles = grid.map((row) => row.join(""));
}
