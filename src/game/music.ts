import type { WorldObject } from "../world";

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
} as const;

export type MusicScene = keyof typeof MUSIC_TRACKS;
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
  if (!opponent?.trainer) return night ? "wildNight" : "wild";
  if (trainerId(opponent) === "league_4") return "champion";
  if (boss(opponent)) return "gymBattle";
  if (rival(opponent)) return "rivalBattle";
  if (meridian(opponent)) return "meridianBattle";
  return "trainer";
}

export function victoryTheme(opponent?: Opponent): MusicScene {
  if (!opponent?.trainer || opponent.kind === "legendary") return "wildVictory";
  return boss(opponent) ? "gymVictory" : "trainerVictory";
}
