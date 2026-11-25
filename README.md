# Pokémon Astra

[Play Pokémon Astra](https://linusu.com/pokemon-astra/).

A browser-native Pokémon adventure in the original Astra region, using the Crystal battle engine and assets decoded from the player's own cartridge. The campaign runs from the choice of partner in Dewdrop through eight gyms, the Astral League and the Aurora Sanctuary. All three starters have cleared the League in seeded native battle simulations.

## Play locally

Requires Node.js 22+ and Rust with the WebAssembly target:

```sh
rustup target add wasm32-unknown-unknown
npm ci
npm run dev
```

Open the URL Vite prints. On first launch, choose or drop **Pokémon Crystal (English), version 1.0**. The file name is not important; the supported ROM's SHA-1 is `f4cd194bdee0d04ca4eac29e09b8e4e9d818c133`. The ROM is read in the browser and stored in IndexedDB. It is never uploaded, included in the app bundle, or required by the production server. The supplied workspace ROM is used only for local verification.

On the opening screen, **ROM manager** shows the cartridges available in this browser and lets you add them before starting a journey. Optionally select **Add Emerald** and choose an unmodified English Pokémon Emerald ROM (.gba, SHA-1 `f3ae088181bf583e55daf962a92bb46f4f1d07b7`). Every journey then uses Emerald Pokémon portraits, including shiny palettes and Unown forms. In battle, front sprites play shortened versions of Emerald's frame sequences and back sprites use short motions based on Emerald's species animation assignments. Select **Remove Emerald** to restore Crystal portraits. Crystal is still required to play.

```sh
npm run build
npm run preview
```

Production builds generate a versioned offline service worker covering the application, artwork, icons, and native WASM engine. Open the production app online once, import the cartridge, and allow caching to finish. On iPhone/iPad use Safari → Share → Add to Home Screen. On Android use the browser's Install app/Add to Home screen command. Installation on another device needs an HTTPS deployment; a desktop localhost URL is local to that desktop.

## The adventure

- Growlithe, Poliwag, or Bellsprout as your partner. Alder tutors Growlithe in Ember, Poliwag in Water Gun, or Bellsprout in Tackle. Robin raises the partner with a type advantage.
- 12 settlements, 25 routes, 12 dungeons with 40 rooms, eight gyms, and 123 connected maps in total, including five League chambers.
- Professor Alder's beacon survey, Robin's changing relationship with Meridian, Director Vale's Celestial Engine, eight beacon keepers, the Elite Four, and Champion Mira.
- 12 regional expeditions across 40 rooms, 16 field requests with journal progress, optional trainers, evolution-item rewards, a postgame reserve, and retryable legendary encounters. All 251 species have an obtainable habitat, gift, or static encounter; no trade or event service is necessary.
- Badge field abilities open return paths and hidden areas. Surf enables water traversal; Fly travels between visited settlements. Field abilities do not occupy Pokémon move slots.
- Reedhaven’s nursery takes compatible pairs, including Ditto. The keeper gives you a woven sling for the Egg. Walking hatches a level-five partner that can inherit moves.
- Six-member party, storage, Pokédex habitat hints, native battles/catching/experience/move decisions, evolution stones and Link Cables, friendship/time/stat evolutions, shops, fishing, repels, healing, and autosave.
- Smooth, animated movement with diagonal normalization, solid roaming NPCs, trainer sightlines and approaches, grass rustles, and continuous outdoor map boundaries. All 25 routes follow a shared regional survey with winding roads, side trails and distinct coastlines, ridges and habitats. Centers and Marts fit in 12×9 and 11×9 rooms. Each town has its own street plan, square and music. Local Pokémon return as you help the community. Shop awnings, Center roof emblems and warm windows mark services after dark.
- Experience goes to conscious participants and eligible Exp. Share holders. Beaten road trainers offer optional practice rematches. The Bag sorts medicine, Poké Balls and key items into pockets. Field and battle menus support the D-pad, A and B. Staged battle introductions, A-acknowledged text, animated HP/experience, move effects, send-outs, fainting, and Poké Ball throws. Encounter transitions and battle exits preserve the overworld.
- Self-hosted VT323 game text, ROM music/cries/sound effects, saved sound controls, and an explicit day/night camp option.

The region plan is in [docs/DESIGN.md](docs/DESIGN.md); implemented content and contracts are in [docs/WORLD.md](docs/WORLD.md).

## The Yellow adventure

Choose **New journey → Yellow** to play Pokémon Yellow's Kanto on Astra's engine. The first time, the game asks for your own **English Pokémon Yellow** cartridge (.gbc, SHA-1 `cc7d03262ebfaf2f06772c1a480c7d9d5f4a38e1`). Like the Crystal cartridge, it is read in the browser and kept in IndexedDB. Nothing from it is bundled with the app.

- **From the Yellow cartridge:** every map layout, collision, warp, connection, sign, person, item ball, hidden item, trainer party, encounter table, mart stock, in-game trade and all dialogue.
- **Kanto in Crystal's colors:** maps are drawn with Pokémon Crystal's tiles and palettes from your Crystal cartridge. Crystal's Kanto tileset kept Yellow's tile numbers, so towns and routes match tile for tile, with each town's roof colors and Crystal's animated water and flowers. Buildings, gyms, caves and other interiors map Yellow's tiles onto Crystal's interior tilesets (`src/yellow/crystal-look.ts`). People use Crystal's overworld sprites, and the gym leaders, Bill and Mr. Fuji appear as their Crystal selves. Pikachu, the other Pokémon and the few characters Crystal never drew keep Yellow's sprites in Crystal-style colors. Tall grass hides the lower half of anyone standing in it. **Option → Graphics** switches to Yellow's own Game Boy Color look.
- **From Astra:** the Crystal battle engine and battle screen, Pokémon portraits and Crystal cries, menus, the Bag, party and storage screens, autosave, and Crystal's arrangements of the Kanto music. Trainers fight with Crystal Legacy's level-up moves plus the cartridge's hand-picked ones, such as the gym leaders' special moves.
- **The story:** the map scripts are hand ports of the pret/pokeyellow disassembly's logic in `src/yellow/scripts/`. They reference the cartridge's text by label, so the dialogue on screen is always the cartridge's. A test checks that every map script, text routine and hidden object in the cartridge has a port.
- Pikachu follows you and won't go in its ball. Talk to it to see how it feels.
- Field moves need their badge and a Pokémon that knows the move. Inspect a tree, the water or a boulder to use Cut, Surf or Strength, or choose the move from the party menu. Fly, Flash, Dig, Teleport and Softboiled work as in Yellow. A fainted Pokémon can still use field moves.
- The Safari Zone, the Game Corner's slot machines and prize corner, the Day-Care, fossils, gift Pokémon, in-game trades, the Name Rater, Silph Co.'s Card Key doors and elevators, the Pokémon Tower ghosts, Snorlax and the legendary birds are all playable.
- You move freely, diagonals included, as in Astra. Yellow's events still work square by square: they fire when your centre enters a square, and you glide to its centre when a scene starts. Hold B or Shift to walk faster. **Option → Movement** switches to the Game Boy's square-by-square steps.

Not included: link-cable features, the Game Boy Printer, the Surfing Pikachu minigame and Pikachu's animated emotion pictures. Talking to Pikachu shows a short line instead.

### Yellow Legacy

Choose **New journey → Yellow Legacy** to play [Yellow Legacy](https://github.com/cRz-Shadows/Pokemon_Yellow_Legacy), TheSmithPlays' rebalance of Yellow. It needs Yellow Legacy **V1.0.10** on the English Yellow: choose the patched ROM (SHA-1 `2ac87de42afc70ef6016805acb3b206644417f97`), or your Yellow cartridge and the release's official `.bps` patch, which is applied in the browser (`src/yellow/bps.ts`). If Astra already has your Yellow cartridge, the patch alone is enough. The patched cartridge is kept under its own key, and Yellow Legacy journeys are separate from Yellow's.

- **From Legacy's cartridge:** everything the Yellow adventure reads from Yellow, so Legacy's trainer parties and boss movesets, wild Pokémon and fishing, marts, prizes, its new trainers and overworld sprites, TM04 Flamethrower and its dialogue. Its cartridge offsets come from a build of the V1.0.10 tag (`src/yellow/generated/symbols-legacy.ts`).
- **Legacy's map logic:** `src/yellow/scripts/legacy.ts` layers Legacy's changes over Yellow's ports, only for its cartridge. Erika, Koga and Sabrina field the team for the badges you already have, and stronger gifts (Squirtle, Charmander, Lapras, the fossils, the Tower's Marowak). The Old Rod is in Viridian, the Good Rod in Vermilion, and Fuchsia's guru gives the fossil Pokémon you passed up. Oak's aide hands over the Exp. All, a Cinnabar Lab scientist relearns moves for ¥1,000 and another deletes them, and inspecting a boulder with the Rainbow Badge uses Strength. When a Repel wears off with another of its kind in the Bag, you're asked whether to use it, and after your first heal the Pokémon Center nurses just heal.
- **After the Hall of Fame:** rematches with every gym leader but Giovanni, the Elite Four and the Champion, Oak on Route 1, a TM clerk at the Indigo Plateau, Nurse Joy in Fuchsia, Officer Jenny in Vermilion, and a full Pokédex sends Oak to the Pokémon Mansion, where beating him brings out Mew.
- **Not included:** hard mode (level caps and its battle rules). Giovanni's new pre-battle song is Yellow's unused track, which Crystal has no arrangement of, so Crystal's Team Rocket theme plays instead.

## The Crystal adventures

Choose **New journey → Crystal** to play Johto and Kanto from the Pokémon Crystal cartridge Astra already plays from: no other file is needed. Choose **New journey → Crystal Legacy** for [Crystal Legacy](https://github.com/cRz-Shadows/Pokemon_Crystal_Legacy), TheSmithPlays' rebalance of Crystal. It needs Crystal Legacy **V1.3.1**: the release's official "USA 1.0" patch (`.bps`), which Astra applies in the browser to the Crystal cartridge it already has, or that patched ROM (SHA-1 `74a6727e4406c35bc2d4f81347a5c5fdb8970663`). The patched cartridge is kept under its own key, and each adventure keeps its own journeys.

- **From the cartridge:** every map, block, collision, warp and connection, Crystal's tilesets with their morning, day and night palettes and roof colors, overworld sprites, people and their movement, signs, item balls and hidden items, trainers, wild Pokémon by time of day, fishing, Headbutt and Rock Smash tables, marts, in-game trades and all dialogue.
- **The story runs on the cartridge's own scripts.** Crystal's map scripts are bytecode, so `src/crystal/script.ts` interprets them, command by command, as the game's script engine does. The assembly routines scripts call (`special` and `callasm`) are ported in `src/crystal/specials.ts` and the modules beside it. The cartridge's standard scripts (item balls, hidden items, fruit trees, Strength boulders, smashable rocks, the contest's end) and phone scripts run the same way. The Pokémon Center nurse is the exception: as in Astra's own centers, she heals at once, with the Poké Balls on the machine and the healing jingle, and says two lines, each waiting for A. A test walks every script reachable from every map, standard script and phone contact and fails on any command or routine without a port.
- **From Astra:** the Crystal battle engine and battle screen, Pokémon pictures and cries, menus, the Bag (with a TM/HM pocket), party and summary screens, autosave and Crystal's music. Crystal and Crystal Legacy both battle with Crystal Legacy's Pokémon, moves and rules. Crystal Legacy's trainers bring the parties from the engine's Legacy data; plain Crystal's trainers bring the cartridge's.
- **Town maps:** Inspect a wall map, use Yellow’s Town Map from the bag, or open Crystal’s Pokégear Map Card. Press **← / →** to browse places, or hold to keep moving. **A** toggles 2× zoom, **↓** finds your current landmark, and **↑** switches regions when available. On the Fly map, **A** flies to the selected destination and **↓** zooms. **B** returns from any map. The Pokédex **Area** map shows a seen Pokémon’s known habitats. Both Legacy adventures use their own cartridge data.
- **Crystal's systems:** Johto runs on your device's clock, so morning, day and night, the weekday events and daily resets follow your own time. The Pokégear has its clock, map card, phone and radio card; contacts call you with their own scripts, and Elm's special calls arrive when you're outdoors. The radio plays its stations' songs, and the Poké Flute station wakes Snorlax. The Day-Care raises Pokémon and leaves Eggs, which hatch as you walk. Also playable: the Bug-Catching Contest, Kurt's Apricorn Balls, fruit trees, the Lucky Number Show, Buena's Password, roaming Raikou and Entei, swarms, the Move Deleter, the Name Rater, the move tutor and Bill's PC. The PC keeps Bill's boxes as one collection.
- **Field moves** need their badge and a Pokémon that knows the move: Cut, Surf, Strength, Whirlpool, Waterfall, Headbutt, Rock Smash, Flash, Fly, Dig, Teleport, Sweet Scent, Softboiled and Milk Drink, from the party menu or by inspecting a tree, the water, a whirlpool, a waterfall, a boulder or a rock. Fishing uses the cartridge's fishing groups.
- **Crystal Legacy's engine changes:** a Repel that wears off offers another of the same kind, the Move Reminder and Egg Move Reminder teach forgotten moves with their own dialogue, HMs can't be left in the PC, and its expanded tilesets draw as Legacy draws them. Everything else Legacy changed (its story, trainers and rematches, wild Pokémon, marts, Kurt's instant Apricorn Balls) is in its scripts and data, so it plays as Legacy wrote it.
- You move freely, diagonals included, as in the other adventures. **Option → Movement** switches to square-by-square steps. Hold B or Shift to run.

Not included: link-cable trades and battles, mobile and Mystery Gift features, the Battle Tower, Crystal Legacy's hard mode, Nayru's Pokédex (Astra's own Pokédex list is used) and room decorations (Mom saves money and buys items with it, but passes over the dolls). The Game Corner's slots and Card Flip and the Unown stone panels are Astra's own simpler versions. The radio plays music only, without its talk shows. Battle pictures use the Crystal cartridge by default, or Emerald when added in ROM manager.

## Controls and saves

| Input | Move | Confirm | Back / menu |
|---|---|---|---|
| Keyboard | Arrows or WASD | Z, Enter, Space | X / Escape; M / Tab menu |
| Touch | Lower-screen D-pad | A | B; MENU |
| Standard gamepad / 8BitDo | D-pad or left stick | A (button 0) | B (button 1); Start (button 9) |

Hold B or Shift to run, in every adventure. Connect the FlipPad in a browser-supported Gamepad API mode, then press a button. The last actively used controller is selected so an idle receiver does not steal input. Choose **Options → Controller A/B** to swap the confirm and back buttons. The choice is saved with the journey. Controller tests use simulated pad events. Physical FlipPad and iOS hardware remain unverified.

Open **Menu → Map** for a zoomable regional atlas. Select towns and numbered routes to see their connections, or open **Local map** to locate a Center, Mart, route landmark or journal destination. Tap a map symbol or press left and right to browse. A blocked crossing shows which field action can open it. In the Pokédex, select a habitat record and press A to locate it on the region map. The record gives directions from your current location. Press B to return to the same record.

At a Mart, left/right switches departments and up/down browses stock. Choose an item, set the quantity, then press A to buy or B to cancel. Five status cures are available from the start. The second badge unlocks Ether for an individual move, and the third unlocks Full Heal.

Open **Party**, choose a Pokémon and use left/right to read **Stats**, **Moves** and **Growth**. Up/down selects a move or cycles through evolution paths. The Moves page and the Fight menu show the highlighted move’s effect. Move-learning prompts let you compare both effects before replacing a move. Growth shows the experience needed for the next level and the current friendship value. Traveling partners gain a friendship point every 128 tiles. Press A to change the lead or give and take held items. An unfinished evolution move choice resumes after reloading.

Use the PC on the right in any Pokémon Center. All twelve terminals share one collection, sorted by Pokédex number with the lowest-level partner first within each species. Choose **Stored** or **Party** and press A to browse. Up/down selects a Pokémon and left/right turns the page. Once the collection fills more than one page, press Up on **Stored** to find a species by its initial.

Press A on a partner to open its details. From there, press right to inspect its stats, moves, growth and held item, or A to deposit, withdraw or swap. B goes back one screen. A catch joins the PC automatically when all six party slots are occupied. When a wild catch adds a new species to your Pokédex, Professor Alder pays a ₽600 survey grant.

Unown’s letter and each Pokémon’s shiny coloring follow the individual from battle to the Center PC. The PC and party summary identify the letter and mark shiny partners. New Hall of Fame records preserve those appearances.

Open **Menu → Journal** and press left or right to turn between Survey, Requests, Paths and Badges. In Requests or Paths, press up or down to select an entry, A to read it and B to return to the index. Inspect a blocked route in the field with A to record it. After the third badge, choose your next beacon on the Survey page to follow Sunspire, Cinderfall or Rimepeak in your preferred order.

Saves and cartridge bytes stay in this browser's IndexedDB. The opening screen lists every journey with its place, badges, catches and when it was last played. Choose **New journey** to begin another adventure alongside the others, or open a journey to continue, export or delete it. A save from an earlier version becomes the first journey automatically. **Options → Export save** downloads a portable JSON backup of the current journey. On a new device, choose your cartridge and select **Restore backup** on the journey list to add it as a journey. During play, **Options → Import save** lets you compare the backup with your current journey before restoring it. If an autosave fails, Options lets you retry or export your current progress.

If a stored journey is unreadable, the recovery screen lets you export the original, restore a backup, or start over. Your previous save stays in place until the replacement has been written successfully.

If two game windows change the same journey, the older session shows a notice in Options. You can export that session before opening the newer browser save. Reload windows left open during an update so both use the current save system.

## The three requested libraries

All three run in the browser via `native/`, compiled to `public/astra_native.wasm`:

- [pokemon-crystal-battle-engine](https://github.com/LinusU/pokemon-crystal-battle-engine): actual typed native battle engine, not a replacement damage formula. The vendored bridge adds serialization, interactive move replacement, and full-party capture results for storage.
- [pokemon-synthesizer](https://github.com/LinusU/pokemon-synthesizer): continuous Gen 2 scene music, cries, and supported native battle sound events synthesized from the imported ROM. Version 0.2.3 **does implement the music wave channel**; its README checkbox was stale.
- [pokemon-sprite-compression](https://github.com/LinusU/pokemon-sprite-compression): ROM decompression for 251 front/back Pokémon sprites and Crystal overworld tiles.

Pinned revisions and local changes are recorded in [vendor/README.md](vendor/README.md). No ROM graphics or sounds are extracted into published assets. The new environmental atlas and welcome illustration are original generated artwork; provenance/prompts are in [docs/art](docs/art).

## Verification

```sh
npm test                 # world, actors, navigation, audio, battle and save checks
npm run typecheck
npm run build
npm run test:native      # Rust tests + local-ROM WASM integration smoke test
npm run test:campaign    # repeatable local-ROM battle run for all three starters
npx vite-node scripts/yellow-coverage.ts   # Yellow map logic that still lacks a port (expects ./pokeyellow.gbc)
npx vite-node scripts/yellow-coverage.ts pokeyellow.gbc yellow-legacy.bps   # the same for Yellow Legacy
CRYSTAL_FUZZ=1 npx vitest run tests/crystal-fuzz.test.ts   # run every Crystal map script headless
CRYSTAL_RENDER=out npx vitest run tests/crystal-render.test.ts   # draw a few Crystal places to PNG
CRYSTAL_WALKTHROUGH=1 npx vitest run tests/crystal-walkthrough.test.ts   # play Crystal Legacy's story headless, to Red
```

The Crystal adventures' tables are generated with `node scripts/crystal-world-symbols.mjs ../pokecrystal --out symbols-crystal.ts --source "pret/pokecrystal"` from a pret/pokecrystal checkout built as the supported cartridge, and with `node scripts/crystal-world-symbols.mjs ../Pokemon_Crystal_Legacy --out symbols-legacy.ts --source "Crystal Legacy V1.3.1 (github.com/cRz-Shadows/Pokemon_Crystal_Legacy)"` from a build of Crystal Legacy's V1.3.1 tag (rgbds 0.5.2), which matches the patched cartridge byte for byte. They hold ROM offsets, RAM addresses, names and constant values only. Crystal tests run when the Crystal ROM is present, and the Crystal Legacy tests when the official V1.3.1 "USA 1.0" patch is there too as `crystal-legacy.bps`.

Yellow's cartridge offsets and constant names are generated from a local pret/pokeyellow checkout with `node scripts/yellow-symbols.mjs ../pokeyellow`, and Yellow Legacy's from a build of its V1.0.10 tag (rgbds 0.6.1) with `node scripts/yellow-symbols.mjs ../Pokemon_Yellow_Legacy --out symbols-legacy.ts --source "Yellow Legacy V1.0.10 (github.com/cRz-Shadows/Pokemon_Yellow_Legacy)"`. The Crystal offsets the Yellow renderer reads (tilesets, palettes, overworld sprites) come from a pret/pokecrystal checkout built as the supported cartridge, with `node scripts/crystal-symbols.mjs ../pokecrystal`. Both generated tables hold addresses and identifiers only. Yellow tests run when `pokeyellow.gbc` is present in the project root, and the Yellow Legacy tests when the official V1.0.10 patch is there too as `yellow-legacy.bps`.

The native smoke check verifies wild/trainer battle results, PP and healing, forced switching, full-party capture into storage, 502 front/back pictures, music continuity, and cries. ROM-dependent tests are skipped when the local cartridge or built WASM is absent; the smoke command requires both. Browser QA covers ROM import/cache, starter selection, movement and map transitions, and actual trainer battles. See [docs/VERIFICATION.md](docs/VERIFICATION.md) for the final recorded checks.

## Current boundaries

The scripted campaign uses informed capture, team and move choices. A first-time player’s pacing and understanding across an uninterrupted playthrough, physical FlipPad handling, and native phone installation still need hands-on testing. Habitat coverage and postgame gates have automated checks. Collecting all 251 species has not been timed in human play. Move effects use custom animations, and the upstream engine has unported paths including PP Up and contest-only mechanics.
