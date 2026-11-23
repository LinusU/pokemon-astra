import { mapInk, paintMap, showCartridgeMap, type MapPurpose, type MapSheet, type MapSpot } from "../ui/cartridge-map";
import type { CrystalGame } from "./runtime";
import { titleCase } from "./runtime";
import { C, SYM, cartridgeInUse } from "./symbols";

export function crystalMapSheets(game: CrystalGame, purpose: MapPurpose) {
  const r = game.rom, split = C("KANTO_LANDMARK"), ship = C("LANDMARK_FAST_SHIP");
  const spot = (id: number): MapSpot => ({
    id, name: titleCase(r.landmarkName(id)), region: id < split || id === ship ? "Johto" : "Kanto", ...r.landmarkSpot(id),
  });
  const current = game.landmark();
  const here = current > 0 && current <= ship ? spot(current) : undefined;
  const hall = game.save.hallOfFame.length > 0;
  const places = new Set<number>();
  if (purpose.kind === "area") {
    const matches = (m: { species: number }) => m.species === purpose.species;
    for (const m of r.allMaps()) {
      if (r.grass(m.group, m.number)?.slots.some(slots => slots.some(matches)) || r.water(m.group, m.number)?.slots.some(matches)) places.add(m.landmark);
    }
    for (const m of game.save.roamers ?? []) if (matches(m)) places.add(r.mapHeader(m.group, m.number).landmark);
  }
  const ids = purpose.kind === "fly" ? purpose.destinations : Array.from({ length: ship - 1 }, (_, i) => i + 1);
  const spots = ids.filter(id => purpose.kind !== "area" || places.has(id)).map(spot);
  if (purpose.kind === "browse" && here?.id === ship) spots.push(here);
  const tiles = game.engine.decompress(r.bytes.subarray(SYM.TownMapGFX, SYM.TownMapGFX + 0x4000));
  const palette = game.save.gender ? SYM.FemalePokegearPals : SYM.MalePokegearPals;
  const colors = Array.from({ length: 6 }, (_, p) => [0, 1, 2, 3].map(i => mapInk(r.u16(palette + p * 8 + i * 2))));
  const sheets: MapSheet[] = [];
  for (const region of ["Johto", "Kanto"] as const) {
    let points = spots.filter(p => p.region === region);
    if (purpose.kind === "fly" && !points.length) continue;
    if (region === "Kanto" && !hall) {
      if (purpose.kind === "area" && cartridgeInUse() === "crystal") continue;
      if (purpose.kind === "browse") {
        if (here?.region !== region) continue;
        points = points.filter(p => p.id >= C("LANDMARK_VICTORY_ROAD") || p.id === current);
      }
    }
    const at = region === "Johto" ? SYM.JohtoMap : SYM.KantoMap;
    sheets.push({ region, spots: points, draw: canvas => paintMap(canvas, r.bytes.subarray(at, at + 360), tiles, colors,
      tile => (r.u8(SYM["TownMapPals.PalMap"] + (tile >> 1)) >> (tile % 2 * 4)) & 7) });
  }
  return { sheets, here };
}

export function openCrystalMap(game: CrystalGame, purpose: MapPurpose = { kind: "browse" }, title = "Town Map") {
  if (!game.ctx.layer) return Promise.resolve(undefined);
  const { sheets, here } = crystalMapSheets(game, purpose);
  return game.modal(() => showCartridgeMap(game.layer, sheets, here, purpose, title));
}
