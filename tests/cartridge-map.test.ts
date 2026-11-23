import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CARTRIDGES, SUITES } from "./crystal-fixtures";
import { hasEngine, headlessGame } from "./crystal-harness";
import { FakeCanvas } from "./canvas-shim";
import { crystalMapSheets } from "../src/crystal/town-map";
import { C, MAP as CRYSTAL_MAP, MON as CRYSTAL_MON } from "../src/crystal/symbols";
import { yellowMapSheet } from "../src/yellow/town-map";
import { MAP, useCartridge } from "../src/yellow/symbols";
import { YellowRom } from "../src/yellow/rom";
import { applyBps } from "../src/yellow/bps";
import type { MapSheet } from "../src/ui/cartridge-map";

function pixels(sheet: MapSheet) {
  const canvas = new FakeCanvas();
  canvas.width = 160;
  canvas.height = 144;
  sheet.draw(canvas as unknown as HTMLCanvasElement);
  return new Uint32Array(canvas.pixels.data.buffer);
}

describe.skipIf(!hasEngine || !CARTRIDGES.length).each(SUITES)("Crystal town maps on %s", cart => {
  it("draws both regions, selects the indoor landmark and uses the cartridge's encounters", async () => {
    const { game } = await headlessGame(cart === "legacy" ? "crystal-legacy" : "crystal");
    expect(game.ev("EVENT_PLAYERS_ROOM_POSTER")).toBe(true);
    expect(game.hasFlag("ENGINE_MAP_CARD")).toBe(false);
    const { here, sheets } = crystalMapSheets(game, { kind: "browse" });
    expect(here).toMatchObject({ name: "New Bark Town", x: 140, y: 100 });
    expect(sheets.map(s => s.region)).toEqual(["Johto"]);
    expect(sheets[0].spots.at(-1)?.id).toBe(C("LANDMARK_SILVER_CAVE"));
    const johto = pixels(sheets[0]);
    expect(new Set(johto).size).toBeGreaterThan(8);
    const earlyArea = crystalMapSheets(game, { kind: "area", species: CRYSTAL_MON.PIDGEY });
    expect(earlyArea.sheets.some(s => s.region === "Kanto")).toBe(cart === "legacy");
    const [g, n] = CRYSTAL_MAP.ROUTE_27;
    game.enterMap(g, n, { arrival: "warp" });
    const kanto = crystalMapSheets(game, { kind: "browse" }).sheets.find(s => s.region === "Kanto")!;
    expect(kanto.spots[0].id).toBe(C("LANDMARK_VICTORY_ROAD"));
    expect(pixels(kanto)).not.toEqual(johto);
    game.save.hallOfFame.push({ party: [], time: 0 });
    expect(crystalMapSheets(game, { kind: "browse" }).sheets[1].spots[0].id).toBe(C("LANDMARK_PALLET_TOWN"));
    const area = crystalMapSheets(game, { kind: "area", species: CRYSTAL_MON.PIDGEY }).sheets[0];
    expect(area.spots.some(p => p.id === C("LANDMARK_ROUTE_29"))).toBe(true);
    const fly = crystalMapSheets(game, { kind: "fly", destinations: [C("LANDMARK_VIOLET_CITY")] });
    expect(fly.sheets.flatMap(s => s.spots.map(p => p.name))).toEqual(["Violet City"]);
  });
});

describe.each(["yellow", "legacy"] as const)("Yellow town map on %s", cart => {
  it.skipIf(!existsSync("pokeyellow.gbc") || (cart === "legacy" && !existsSync("yellow-legacy.bps")))("decodes the full chart, interior positions, destinations and habitats", async () => {
    await useCartridge(cart);
    const base = new Uint8Array(readFileSync("pokeyellow.gbc"));
    const rom = new YellowRom(cart === "yellow" ? base : applyBps(base, new Uint8Array(readFileSync("yellow-legacy.bps"))));
    const { sheet, here } = yellowMapSheet(rom, MAP.REDS_HOUSE_2F, { kind: "browse" });
    expect(here).toMatchObject({ id: MAP.PALLET_TOWN, name: "Pallet Town", x: 36, y: 100 });
    expect(sheet.spots).toHaveLength(47);
    const terrain = pixels(sheet);
    expect(new Set(terrain).size).toBe(4);
    expect(terrain[143 * 160]).not.toBe(0);
    const ids = [MAP.PALLET_TOWN, MAP.CERULEAN_CITY];
    expect(yellowMapSheet(rom, MAP.ROUTE_1, { kind: "fly", destinations: ids }).sheet.spots.map(p => p.id)).toEqual(ids);
    const habitat = (species: number) => yellowMapSheet(rom, MAP.ROUTE_1, { kind: "area", species }).sheet.spots.map(p => p.name);
    expect(habitat(16)).toContain("Route 1");
    expect(habitat(144).includes("Seafoam Islands")).toBe(cart === "legacy");
  });
});
