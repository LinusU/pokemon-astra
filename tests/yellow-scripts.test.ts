import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EVENT, HS, ITEM, MAP, MAP_TEXT, MON, MUSIC, SYM, TRAINER } from "../src/yellow/generated/symbols";

const dir = "src/yellow/scripts";
const sources = readdirSync(dir).filter(f => f.endsWith(".ts")).map(f => ({ file: f, text: readFileSync(`${dir}/${f}`, "utf8") }));
const allText = new Set(Object.values(MAP_TEXT).flatMap(t => Object.keys(t)));

function refs(pattern: RegExp) {
  const out: { file: string; name: string }[] = [];
  for (const { file, text } of sources) for (const m of text.matchAll(pattern)) out.push({ file, name: m[1] });
  return out;
}
const missing = (list: { file: string; name: string }[], known: (n: string) => boolean) =>
  list.filter(r => !known(r.name)).map(r => `${r.file}: ${r.name}`);

describe("Yellow map scripts", () => {
  it("only show cartridge texts that exist", () => {
    const texts = refs(/\.text\(\s*"([^"]+)"/g);
    expect(missing(texts, n => n.startsWith("TEXT_") ? allText.has(n) : SYM[n] !== undefined)).toEqual([]);
  });
  it("use known events, objects, items, species, trainers, maps and music", () => {
    expect(missing(refs(/"(EVENT_[A-Z0-9_]+)"/g), n => EVENT[n] !== undefined)).toEqual([]);
    expect(missing(refs(/"(HS_[A-Z0-9_]+)"/g), n => HS[n] !== undefined)).toEqual([]);
    expect(missing(refs(/\.(?:give|take|hasItem)\(\s*"([A-Z0-9_]+)"/g), n => ITEM[n] !== undefined)).toEqual([]);
    expect(missing(refs(/\.(?:giveMon|partyHas|cry|showcase|wildBattle)\(\s*"([A-Z0-9_]+)"/g), n => MON[n] !== undefined)).toEqual([]);
    expect(missing(refs(/\.trainerBattle\(\s*"([A-Z0-9_]+)"/g), n => TRAINER[n] !== undefined)).toEqual([]);
    expect(missing(refs(/\.warp\(\s*"([A-Z0-9_]+)"/g), n => MAP[n] !== undefined)).toEqual([]);
    expect(missing(refs(/"(MUSIC_[A-Z0-9_]+)"/g), n => MUSIC[n] !== undefined)).toEqual([]);
  });
});
