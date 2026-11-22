import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as Yellow from "../src/yellow/generated/symbols";
import * as Legacy from "../src/yellow/generated/symbols-legacy";

const dir = "src/yellow/scripts";
const scripts = readdirSync(dir).filter(f => f.endsWith(".ts")).map(f => ({ file: f, text: readFileSync(`${dir}/${f}`, "utf8") }));
/** Names in legacy.ts files exist only in Yellow Legacy's table. */
const forTable = (name: string) => <T extends { file: string }>(list: T[]) =>
  name === "Yellow Legacy" ? list : list.filter(f => !f.file.endsWith("legacy.ts"));

function refs(sources: typeof scripts, pattern: RegExp) {
  const out: { file: string; name: string }[] = [];
  for (const { file, text } of sources) for (const m of text.matchAll(pattern)) out.push({ file, name: m[1] });
  return out;
}
const missing = (list: { file: string; name: string }[], known: (n: string) => boolean) =>
  list.filter(r => !known(r.name)).map(r => `${r.file}: ${r.name}`);

const TABLES = [["Yellow", Yellow], ["Yellow Legacy", Legacy]] as const;

describe.each(TABLES)("Yellow map scripts on %s", (table, { EVENT, HS, ITEM, MAP, MAP_TEXT, MON, MUSIC, SYM, TRAINER }) => {
  const sources = forTable(table)(scripts);
  const allText = new Set(Object.values(MAP_TEXT).flatMap(t => Object.keys(t)));
  it("only show cartridge texts that exist", () => {
    const texts = refs(sources, /\.text\(\s*"([^"]+)"/g);
    expect(missing(texts, n => n.startsWith("TEXT_") ? allText.has(n) : SYM[n] !== undefined)).toEqual([]);
  });
  it("use known events, objects, items, species, trainers, maps and music", () => {
    expect(missing(refs(sources, /"(EVENT_[A-Z0-9_]+)"/g), n => EVENT[n] !== undefined)).toEqual([]);
    expect(missing(refs(sources, /"(HS_[A-Z0-9_]+)"/g), n => HS[n] !== undefined)).toEqual([]);
    expect(missing(refs(sources, /\.(?:give|take|hasItem)\(\s*"([A-Z0-9_]+)"/g), n => ITEM[n] !== undefined)).toEqual([]);
    expect(missing(refs(sources, /\.(?:giveMon|partyHas|cry|showcase|wildBattle)\(\s*"([A-Z0-9_]+)"/g), n => MON[n] !== undefined)).toEqual([]);
    expect(missing(refs(sources, /\.trainerBattle\(\s*"([A-Z0-9_]+)"/g), n => TRAINER[n] !== undefined)).toEqual([]);
    expect(missing(refs(sources, /\.warp\(\s*"([A-Z0-9_]+)"/g), n => MAP[n] !== undefined)).toEqual([]);
    expect(missing(refs(sources, /"(MUSIC_[A-Z0-9_]+)"/g), n => MUSIC[n] !== undefined)).toEqual([]);
  });
});

describe.each(TABLES)("Yellow runtime symbols on %s", (table, { SYM }) => {
  it("only reads cartridge tables that the generated symbol table publishes", () => {
    const files = forTable(table)(["src/yellow", "src/yellow/scripts"].flatMap(d => readdirSync(d).filter(f => f.endsWith(".ts")).map(f => ({ file: `${d}/${f}` })))).map(f => f.file);
    const used = new Set<string>();
    for (const file of files) for (const m of readFileSync(file, "utf8").matchAll(/\bSYM\.([A-Za-z0-9_]+)/g)) used.add(m[1]);
    for (const file of files) for (const m of readFileSync(file, "utf8").matchAll(/(?:\.sym|\baddr)\("([A-Za-z0-9_.]+)"\)/g)) used.add(m[1]);
    expect([...used].filter(n => SYM[n] === undefined)).toEqual([]);
  });
});
