# Porting Yellow map scripts

The Yellow adventure runs Pokémon Yellow's story on Astra's engine. Maps, tiles, sprites, warps, objects, trainers, encounters and **all dialogue are read from the player's own cartridge at runtime**. What we write by hand is only the *logic* of each map script (`scripts/*.asm` in the pret/pokeyellow disassembly), in TypeScript, in `src/yellow/scripts/`.

## Ground rules

- **Never copy text or data from the disassembly into TypeScript.** Show dialogue with `g.text("<cartridge label>")` or `g.text("TEXT_<MAP>_<NAME>")`. The label is resolved to a ROM address and decoded from the cartridge. `g.say()` is only for Astra's own additions (rare).
- Constants are referenced by their disassembly names as strings: events `"EVENT_GOT_POKEDEX"`, toggleable objects `"HS_PALLET_TOWN_OAK"`, items `"POKE_BALL"`, TMs `"TM_BIDE"`, HMs `"HM_CUT"`, species `"PIKACHU"`, trainer classes `"BROCK"`/`"RIVAL1"` (without `OPP_`), maps `"OAKS_LAB"`, music `"MUSIC_MEET_RIVAL"`. `tests/yellow-scripts.test.ts` checks every string you pass exists.
- Object indexes are the 1-based slots from `data/maps/objects/<Map>.asm` (`const_export` order). Define small constants at the top of your file (`const RIVAL = 1`).
- Coordinates are the disassembly's step coordinates (x, y). Sprite RAM coordinates (`wSprite..MapY`) carry a +4 offset: subtract 4.
- Edit only the file(s) you were assigned. Don't change the runtime, the API or other scripts; if the API lacks something, leave a `// API REQUEST:` comment with a workaround.

## Where things live

- API: `src/yellow/script.ts` (`Game`, `MapScript`, `defineMap`, `SHARED_TEXTS`).
- Worked example: `src/yellow/scripts/pallet.ts` (Pallet Town, Red's and Blue's houses, Oak's Lab).
- Shared handlers: `src/yellow/scripts/shared.ts` (hidden objects, Pokémon Center Chansey…).
- Disassembly (read-only): `../pokeyellow/scripts/<Map>.asm`, `data/maps/objects/<Map>.asm`, `engine/events/**`, `text/*.asm` for reading what a text says.

## What the runtime already does (don't port)

- NPC dialogue that is plain `text_far`, signs, item balls (`PickUpItemText`), Poké Mart clerks (`script_mart`), nurses, PCs, vending machines.
- `text_asm` entries shaped like: `ld hl, Text / call PrintText / jp TextScriptEnd` (any number of prints, including via `jr`/`jp` to a shared tail or a `callfar` routine that only prints), `ld hl, TrainerHeaderN / call TalkToTrainer`, and a leading Pikachu cry.
- Trainers on the map: sight lines, `!`, approach, battle-text, battle, beaten flag, after-battle text. All from the trainer headers in the cartridge.
- The standard trainer map script (`CheckFightingMapTrainers` / `DisplayEnemyTrainerTextAndStartBattle` / `EndTrainerBattle`).
- Warps, doors, mats, connections, ledges, grass/water encounters, fishing, blackouts, Pikachu following.

## A map script

```ts
import { defineMap } from "../script";

const GUARD = 2;
defineMap("Route5Gate", {
  // Runs synchronously while the map is set up (before it is shown): blocks, objects, warps.
  onEnter(g) {
    if (g.ev("EVENT_X")) g.setBlock(3, 2, 0x0e);
  },
  // Runs whenever the player arrives on a square (and after map entry). Coordinate triggers go here.
  async onStep(g) {
    if (g.player.y === 3 && !g.ev("EVENT_GAVE_DRINK")) {
      await g.text("TEXT_ROUTE5GATE_GUARD");
      await g.move("player", "D");
    }
  },
  // text_asm handlers, keyed by the cartridge label of the text entry (or of the
  // far-called routine when the coverage tool shows `Text -> Routine`).
  texts: {
    async Route5GateGuardText(g) {
      if (g.ev("EVENT_GAVE_DRINK")) return g.text("Route5GateGuardText.ThanksText");
      ...
    },
  },
});
```

With free movement (the default), `g.player.x`/`y` are still whole squares: the square under the player's centre. `onStep` runs when the centre enters a new square, so the player can be up to half a square off the square's centre when it runs. `g.move`, `g.approach` and `g.emote` first glide the player to the centre, so scenes that move people always start from whole squares.

Use `generic: true` when a map's original script only does things the runtime already handles (for example it just runs the trainer loop with a small difference that doesn't matter), so the coverage tool counts it as done.

## Translating common asm

| asm | TypeScript |
|---|---|
| `CheckEvent EVENT_X` / `SetEvent` / `ResetEvent` | `g.ev("EVENT_X")`, `g.set(..)`, `g.reset(..)` |
| `CheckBothEventsSet A, B` | `g.ev(A) && g.ev(B)` |
| `ld a, [wXCoord]` / `wYCoord` | `g.player.x` / `g.player.y` |
| `ld a, TEXT_FOO / ldh [hTextID], a / call DisplayTextID` | `await g.text("TEXT_FOO")` |
| `ld hl, Label / call PrintText` | `await g.text("Label")` (local labels: `"Parent.Local"`, e.g. `"PalletTownOakText.WhewText"`) |
| `wDoNotWaitForButtonPressAfterDisplayingText = 1` | `await g.text(x, { wait: false })` |
| `call YesNoChoice` + `ld a, [wCurrentMenuItem] / and a` (0 = YES) | `if (await g.yesNo())` |
| `predef ShowObject` / `HideObject` with `HS_*` | `g.show("HS_*")` / `g.hide("HS_*")` |
| `MoveSprite` with `NPC_MOVEMENT_DOWN/UP/LEFT/RIGHT` bytes (played **in order**) | `await g.move(index, "D2R1U")` |
| Simulated joypad RLE lists (`DecodeRLEList` into `wSimulatedJoypadStatesEnd`) | `await g.move("player", ...)`. **These play back in reverse order of the list.** |
| `SetSpriteFacingDirectionAndDelay` / `wSpriteXStateData1FacingDirection` | `g.face(index | "player", "up")` |
| `FindPathToPlayer` + `MoveSprite` | `await g.approach(index)` |
| `EmotionBubble` | `await g.emote(index | "player", "exclamation")` |
| `lb bc, ITEM, n / call GiveItem` (carry clear = bag full) | `if (!g.give("ITEM", n)) { …bag full… }` |
| `IsItemInBag` / remove | `g.hasItem("ITEM")` / `g.take("ITEM")` |
| `GivePokemon` (species, level) | `await g.giveMon("SPECIES", level)` (prints the "got" line) |
| Trainer battle set-up (`wCurOpponent = OPP_X`, `wTrainerNo = n`, `SaveEndBattleTextPointers win, lose`) | `const won = await g.trainerBattle("X", n, { win: "WinText", lose: "LoseText", canLose })` |
| Static/legendary battle (`wCurOpponent = SPECIES`, `wCurEnemyLevel`) | `await g.wildBattle("SPECIES", level)` → `"win" | "caught" | "run" | "lose"` |
| `ReplaceTileBlock` (`lb bc, y, x` block coords, `ld a, block`) | `g.setBlock(x, y, block)` |
| Elevator destination (warp entries rewritten) | `g.setWarp(index, "MAP", warp)` |
| `ld a, [wXCurScript]` state machine | collapse into async code; persist leftover state with `g.state` (per map) or `g.vars` |
| `PlayMusic` / `PlayDefaultMusic` / `PlaySound` / `PlayCry` | `g.music("MUSIC_X")` / `g.music()` / `g.sfx("SFX_X")` / `g.cry("SPECIES")` |
| `Delay3`, `DelayFrames c` | `await g.delay(frames)` |
| `GBFadeOutToBlack` … `FadeIn` | `await g.fade(() => { … })` |
| `DoInGameTradeDialogue` with `TRADE_FOR_X` | `await g.trade(index)` (0-based `TRADE_FOR_*` value) |
| `HealParty` | `g.heal()` |
| badge (`wObtainedBadges`) | `g.badge(n)` / `g.hasBadge(n)` (Boulder = 0 … Earth = 7) |
| `predef DisplayDexRating` | `import { dexRating } from "./pallet"` |
| `wStatusFlags*` bits and other misc RAM flags | `g.vars.<name>` (numbers, persistent) |
| Money / coins | `g.money`, `g.coins` |
| `IsPlayerOnDungeonWarp`, holes | check coordinates in `onStep`, then `await g.warp("MAP", x, y)` |
| Pokémon Tower ghosts | `await g.wildBattle("MAROWAK", 30, { ghost: true })` |

Gym leaders: in the leader's text handler, show the pre-battle text, `await g.trainerBattle(...)`, and on a win set the beaten event, `g.badge(n)`, give the TM (with its texts), and set the gym trainers' events as the original does.

## Checking your work

```sh
npx tsc --noEmit
npx vitest run tests/yellow-scripts.test.ts
npx vite-node scripts/yellow-coverage.ts | grep -A20 '^YourMap '
```

The coverage tool lists, per map, the map script (`script:`), text routines (`text:`) and hidden-object routines (`hidden:`) that still need a port. Aim for zero gaps on your maps. If something truly needs runtime support that doesn't exist (a minigame, a menu), port the rest and leave an `// API REQUEST:` note.
