/**
 * Starting a native battle and showing it, shared by every adventure: the
 * encounter transition, the battle screen with its sounds and music cues,
 * and how the battle ended. Each adventure decides who the player fights
 * and applies the result to its own save.
 */
import type { BattleOptions, BattleResult, BattleSnapshot, Engine, Pokemon } from "../engine";
import type { PokemonPortrait } from "../engine/appearance";
import type { PortraitEntrance } from "../emerald/portraits";
import type { GameAudio } from "../game/audio";
import { BattlePresenter, escapeAnnounced } from "./battle";

/** How long the encounter transition plays before the battle screen appears. */
const TRANSITION_MS = 620;

/** What every adventure lends a battle. */
export interface BattleHost {
  engine: Engine;
  layer: HTMLElement;
  sound: GameAudio;
  sprite: (mon: PokemonPortrait, back?: boolean) => string;
  spriteEntrance?: (mon: PokemonPortrait, back: boolean) => PortraitEntrance | undefined;
  cry: (species: number) => void;
}

type PresenterOptions = ConstructorParameters<typeof BattlePresenter>[0];
/** How the battle screen looks: the opponent's name and the backdrop behind them. */
export type BattleScene = Pick<PresenterOptions, "trainerName" | "arena" | "gymBackdrop" | "fieldBackdrop" | "wildEncounter">;

export interface BattleSetup extends BattleScene {
  /** The native battle: the party, the opponent, the bag and the Pokédex. */
  start: BattleOptions;
  speed: number;
  itemName: (id: number) => string;
  /** The party as the adventure holds it, for the battle screen's party list. */
  party: () => Pokemon[];
  /** The battle screen switches to victory or capture music. */
  music: (cue: "Victory" | "Capture") => void;
  /** The transition has finished and the battle screen is showing. */
  shown?: () => void;
  /** Development: the player always uses their strongest move, with no battle screen. */
  auto?: boolean;
}

/** How a battle ended for the player. A draw means it stopped without anyone fleeing. */
export type BattleEnd = "win" | "loss" | "caught" | "escaped" | "draw";

export interface FinishedBattle {
  snapshot: BattleSnapshot;
  result: BattleResult;
  end: BattleEnd;
  /** The party after the battle. A catch beyond six Pokémon is in `overflow`, for storage. */
  party: Pokemon[];
  overflow: Pokemon[];
}

/** Classifies a finished battle. Crystal reports a successful escape as a draw. */
export function battleEnd(snapshot: BattleSnapshot): BattleEnd {
  const result = snapshot.result!, outcome = (snapshot.outcome ?? result.outcome).toLowerCase();
  if (outcome === "win") return "win";
  if (outcome === "caught" || (result.caught ?? null) !== null) return "caught";
  if (outcome === "loss" || !result.party.slice(0, 6).some(mon => mon.hp > 0)) return "loss";
  return escapeAnnounced(snapshot.events) ? "escaped" : "draw";
}

export function finishedBattle(snapshot: BattleSnapshot): FinishedBattle {
  const result = snapshot.result!;
  return {
    snapshot, result, end: battleEnd(snapshot),
    party: result.party.slice(0, 6), overflow: result.party.slice(6),
  };
}

type Battle = ReturnType<Engine["startBattle"]>;

/** Plays the rest of a battle on the native engine, always choosing the player's strongest move. */
export function autoPlay(engine: Engine, battle: Battle, snapshot = battle.snapshot()) {
  let s = snapshot;
  for (let turns = 0; !s.outcome && turns < 500; turns++) {
    const legal = s.legal as Record<string, { slot?: number } | undefined>[];
    const moves = s.state.player.active.moves;
    const power = (i: number) => {
      const slot = legal[i]?.Move?.slot;
      return slot === undefined || !moves[slot] ? -1 : engine.move(moves[slot]).power;
    };
    let best = -1;
    legal.forEach((_, i) => { if (power(i) > (best < 0 ? -1 : power(best))) best = i; });
    s = battle.act(best >= 0 ? best : 0);
  }
  return s;
}

/**
 * A battle in progress. Creating one starts the native battle (throwing if
 * the engine cannot set it up) and plays the encounter transition.
 * `finished` settles when the battle ends, or rejects if the battle screen
 * fails.
 */
export class BattleLaunch {
  private presenter?: BattlePresenter;
  readonly finished: Promise<FinishedBattle>;

  constructor(host: BattleHost, setup: BattleSetup) {
    const { engine, layer, sound } = host;
    const battle = engine.startBattle(setup.start);
    layer.innerHTML = '<div class="encounter-transition" aria-hidden="true"></div>';
    this.finished = new Promise((resolve, reject) => {
      // The battle screen hands back control after each stretch of the battle.
      const present = () => {
        let s = battle.snapshot();
        if (setup.auto) s = autoPlay(engine, battle, s);
        if (s.outcome && s.result) {
          this.presenter = undefined;
          resolve(finishedBattle(s));
          return;
        }
        this.presenter = new BattlePresenter({
          layer,
          trainerName: setup.trainerName,
          arena: setup.arena,
          gymBackdrop: setup.gymBackdrop,
          fieldBackdrop: setup.fieldBackdrop,
          wildEncounter: setup.wildEncounter,
          caught: setup.start.caught,
          snapshot: s,
          act: index => battle.act(index),
          sprite: host.sprite,
          spriteEntrance: host.spriteEntrance,
          species: id => engine.species(id),
          move: (id, dvs) => engine.move(id, dvs),
          cry: host.cry,
          music: setup.music,
          sound: id => sound.soundEffect(id),
          animationSound: (...args) => sound.battleAnimation(...args),
          itemName: setup.itemName,
          party: setup.party,
          speed: setup.speed,
          finish: present,
          error: e => {
            this.presenter = undefined;
            reject(e);
          },
        });
      };
      window.setTimeout(() => {
        setup.shown?.();
        present();
      }, setup.auto ? 0 : TRANSITION_MS);
    });
  }

  /** B on the battle screen. */
  back() {
    this.presenter?.back();
  }
}
