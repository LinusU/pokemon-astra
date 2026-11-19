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

Open the URL Vite prints. On first launch, choose or drop **Pokémon Crystal (English), revision 1.1**. The file name is not important; the supported ROM's SHA-1 is `f4cd194bdee0d04ca4eac29e09b8e4e9d818c133`. The ROM is read in the browser and stored in IndexedDB. It is never uploaded, included in the app bundle, or required by the production server. The supplied workspace ROM is used only for local verification.

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
- Smooth, animated movement with diagonal normalization, solid roaming NPCs, trainer sightlines and approaches, grass rustles, and continuous outdoor map boundaries. All 25 routes follow a shared regional survey with winding roads, side trails and distinct coastlines, ridges and habitats. Centers and Marts fit in 12×9 and 11×9 rooms. Regional palettes and landmarks distinguish each leg of the trip.
- Experience goes to conscious participants and eligible Exp. Share holders. Beaten road trainers offer optional practice rematches. The Bag sorts medicine, Poké Balls and key items into pockets. Field and battle menus support the D-pad, A and B. Staged battle introductions, A-acknowledged text, animated HP/experience, move effects, send-outs, fainting, and Poké Ball throws. Encounter transitions and battle exits preserve the overworld.
- Self-hosted VT323 game text, ROM music/cries/sound effects, saved sound controls, and an explicit day/night camp option.

The region plan is in [docs/DESIGN.md](docs/DESIGN.md); implemented content and contracts are in [docs/WORLD.md](docs/WORLD.md).

## Controls and saves

| Input | Move | Confirm | Back / menu |
|---|---|---|---|
| Keyboard | Arrows or WASD | Z, Enter, Space | X / Escape; M / Tab menu |
| Touch | Lower-screen D-pad | A | B; MENU |
| Standard gamepad / 8BitDo | D-pad or left stick | A (button 0) | B (button 1); Start (button 9) |

Shift runs faster. Connect the FlipPad in a browser-supported Gamepad API mode, then press a button. The last actively used controller is selected so an idle receiver does not steal input. Standard mappings are implemented and tested with simulated pad events; physical FlipPad/iOS hardware has not been tested here.

Open **Menu → Map** for a zoomable regional atlas. Select towns and numbered routes to see their connections, or open **Local map** for the next exit or objective. Party details show current moves, PP and evolution methods.

At a Mart, left/right switches departments and up/down browses stock. Choose an item, set the quantity, then press A to buy or B to cancel. Five status cures are available from the start. The second badge unlocks Ether for an individual move, and the third unlocks Full Heal.

Open **Party**, choose a Pokémon and use left/right to read **Stats**, **Moves** and **Growth**. Up/down selects a move or cycles through evolution paths. Growth shows the experience needed for the next level and the current friendship value. Traveling partners gain a friendship point every 128 tiles. Press A to change the lead or give and take held items. When evolution offers a move and all four slots are full, you can review the moves before replacing one. An unfinished choice resumes after reloading.

Use the PC on the right in any Pokémon Center to manage your team. It keeps one collection in Pokédex order. Select **Stored** or **Party**, press A to browse, and use up/down to select a Pokémon or left/right to skip six entries. A opens its details. Withdraw into an open party slot or swap directly when traveling with six. B returns one screen.

Open **Menu → Journal** and press left or right to turn between Survey, Requests, Paths and Badges. In Requests or Paths, press up or down to select an entry, A to read it and B to return to the index. Inspect a blocked route in the field with A to record it. After the third badge, choose your next beacon on the Survey page to follow Sunspire, Cinderfall or Rimepeak in your preferred order.

Saves and cartridge bytes stay in this browser's IndexedDB. **Options → Export save** creates a portable JSON backup; importing validates native Pokémon data and repairs positions obstructed by map revisions. Clearing browser storage removes the cached cartridge and save. Export a backup before changing devices or clearing storage. A new adventure asks for confirmation.

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
```

The native smoke check verifies wild/trainer battle results, PP and healing, forced switching, full-party capture into storage, 502 front/back pictures, music continuity, and cries. ROM-dependent tests are skipped when the local cartridge or built WASM is absent; the smoke command requires both. Browser QA covers ROM import/cache, starter selection, movement and map transitions, and actual trainer battles. See [docs/VERIFICATION.md](docs/VERIFICATION.md) for the final recorded checks.

## Current boundaries

The scripted campaign uses informed capture, team and move choices. A first-time player’s pacing and understanding across an uninterrupted playthrough, physical FlipPad handling, and native phone installation still need hands-on testing. Habitat coverage and postgame gates have automated checks. Collecting all 251 species has not been timed in human play. Move effects use custom animations, and the upstream engine has unported paths including PP Up and contest-only mechanics.
