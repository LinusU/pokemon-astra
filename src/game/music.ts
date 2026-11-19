import type { WorldMap, WorldObject } from "../world";
import type { Town } from "../world/atlas";

// Music IDs from Crystal's music_constants.asm. The ROM supplies their pointers.
export const MUSIC_TRACKS = {
  silent: 0x00,
  title: 0x01,
  center: 0x09,
  hikerIntro: 0x0a,
  lassIntro: 0x0b,
  officerIntro: 0x0c,
  hallOfFame: 0x14,
  trainerVictory: 0x17,
  wildVictory: 0x18,
  gymVictory: 0x19,
  gym: 0x1b,
  rivalIntro: 0x1f,
  surf: 0x21,
  evolution: 0x22,
  wild: 0x29,
  trainer: 0x2a,
  gymBattle: 0x2e,
  champion: 0x2f,
  rivalBattle: 0x30,
  meridianBattle: 0x31,
  cave: 0x33,
  route: 0x34,
  youngsterIntro: 0x37,
  meridianIntro: 0x39,
  sageIntro: 0x3b,
  town: 0x3c,
  wildNight: 0x4a,
  capture: 0x4c,
  legendary: 0x64,
  professorElm: 50,
  cherrygrove: 38,
  azalea: 37,
  vermilion: 62,
  goldenrod: 61,
  celadon: 22,
  nationalPark: 35,
  viridian: 21,
  violetCity: 45,
  ecruteak: 44,
  lavender: 14,
  indigoPlateau: 70,
  route12: 4,
  route26: 77,
  route30: 43,
  route36: 53,
  route37: 71,
  lighthouse: 68,
  unionCave: 40,
  burnedTower: 67,
  ruinsOfAlph: 85,
  tinTower: 65,
  dragonsDen: 73,
  rocketHideout: 72,
  victoryRoad: 79,
} as const;

export type MusicScene = keyof typeof MUSIC_TRACKS;
const towns: Record<Town, MusicScene> = {
  dewdrop: "town", mossford: "cherrygrove", bramble: "azalea", tideglass: "vermilion",
  copperwick: "goldenrod", sunspire: "celadon", reedhaven: "nationalPark", cinderfall: "viridian",
  rimepeak: "violetCity", bellweather: "ecruteak", aster: "lavender", crown: "indigoPlateau",
};
const roads: Record<string, MusicScene> = {
  meadow: "route", orchard: "route30", autumn: "route30", coast: "route12", industrial: "route36",
  desert: "route36", wetland: "nationalPark", volcanic: "route37", mountain: "route26",
  snow: "route26", violet: "route37", night: "route36",
};
const sites: Record<string, MusicScene> = {
  lantern: "nationalPark", undertow: "lighthouse", copperworks: "rocketHideout", hourglass: "ruinsOfAlph",
  bamboo: "nationalPark", ember: "burnedTower", frostvault: "unionCave", echo: "tinTower",
  meridian: "rocketHideout", starfall: "dragonsDen", victory: "victoryRoad", aurora: "tinTower",
};

export function fieldMusic(map: WorldMap): MusicScene {
  if (map.kind === "gym") return "gym";
  if (map.id.endsWith("_center")) return "center";
  if (map.id === "lab") return "professorElm";
  if (map.kind === "route") return roads[map.palette] ?? "route";
  const [place] = map.id.split("_");
  if (map.kind === "dungeon") return sites[place] ?? "cave";
  if (place === "league") return "indigoPlateau";
  // Houses and shops keep the street music running as the player goes indoors.
  return towns[place as Town] ?? "town";
}

type Opponent = Pick<WorldObject, "id" | "kind" | "name" | "trainer">;

const trainerId = (opponent: Opponent) => opponent.trainer?.id ?? opponent.id;
const rival = (opponent: Opponent) => trainerId(opponent).startsWith("rival_");
const meridian = (opponent: Opponent) => trainerId(opponent).startsWith("meridian_");
const boss = (opponent: Opponent) =>
  opponent.kind === "leader" || trainerId(opponent).startsWith("league_");

// Match Astra's authored trainers to the closest roles in trainer encounter_music.asm.
export function trainerIntroMusic(opponent: Opponent): MusicScene {
  if (rival(opponent)) return "rivalIntro";
  if (meridian(opponent)) return "meridianIntro";
  if (boss(opponent)) return "officerIntro";
  if (/^(picnicker|lass)\b/i.test(opponent.name)) return "lassIntro";
  if (/^(youngster|scout|camper)\b/i.test(opponent.name)) return "youngsterIntro";
  if (/^(sage|pilgrim)\b/i.test(opponent.name)) return "sageIntro";
  return "hikerIntro";
}

export function battleTheme(opponent: Opponent | undefined, night: boolean): MusicScene {
  if (opponent?.kind === "legendary") return "legendary";
  if (!opponent?.trainer || opponent.kind === "wild") return night ? "wildNight" : "wild";
  if (trainerId(opponent) === "league_4") return "champion";
  if (boss(opponent)) return "gymBattle";
  if (rival(opponent)) return "rivalBattle";
  if (meridian(opponent)) return "meridianBattle";
  return "trainer";
}

export function victoryTheme(opponent?: Opponent): MusicScene {
  if (!opponent?.trainer || opponent.kind === "wild" || opponent.kind === "legendary") return "wildVictory";
  return boss(opponent) ? "gymVictory" : "trainerVictory";
}
