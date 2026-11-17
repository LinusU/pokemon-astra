# Pokémon Astra

A browser-native Pokémon adventure in the original Astra region, using the Crystal battle engine and assets decoded from the player's own cartridge. The current build is a playable alpha with a complete campaign progression graph; it has not had a full human campaign/balance playthrough.

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

- Growlithe, Poliwag, or Bellsprout as your partner. Alder tutors Growlithe in Ember for an immediate Fire attack.
- 12 settlements, 25 routes, 12 dungeons with three rooms each, eight gyms, and 108 connected maps in total.
- Professor Alder's beacon survey, Robin's changing relationship with Meridian, Director Vale's Celestial Engine, eight beacon keepers, the Elite Four, and Champion Mira.
- 16 journal quests, optional trainers, evolution-item rewards, a postgame reserve, and retryable legendary encounters. All 251 species have an obtainable habitat, gift, or static encounter; no trade or event service is necessary.
- Badge field abilities open return paths and hidden areas. Surf enables water traversal; Fly travels between visited settlements. Field abilities do not occupy Pokémon move slots.
- Six-member party, storage, Pokédex habitat hints, native battles/catching/experience/move decisions, evolution stones and Link Cables, friendship/time/stat evolutions, shops, fishing, repels, healing, and autosave.
- Smooth movement with diagonal normalization and collision, quick dialogue, encounter pacing, battle presentation speeds, and an explicit day/night camp option.

The region plan is in [docs/DESIGN.md](docs/DESIGN.md); implemented content and contracts are in [docs/WORLD.md](docs/WORLD.md).

## Controls and saves

| Input | Move | Confirm | Back / menu |
|---|---|---|---|
| Keyboard | Arrows or WASD | Z, Enter, Space | X / Escape; M / Tab menu |
| Touch | Lower-screen D-pad | A | B; MENU |
| Standard gamepad / 8BitDo | D-pad or left stick | A (button 0) | B (button 1); Start (button 9) |

Shift runs faster. Connect the FlipPad in a browser-supported Gamepad API mode, then press a button. The last actively used controller is selected so an idle receiver does not steal input. Standard mappings are implemented and tested with simulated pad events; physical FlipPad/iOS hardware has not been tested here.

Saves and cartridge bytes stay in this browser's IndexedDB. **Settings & save → Export save** creates a portable JSON backup; importing validates native Pokémon data and repairs positions obstructed by map revisions. Clearing browser storage removes the cached cartridge and save. Export a backup before changing devices or clearing storage. A new adventure asks for confirmation.

## The three requested libraries

All three run in the browser via `native/`, compiled to `public/astra_native.wasm`:

- [pokemon-crystal-battle-engine](https://github.com/LinusU/pokemon-crystal-battle-engine): actual typed native battle engine, not a replacement damage formula. The vendored bridge adds serialization, interactive move replacement, and full-party capture results for storage.
- [pokemon-synthesizer](https://github.com/LinusU/pokemon-synthesizer): continuous Gen 2 scene music and cries synthesized from the imported ROM. Version 0.2.3 **does implement the music wave channel**; its README checkbox was stale.
- [pokemon-sprite-compression](https://github.com/LinusU/pokemon-sprite-compression): ROM decompression for 251 front/back Pokémon sprites and Crystal overworld tiles.

Pinned revisions and local changes are recorded in [vendor/README.md](vendor/README.md). No ROM graphics or sounds are extracted into published assets. The new environmental atlas and welcome illustration are original generated artwork; provenance/prompts are in [docs/art](docs/art).

## Verification

```sh
npm test                 # content, progression, input and save validation
npm run typecheck
npm run build
npm run test:native      # Rust tests + local-ROM WASM integration smoke test
```

The native smoke check verifies wild/trainer battle results, PP and healing, forced switching, full-party capture into storage, 502 front/back pictures, music continuity, and cries. ROM-dependent tests are skipped when the local cartridge or built WASM is absent; the smoke command requires both. Browser QA covers ROM import/cache, starter selection, movement and map transitions, and actual trainer battles. See [docs/VERIFICATION.md](docs/VERIFICATION.md) for the final recorded checks.

## Current boundaries

This is an alpha, not a claim of original-game production polish or proven superiority to Gen 1. Dungeon puzzles use interactable mechanisms and persistent conditions; some later habitats use broad reserve pools. Full-campaign difficulty, economy, device battery performance, Safari installation behavior, and a physical FlipPad still need longer playtesting. The upstream battle engine has explicit unported paths, including PP Up and contest-only mechanics; Astra does not offer those mechanics. Battle presentation is custom rather than a frame-perfect reproduction of Crystal's animation scripts.
