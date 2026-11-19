import { existsSync, readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { Engine } from "../src/engine";
import { pokemonAppearance, portraitNumber } from "../src/engine/appearance";

it("recognizes the same letter and palette in a battle word and a saved record", () => {
  const shinyWords: number[] = [];
  for (let word = 0; word <= 0xffff; word++) {
    if (pokemonAppearance({ species: 201, dvs: word }).shiny) shinyWords.push(word);
  }
  expect(shinyWords).toEqual([0x2aaa, 0x3aaa, 0x6aaa, 0x7aaa, 0xaaaa, 0xbaaa, 0xeaaa, 0xfaaa]);
  for (let packed = 0; packed <= 255; packed++) {
    const digits = packed.toString(4).padStart(4, "0").split("").map(Number);
    const word = digits.reduce((value, digit) => value * 16 + digit * 2, 0);
    const look = pokemonAppearance({ species: 201, dvs: word });
    expect(look.form).toBe(Math.floor(packed / 10));
    expect(pokemonAppearance({ species: 201, dvs: [word >> 8, word & 255] })).toEqual(look);
  }
  expect(portraitNumber({ species: 201, dvs: 0x2aaa })).toBe("№ 201-I · Shiny");
  expect(portraitNumber({ species: 201, dvs: 0x6aaa })).toBe("№ 201-V · Shiny");
  expect(pokemonAppearance({ species: 201, dvs: 0xffff, paletteDvs: 0x2aaa })).toEqual({ species: 201, form: 25, shiny: true });
  expect(pokemonAppearance(129)).toEqual({ species: 129, form: 0, shiny: false });
});

it.skipIf(!existsSync("pokecrystal11.gbc") || !existsSync("public/astra_native.wasm"))(
  "catches all 26 native Unown letters and reads distinct front and back pictures", async () => {
    vi.stubGlobal("ImageData", class {
      constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
    });
    try {
      const rom = readFileSync("pokecrystal11.gbc");
      const { instance } = await WebAssembly.instantiate(readFileSync("public/astra_native.wasm"), {});
      const engine = new Engine(instance.exports as never, rom);
      const party = [engine.makeStarter(60)];
      const fronts = new Set<string>(), backs = new Set<string>(), forms = new Set<number>();
      for (let seed = 1; seed <= 1000 && forms.size < 26; seed++) {
        const battle = engine.startBattle({ party, opponent: { species: 201, level: 20 }, seed, balls: [[1, 1]] });
        const snap = battle.snapshot(), look = pokemonAppearance(snap.state.enemy.active);
        if (forms.has(look.form)) continue;
        const ball = snap.legal.findIndex((action: any) => action.Item?.id === 1);
        const caught = battle.act(ball).result!;
        expect(pokemonAppearance(caught.party[caught.caught!])).toEqual(look);
        forms.add(look.form);
        fronts.add(Buffer.from(engine.sprite(201, false, look).data).toString("base64"));
        backs.add(Buffer.from(engine.sprite(201, true, look).data).toString("base64"));
      }
      expect([forms.size, fronts.size, backs.size]).toEqual([26, 26, 26]);
      for (const back of [false, true]) {
        const colors = (shiny: boolean) => {
          const image = engine.sprite(129, back, { shiny });
          const pixels = new Set<number>();
          for (let i = 0; i < image.data.length; i += 4) {
            if (image.data[i + 3]) pixels.add((image.data[i] << 16) | (image.data[i + 1] << 8) | image.data[i + 2]);
          }
          return pixels;
        };
        const normal = colors(false), shiny = colors(true);
        expect(normal).not.toEqual(shiny);
        for (let shade = 0; shade < 4; shade++) {
          const rgb = rom.readUInt16LE(0xa8ce + 129 * 8 + shade * 2);
          const channel = (shift: number) => Math.round(((rgb >> shift) & 31) * 255 / 31);
          expect(shade < 2 ? normal : shiny).toContain((channel(0) << 16) | (channel(5) << 8) | channel(10));
        }
      }
    } finally {
      vi.unstubAllGlobals();
    }
  },
);
