import { composeGeography, dimensions, routeDirections } from "./geography";
import { populateHabitats } from "./habitats";

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
  takeItem?: string;
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
export type BarrierKind = Exclude<Ability, "fly"> | "warden" | "shutter";
export interface ExitBarrier {
  kind: BarrierKind;
  /** A field action clears both ends of a shortcut permanently. */
  flag?: string;
}

export interface Exit {
  direction?: Direction;
  span?: number;
  entrance?: "door" | "cave" | "stairs" | "mat";
  /** Horizontal tile count for a non-directional exit, anchored at x. */
  width?: number;
  barrier?: ExitBarrier;
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

function map(
  id: string,
  name: string,
  kind: WorldMap["kind"],
  palette: string,
): WorldMap {
  const [width, height] = dimensions(id, kind);
  const value: WorldMap = {
    id,
    name,
    kind,
    palette,
    width,
    height,
    tiles: Array.from({ length: height }, () => ".".repeat(width)),
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
townData.forEach(([id, name, palette]) => map(id, name, "town", palette));
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
routeData.forEach(([n, name, , , palette]) =>
  map(`route${n}`, `Route ${n} · ${name}`, "route", palette),
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
const serviceVisitors: Record<string, [[string, string], [string, string]]> = {
  dewdrop: [
    [
      "Bug catcher",
      "I practice with Scout Ari on Dewpath. If you’ve already beaten him, talk to him for another battle.",
    ],
    [
      "Supply runner",
      "Alder hands new trainers a few Poké Balls and Potions. I buy more when I’ve found a place worth exploring.",
    ],
  ],
  mossford: [
    [
      "Orchard picker",
      "Poison can cut a trip short. Heal here before taking Orchard Lane east.",
    ],
    [
      "Orchard shopper",
      "Look in the grass beside the bridge on Orchard Lane. Someone dropped a Fire Stone there.",
    ],
  ],
  bramble: [
    [
      "Survey volunteer",
      "The surveyor is somewhere past the north trail. The floor switches in Lantern Wood light the way.",
    ],
    [
      "Woodland guide",
      "Keep a few Poké Balls ready for the Lantern Approach. The locals’ Pokémon are good at wearing down a new team.",
    ],
  ],
  tideglass: [
    [
      "Harbor fisher",
      "Once you learn Surf, you can set off from the buoys on the east quay. That takes you toward Copperwick.",
    ],
    [
      "Sailor",
      "I keep a stronger ball for Pokémon that get away from the first one. The harbor has a fine fishing spot.",
    ],
  ],
  copperwick: [
    [
      "Line worker",
      "The lights flicker even here. The old power station is up Switchyard Road.",
    ],
    [
      "Scrap picker",
      "Three parts went missing from the workshop. The collector in town is still looking for them.",
    ],
  ],
  sunspire: [
    [
      "Desert traveler",
      "The trails around Glassway curve between old walls. A break here saves a longer trip back through the dunes.",
    ],
    [
      "Glassworks hand",
      "Evolution stones work on particular species. Check the Party screen before using one.",
    ],
  ],
  reedhaven: [
    [
      "Field ranger",
      "You can carry six partners. Look under Storage in the menu if you want to rotate in a new catch.",
    ],
    [
      "Bird watcher",
      "Repel buys you time to look around in tall grass when you’re already going somewhere.",
    ],
  ],
  cinderfall: [
    [
      "Mine hand",
      "Our crews carry extras of anything that heals a burn. The steam vents don’t always give much notice.",
    ],
    [
      "Furnace apprentice",
      "The artisan in town is collecting a special ore. If you’re visiting the mine, keep an eye out for it.",
    ],
  ],
  rimepeak: [
    [
      "Pass hiker",
      "Use a Center before you head into Frostvault. Trainers and wild Pokémon share the lower passages.",
    ],
    [
      "Mountain guide",
      "I stock up before going north. If you run low on move PP halfway through a route, an Ether helps.",
    ],
  ],
  bellweather: [
    [
      "Tower pilgrim",
      "When you climb Echo Bell Tower, listen for the order in which the bells sound.",
    ],
    [
      "Archivist",
      "The old tower has a side chamber. You’ll find the route clearer once you have Flash.",
    ],
  ],
  aster: [
    [
      "Sky watcher",
      "The final beacon is in the observatory west of town. Astra’s sky should start moving again once it’s back.",
    ],
    [
      "Observatory aide",
      "Follow Crown Road north to Victory Ascent. Take restoration supplies before you head up, especially if you plan to challenge the League.",
    ],
  ],
  crown: [
    [
      "League challenger",
      "Rowan starts with Grass types around Lv 55. I brought a Fire type and saved my Ice moves for Mira.",
    ],
    [
      "Returning challenger",
      "I forgot to check my move PP last time. Look at your whole party before you go in.",
    ],
  ],
};
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
    const [visitor, dialogue] =
      serviceVisitors[town][suffix === "center" ? 0 : 1];
    obj(id, { id: `${id}_visitor`, kind: "person", name: visitor, dialogue });
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
for (const [town, title, host, dialogue] of [
  [
    "mossford",
    "Windmill Cottage",
    "Millwright",
    "My father measured the wind by the bell above Bramble. Fern will lend you Cut after you earn the Canopy Badge. With it you can walk straight back to Dewdrop through the old grove.",
  ],
  [
    "bramble",
    "Lantern Lodge",
    "Trail warden",
    "If you’re looking for the surveyor, take the Lantern Approach north. People who get turned around in the woods leave a trail of lamps.",
  ],
  [
    "tideglass",
    "Harbor Office",
    "Pilot",
    "The western road is safe on foot. To go east, follow the buoys off the end of the quay and use Surf once Marina has given you the Tidal Badge.",
  ],
  [
    "sunspire",
    "Glassworks",
    "Lens maker",
    "Keep a Sun Stone or Moon Stone for a Pokémon that responds to it. You can find more among the offerings beside the Hourglass Ruins.",
  ],
  [
    "reedhaven",
    "Ranger Cabin",
    "Field researcher",
    "An extra catch goes to Storage when you already travel with six. It still counts in our habitat census.",
  ],
  [
    "rimepeak",
    "Pass Shelter",
    "Shelter keeper",
    "The snow herb from Frostvault travels well. The healer who uses it lives by the bridge in Mossford.",
  ],
  [
    "aster",
    "Chart Room",
    "Cartographer",
    "Write down the names of every beacon you visit. The astronomer in the plaza gives an award when your chart is complete.",
  ],
] as const) {
  const id = `${town}_house`;
  map(id, title, "interior", WORLD[town].palette);
  connect(town, id, title, WORLD[town].name);
  obj(id, { id: `${id}_host`, kind: "person", name: host, dialogue });
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
  lockedDialogue:
    "Alder’s waiting at the lab by the north garden. Go pick your partner, then we can see what happened to the beacons.",
});
// Main road gates ensure each community's story is completed before leaving.
const gates: Record<string, Requirement> = {
  "01": { flags: ["partner"] },
  "04": { badges: 1, ability: "cut" },
  "06": { badges: 2, ability: "surf" },
  "08": { badges: 3, ability: "flash" },
  "12": { flags: ["ranger_report"] },
  "16": { badges: 6, ability: "whirlpool" },
  "18": { badges: 7, ability: "waterfall" },
  "20": { badges: 8, flags: ["engine_stopped"] },
  "21": { ability: "cut" },
  "22": { ability: "surf", badges: 3 },
  "23": { ability: "strength" },
  "24": { ability: "whirlpool", badges: 6 },
  "25": { flags: ["champion"] },
};
const roadAdvice: Record<string, string> = {
  "01": "Visit Professor Alder at the north end of Dewdrop and choose your partner first.",
  "04": "A young tree blocks the trail. Rescue the surveyor in Lantern Wood, then earn Cut from Fern.",
  "06": "The quay ends here. Restore the signal in Undertow Cave, then earn Surf from Marina.",
  "08": "The passage is too dark to follow. Restore power at Copperworks, then earn Flash from Volt.",
  "12": "The ranger crew has closed the trail. Find their report across the bridge in Bamboo Sanctuary.",
  "16": "Meltwater pours through the pass. Reopen the route in Frostvault, then earn Whirlpool from Neve.",
  "18": "The trail climbs past a waterfall. Follow the bells in Echo Bell Tower, then earn Waterfall from Lyra.",
  "20": "Earn the Astral Badge and shut down the Celestial Engine before climbing to Crown Summit.",
  "21": "Fern’s Canopy Badge teaches Cut, which opens the overgrown trail.",
  "22": "The harbor launches for Reedhaven when the Copperwick beacon has power. Bring Surf and three badges.",
  "23": "A quarry cart has jumped its rails. Bring Strength from Sunspire to clear the freight road.",
  "24": "Cross the whirlpool with Neve’s field ability once six beacons are lit.",
  "25": "The sanctuary researchers open this trail once you enter the Hall of Fame.",
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
  if (roadAdvice[n]) {
    WORLD[a].exits.find((e) => e.to === id)!.lockedDialogue = roadAdvice[n];
    const arrival = WORLD[b].exits.find((e) => e.to === id)!;
    if (arrival.requires) arrival.lockedDialogue = roadAdvice[n];
  }
}
connect("bellweather", "meridian_1", "Meridian HQ", "Bellweather", {
  flags: ["revelation"],
});
connect("crown", "victory_1", "Victory Ascent", "Crown Summit", {
  badges: 8,
  flags: ["engine_stopped"],
});
WORLD.bellweather.exits.find((e) => e.to === "meridian_1")!.lockedDialogue =
  "The records office is closed to visitors. The keeper in Echo Bell Tower can tell you what Meridian is hiding.";
WORLD.crown.exits.find((e) => e.to === "victory_1")!.lockedDialogue =
  "The ascent wardens need all eight badges and confirmation that the Celestial Engine has shut down.";
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
  // Both ends of the return passage stay locked until the objective is done.
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
const keeperAdvice = [
  "Bring the surveyor home from Lantern Wood and follow the seed, sprout and canopy trail in the gym.",
  "Get the lighthouse signal working in Undertow Cave, then set the gym sluices from high tide to low.",
  "Restore the town’s power in Copperworks and reconnect the relays in this room.",
  "Find the lens in Hourglass Ruins and set the gym’s weights from lightest to heaviest.",
  "Free the Pokémon in Ember Mine, then clear the gym furnace vents in order.",
  "Open the Frostvault pass and thaw this room’s channels from spring to pool.",
  "Listen to the memory in Echo Bell Tower, then ring the gym bells from low to high.",
  "Recover the observatory lens and align these four stars in the order marked on the chart.",
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
  for (let n = 1; n <= (i === 7 ? 4 : 3); n++) {
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
    requires: { flags: [objectives[i], previous!], badges: i >= 3 && i <= 5 ? 3 : i },
    lockedDialogue: keeperAdvice[i],
    setsFlag: `badge${i + 1}`,
    reward: { badge: i + 1, ability: ABILITIES[i] },
    trainer: { id: `leader_${i + 1}`, name, team, reward: 1000 * (i + 1) },
  });
});
const habitats = routeData.map(([n]) => WORLD[`route${n}`]);
populateHabitats(WORLD);
const routeTrainers = [
  "Scout Ari",
  "Orchard hand Bea",
  "Surveyor Cleo",
  "Ferry hand Dara",
  "Deckhand Emil",
  "Lockkeeper Nessa",
  "Mechanic Oren",
  "Dune guide Iona",
  "Glass apprentice May",
  "Wader Taran",
  "Ranger Kestrel",
  "Kiln hand Bran",
  "Prospector Luz",
  "Climber Asa",
  "Skater Sanna",
  "Botanist Eira",
  "Pilgrim Sol",
  "Nightwatcher Hala",
  "Lab aide Nico",
  "Mountaineer Liv",
  "Forester Fenn",
  "Swimmer Keo",
  "Excavator Esti",
  "Diver Valea",
  "Ecologist Ren",
];
const trailItems = [
  [
    "potion",
    "Meadow first-aid tin",
    "You find two Potions under the pond boardwalk.",
  ],
  [
    "potion",
    "Orchard kit",
    "Someone left two Potions at the foot of the orchard bridge.",
  ],
  [
    "potion",
    "Surveyor supplies",
    "The survey team left two spare Potions here.",
  ],
  ["potion", "Ford supplies", "A watertight pouch holds two Potions."],
  [
    "great_ball",
    "Tidepool pouch",
    "Two Great Balls are tucked in a dry cleft above the tide line.",
  ],
  [
    "great_ball",
    "Canal locker",
    "You find two Great Balls left by the old lockkeeper.",
  ],
  [
    "great_ball",
    "Yard toolbox",
    "A disused toolbox holds two clean Great Balls.",
  ],
  [
    "great_ball",
    "Dune cache",
    "You brush the sand off a box containing two Great Balls.",
  ],
  [
    "great_ball",
    "Glassworks jar",
    "Two Great Balls are wrapped in cloth inside the jar.",
  ],
  [
    "great_ball",
    "Reed bundle",
    "You untie a bundle of reeds and find two Great Balls.",
  ],
  [
    "great_ball",
    "Ranger pack",
    "A waterproof ranger pack holds two Great Balls.",
  ],
  [
    "great_ball",
    "Trail bivouac",
    "You find two Great Balls in the shade of a lava shelf.",
  ],
  [
    "ultra_ball",
    "Miner’s pouch",
    "A discarded ore pouch holds two Ultra Balls.",
  ],
  [
    "ultra_ball",
    "Climbing tin",
    "A small tin by the cairn contains two Ultra Balls.",
  ],
  [
    "ultra_ball",
    "Winter stash",
    "You lift the lid of an insulated box and find two Ultra Balls.",
  ],
  [
    "ultra_ball",
    "Gardener’s spare kit",
    "A canvas roll tucked among the flowers holds two Ultra Balls.",
  ],
  [
    "ultra_ball",
    "Pilgrim’s supplies",
    "Two Ultra Balls are tucked under a dry niche in the wall.",
  ],
  [
    "ultra_ball",
    "Lakeside parcel",
    "You open a dry package in the reeds and find two Ultra Balls.",
  ],
  [
    "ultra_ball",
    "Maintenance box",
    "Two Ultra Balls rattle in an old observatory maintenance box.",
  ],
  [
    "ultra_ball",
    "Summit trail cache",
    "A climbing party left two Ultra Balls for the next traveler.",
  ],
  [
    "ultra_ball",
    "Grove supplies",
    "A field kit protected by the old trees holds two Ultra Balls.",
  ],
  [
    "ultra_ball",
    "Flotsam pouch",
    "A pouch washed up on the island contains two Ultra Balls.",
  ],
  [
    "ultra_ball",
    "Quarry locker",
    "You find two Ultra Balls in a dry crevice above the fossil beds.",
  ],
  [
    "ultra_ball",
    "Beacon offering",
    "Two Ultra Balls rest in a weatherproof box by the shrine.",
  ],
  [
    "ultra_ball",
    "Research supplies",
    "The researchers left two Ultra Balls for sanctuary visitors.",
  ],
];
routeData.forEach(([n, name], i) => {
  const id = `route${n}`;
  const level = Math.min(53, 7 + i * 2);
  const trainer = routeTrainers[i];
  const [item, cache, description] = trailItems[i];
  const team = habitats[i].encounters
    .slice(0, i < 4 ? 1 : 2)
    .map(({ species }) => ({ species, level }));
  obj(id, {
    id: `trainer_route${n}`,
    kind: "trainer",
    name: trainer,
    dialogue: `I know ${name} well. Let’s see how your team handles this stretch.`,
    setsFlag: `trainer_route${n}_won`,
    trainer: {
      id: `trainer_route${n}`,
      name: trainer,
      team,
      reward: level * 40,
    },
  });
  obj(id, {
    id: `item_route${n}`,
    kind: "item",
    name: cache,
    dialogue: description,
    setsFlag: `item_route${n}_found`,
    reward: { item, amount: 2 },
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
const robinAdvice: Record<string, string> = {
  robin_mossford:
    "Did you meet Alder yet? Head west down Dewpath to Dewdrop if you still need your first partner.",
  robin_copperwick:
    "I’m watching this power line. If you’re coming from the harbor, talk to Marina about the fog signal first.",
  robin_bellweather:
    "I heard odd things about the tower. Find the bells on Pilgrim Walk, then come back and tell me what they remember.",
  robin_aster:
    "Robin’s voice comes over the radio. “Try the records office in Bellweather. Vale has the clearance for the observatory door.”",
};
scenes.forEach(([where, id, dialogue, requires]) =>
  obj(where, {
    id,
    kind: id === "robin_aster" ? "sign" : "person",
    name: id === "robin_aster" ? "Field radio" : "Robin",
    dialogue,
    requires,
    lockedDialogue: robinAdvice[id],
  }),
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
    "The observatory door needs Vale’s override. Confront him at Meridian HQ in Bellweather.";
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
const leagueRooms = [
  "league",
  "league_petra",
  "league_nyx",
  "league_gale",
  "league_mira",
];
leagueTeam.forEach(([name, team], i) => {
  const room = leagueRooms[i];
  if (i) {
    map(room, `Astral League · ${name}`, "interior", "mountain");
    connect(leagueRooms[i - 1], room, `${name}’s chamber`, "Previous chamber", {
      flags: [`league_${i - 1}_won`],
    });
    const onward = WORLD[leagueRooms[i - 1]].exits.find((e) => e.to === room)!;
    onward.lockedDialogue = "Defeat the specialist in this chamber to proceed.";
  }
  obj(room, {
    id: `league_${i}`,
    kind: "trainer",
    name,
    dialogue: `${name} awaits your challenge.`,
    requires: i
      ? { flags: [`league_${i - 1}_won`] }
      : { flags: ["ascent_complete"], badges: 8 },
    lockedDialogue: i
      ? `Challenge ${leagueTeam[i - 1][0]} in the previous chamber first.`
      : "Ask the wardens at Victory Ascent to open the summit gate before you challenge the League.",
    setsFlag: i === 4 ? "champion" : `league_${i}_won`,
    trainer: { id: `league_${i}`, name, team, reward: 5000 },
  });
});
connect(
  "league_mira",
  "league",
  "Hall of Fame return",
  "Hall of Fame",
  {
    flags: ["champion"],
  },
  {
    flags: ["champion"],
  },
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
  ["aurora_3", "Celebi", 251, { flags: ["champion", "aurora_restored"] }],
];
const guardianAdvice: Record<number, string> = {
  144: "A frozen cascade hides the roost. Lyra’s badge grants Waterfall and opens the way to Articuno.",
  145: "The intake is still too unstable for Zapdos. The keepers will finish repairs after your League challenge.",
  146: "The old ore vault is behind fractured rock. Return with Rock Smash from Flint.",
  150: "The lab capsule is sealed. It can be opened once the League recognizes your work restoring the beacons.",
  151: "The oldest tree stirs. Return with records of at least 100 different species from your journey.",
  243: "The island beacon remains dark until a trainer from Astra enters the Hall of Fame.",
  244: "Heat rises from the quarry stone. The beacon can call Entei once you reach the Hall of Fame.",
  245: "The moonwater shrine needs a fully restored current. Return after the League challenge.",
  249: "An eddy covers the deep tunnel. Neve’s badge teaches Whirlpool, which can calm it.",
  250: "The top bell sounds only after the League recognizes the work of the eight keepers.",
  251: "The grove is quiet. Complete the research seal and restore the sanctuary beacon to call Celebi.",
};
legendary.forEach(([where, name, species, requires]) =>
  obj(where, {
    id: `legendary_${species}`,
    kind: "legendary",
    name,
    dialogue: `${name} is waiting. The guardian will return if you cannot catch it.`,
    requires,
    lockedDialogue: guardianAdvice[species],
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
  "Heading to Bramble? Please take this delivery to the courier there. Follow Orchard Lane east.";
parcel.victoryDialogue =
  "The parcel is safely in your pack. Follow Orchard Lane east to Bramble and find the courier there.";
parcel.setsFlag = "found_parcel";
parcel.reward = { item: "courier_parcel" };
parcel.quest = undefined;
obj("bramble", {
  id: "parcel_recipient",
  kind: "person",
  name: "Bramble courier",
  dialogue:
    "My delivery from Mossford! Thank you for bringing it. Please take these Great Balls.",
  requires: { flags: ["found_parcel"], items: ["courier_parcel"] },
  lockedDialogue: "I am waiting for a delivery from Mossford.",
  setsFlag: "quest_parcel_complete",
  reward: { takeItem: "courier_parcel", item: "great_ball", amount: 5 },
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
  obj(`${id}_1`, {
    id: `${id}_step1`,
    kind: "switch",
    name: first,
    dialogue: `${first}. The way into the next room opens.`,
    setsFlag: `${id}_step1`,
  });
  obj(m.id, {
    id: `${id}_step2`,
    kind: "switch",
    name: second,
    dialogue: `${second}. The mechanism at the far exit responds.`,
    requires: { flags: [`${id}_step1`] },
    lockedDialogue: `First ${first.toLowerCase()} in the previous room.`,
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
    "Trace one night from sunset to zenith to moonset to dawn.",
    ["Sunset star", "Zenith star", "Moonset star", "Dawn star"],
  ],
];
gymClues.forEach(([clue, labels], i) => {
  const m = WORLD[`gym${i + 1}`];
  labels.forEach((label, n) => {
    const o = m.objects.find(
      (object) => object.id === `gym${i + 1}_puzzle${n + 1}`,
    )!;
    o.name = label;
    o.lockedDialogue = clue;
  });
  obj(m.id, {
    id: `gym${i + 1}_clue`,
    kind: "sign",
    name: "Keeper’s clue",
    dialogue: clue,
  });
});

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
    "The market and camp sit on opposite sides of the reed beds. The sanctuary is on higher ground.",
  cinderfall:
    "The washhouse stands below the springs. The mine trail climbs between the high roofs.",
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
  "Take the Dynamo Badge! The dune lamps and the Tideglass ferry signal are lit. Head into the dunes for Sable, or cross to Reedhaven for Flint and Neve. The three keepers will meet you in any order.",
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
const champion = WORLD.league_mira.objects.find((o) => o.id === "league_4")!;
champion.dialogue =
  "I am Mira, Champion of the Astral League. You brought the beacons together without asking Astra to stand still. Let us see the strength of the bond that carried you here.";
champion.victoryDialogue =
  "Champion Mira welcomes you to the Hall of Fame. Across Astra, the beacons glow with the changing sky. Robin and Alder await your next discovery: the living atlas of all 251 species. Take Aurora Trail south from Dewdrop to reach the restored sanctuary.";
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
      "Mira has six Pokémon, up to Lv 62. The trainers on Crown Road will practice with you before you register.",
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

// Orient each through-route across facing edges. The far shore turns west.
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
  [exit.x, exit.y] = roadEndpoint(m, direction);
  exit.direction = direction;
  exit.span = 1;
}

for (const [n, , a, b] of routeData) {
  const route = WORLD[`route${n}`],
    outward = routeDirections[n] ?? "east";
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

for (const m of Object.values(WORLD))
  for (const e of m.exits) {
    if (e.direction) continue;
    const dest = WORLD[e.to];
    e.entrance =
      (m.id.startsWith("league") && dest.id.startsWith("league")) ||
      (m.kind === "dungeon" && dest.kind === "dungeon")
        ? "stairs"
        : (m.kind === "interior" || m.kind === "gym") && dest.kind === "town"
          ? "mat"
          : m.kind === "dungeon" || dest.kind === "dungeon"
            ? "cave"
            : "door";
    if (e.entrance === "mat") e.width = 2;
  }

composeGeography(WORLD);

const facings = ["down", "left", "up", "right"] as const;
for (const m of Object.values(WORLD)) {
  m.objects.forEach((o, i) => {
    if (["person", "healer", "shop", "starter"].includes(o.kind)) {
      o.facing ??= facings[(i + m.id.length) % facings.length];
      if (o.kind === "person" && o.id.startsWith("resident_")) o.roam = 1;
    }
  });
}
for (const m of Object.values(WORLD)) {
  for (const e of m.exits) {
    if (!e.requires) continue;
    const ability = e.requires.ability;
    const kind = !e.direction
      ? "shutter"
      : ability && ability !== "fly"
        ? ability
        : "warden";
    e.barrier = {
      kind,
      flag:
        kind !== "warden" && kind !== "surf" && kind !== "shutter"
          ? `field_${e.to.startsWith("route") ? e.to : m.id}`
          : undefined,
    };
  }
}
// Poses for story characters.
for (const [mapId, id, facing] of [
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

// Surf is a physical crossing. Once the buoys on the arc are open, the same
// water at both shores keeps movement and the rider sprite continuous.
for (const m of Object.values(WORLD)) {
  const grid = m.tiles.map((row) => row.split(""));
  for (const e of m.exits) {
    if (!e.direction) continue;
    const peer = WORLD[e.to].exits.find(
      (other) => other.to === m.id && other.x === e.toX && other.y === e.toY,
    );
    if (e.barrier?.kind !== "surf" && peer?.barrier?.kind !== "surf") continue;
    const vertical = e.direction === "north" || e.direction === "south";
    for (let lateral = -1; lateral <= 1; lateral++) {
      const x = e.x + (vertical ? lateral : 0);
      const y = e.y + (vertical ? 0 : lateral);
      grid[y][x] = "~";
    }
  }
  m.tiles = grid.map((row) => row.join(""));
}
