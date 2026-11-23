import { mapInk, paintMap, showCartridgeMap, type MapPurpose, type MapSheet, type MapSpot } from "../ui/cartridge-map";
import { cartridgeInUse, MAP, MAP_LABELS, MON, PAL, SYM } from "./symbols";
import { oldRodMons } from "./legacy";
import type { YellowRom } from "./rom";
import { titleCase } from "./runtime";

/** Legacy's Area command also lists its gifts, trades, prizes and static encounters. */
const extraAreas: Record<string, string[]> = {
  ROUTE_4: ["MAGIKARP"], ROUTE_24: ["CHARMANDER"], VERMILION_CITY: ["SQUIRTLE"], CERULEAN_CITY: ["BULBASAUR"],
  ROUTE_12: ["SNORLAX"], ROUTE_16: ["SNORLAX"], MT_MOON_B2F: ["OMANYTE", "KABUTO"], FUCHSIA_CITY: ["OMANYTE", "KABUTO"],
  PEWTER_CITY: ["AERODACTYL"], SAFFRON_CITY: ["LAPRAS", "HITMONCHAN", "HITMONLEE", "JYNX"],
  POWER_PLANT: ["VOLTORB", "ELECTRODE", "ZAPDOS"], SEAFOAM_ISLANDS_B4F: ["ARTICUNO"], VICTORY_ROAD_2F: ["MOLTRES"],
  CERULEAN_CAVE_B1F: ["MEWTWO"], ROUTE_2: ["MR_MIME"], ROUTE_5: ["MACHOKE"], ROUTE_11: ["DUGTRIO"], ROUTE_18: ["PARASECT"],
  CINNABAR_ISLAND: ["RHYDON", "DEWGONG", "MUK"], CELADON_CITY: ["EEVEE", "ABRA", "SEEL", "MAGMAR", "ELECTABUZZ", "DRATINI", "PORYGON"],
};
function habitats(rom: YellowRom, dex: number) {
  const species = rom.internal(dex), maps = new Set<number>();
  MAP_LABELS.forEach((label, id) => {
    if (!label) return;
    const table = rom.wild(id);
    if ([...table.grass, ...table.water].some(m => m.species === species)) maps.add(id);
  });
  if (cartridgeInUse() === "legacy") {
    for (const [map, names] of Object.entries(extraAreas)) if (names.some(n => MON[n] === species)) maps.add(MAP[map]);
    const common = [oldRodMons(), SYM.GoodRodMons].some(o => [1, 3].some(i => rom.u8(o + i) === species));
    for (let o = SYM.SuperRodFishingSlots; rom.u8(o) !== 0xff; o += 9) {
      if (common || [1, 3, 5, 7].some(i => rom.u8(o + i) === species)) maps.add(rom.u8(o));
    }
  }
  return [...maps];
}

export function yellowMapSheet(rom: YellowRom, map: number, purpose: MapPurpose) {
  const intoSpot = (id: number): MapSpot | undefined => {
    const entry = rom.townMapEntry(id);
    if (entry) return { ...entry, name: titleCase(entry.name), id, region: "Kanto" };
  };
  const here = intoSpot(map);
  const ids = purpose.kind === "fly" ? purpose.destinations : purpose.kind === "area" ? habitats(rom, purpose.species)
    : rom.bytes.subarray(SYM.TownMapOrder, SYM.TownMapOrderEnd);
  const spots: MapSpot[] = [];
  const same = (a: MapSpot, b: MapSpot) => a.name === b.name && a.x === b.x && a.y === b.y;
  for (const id of ids) {
    const spot = intoSpot(id);
    if (spot && !spots.some(p => same(p, spot))) spots.push(spot);
  }
  if (here && purpose.kind === "browse") {
    const entry = spots.find(p => same(p, here));
    if (entry) here.id = entry.id;
    else spots.push(here);
  }
  const layout = new Uint8Array(360);
  let i = 0;
  for (let o = SYM.CompressedMap; i < layout.length && rom.u8(o); o++) {
    const run = rom.u8(o), count = run & 15;
    layout.fill(run >> 4, i, i + count);
    i += count;
  }
  const colors = [0, 1, 2, 3].map(c => mapInk(rom.u16(SYM.CGBBasePalettes + PAL.PAL_TOWNMAP * 8 + c * 2)));
  const sheet: MapSheet = { region: "Kanto", spots, draw: canvas => paintMap(canvas, layout,
    rom.bytes.subarray(SYM.WorldMapTileGraphics, SYM.WorldMapTileGraphics + 256), [colors], () => 0) };
  return { sheet, here };
}

export function showYellowMap(layer: HTMLElement, rom: YellowRom, map: number, purpose: MapPurpose, title: string) {
  const { sheet, here } = yellowMapSheet(rom, map, purpose);
  return showCartridgeMap(layer, [sheet], here, purpose, title);
}
