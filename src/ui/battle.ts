import { typeNames } from "../game/type-names";
import { trackMenuCursor } from "./menu-cursor";
import type { PokemonPortrait } from "../engine/appearance";
import type { PortraitEntrance } from "../emerald/portraits";
import { playPortraitEntrance } from "./portrait-entrance";
import type { BattleMon, BattleSnapshot, Pokemon } from "../engine";
import type { CaptureSoundState } from "../engine/battle-sound";
import { battleStatus, mountParty } from "./party";
import { escapeHtml } from "./shell";
import { battleBagKey, itemInfo, mountBag, type BagItem, type BagState } from "./bag";
import { playCapture } from "./capture";
import { playMove } from "./move-animation";
import { moveComparison } from "./learn-move";
import { findMoveVisual, healingSparkle, nativeConditionVisual, type MoveVisual } from "./move-visuals";
import "./battle.css";

export { battleStatus } from "./party";

type Side = "Player" | "Enemy";
type Event = Record<string, any>;
type Battler = "player" | "enemy";
type SoundAnimation = { anim: number; param: number };
type ItemAction = { id: number; target: number | null; move_slot: number | null };
const escapes = new Set(["GotAwaySafely", "WildFled", "EnemyFled", "FledUsingItem", "FledFromBattle", "FledInFear", "BlownAway"]);

/** Crystal also uses the draw result for a successful escape. */
export function escapeAnnounced(events: unknown[]) {
  return events.some(event => {
    if (!event || typeof event !== "object" || !("Message" in event)) return false;
    const message = event.Message;
    return typeof message === "string" ? escapes.has(message)
      : !!message && typeof message === "object" && Object.keys(message).some(key => escapes.has(key));
  });
}
type Options = {
  layer: HTMLElement;
  trainerName?: string;
  caught?: readonly number[];
  arena?: "league" | "champion";
  gymBackdrop?: string;
  fieldBackdrop?: string;
  wildEncounter?: "legendary";
  snapshot: BattleSnapshot;
  act: (index: number) => BattleSnapshot;
  sprite: (mon: PokemonPortrait, back?: boolean) => string;
  spriteEntrance?: (mon: PokemonPortrait, back: boolean) => PortraitEntrance | undefined;
  species: (id: number) => { name: string; types?: number[] };
  move: (id: number, dvs?: number) => { name: string; type?: number; pp?: number; power?: number; description?: string };
  cry: (id: number) => void;
  music?: (cue: "Victory" | "Capture") => void;
  sound?: (id: number) => void;
  animationSound?: (id: number, param: number, species: number, enemy: boolean, duration: number, capture?: CaptureSoundState) => void;
  itemName: (id: number) => string;
  party: () => Pokemon[];
  speed: number;
  finish: (snapshot: BattleSnapshot) => void;
  error: (error: unknown) => void;
};

const nativeTemplates: Record<string, [string, string[]]> = {
  WildAppeared: ["Wild … appeared!", ["mon"]],
  WantsToBattle: ["… wants to battle!", ["trainer"]],
  EnemySentOut: ["… sent out …!", ["trainer", "mon"]],
  PlayerSentOut: ["Go! …", ["mon"]],
  Withdraw: ["…, come back!", ["mon"]],
  EnemyWithdrew: ["… withdrew …!", ["trainer", "mon"]],
  HookedMonAttacked: ["The hooked … attacked!", ["mon"]],
  FellFromTree: ["… fell out of the tree!", ["mon"]],
  EnemyWasDefeated: ["… was defeated!", ["trainer"]],
  LostAgainst: ["Lost against …!", ["trainer"]],
  TiedAgainst: ["Tied against …!", ["trainer"]],
  GotMoney: ["… got ¥… for winning!", ["player", "money"]],
  GotMoneySentSomeToMom: [
    "… got ¥… for winning! Sent some to MOM!",
    ["player", "money"],
  ],
  GotAwaySafely: ["Got away safely!", []],
  CantEscape: ["Can't escape!", []],
  NoRunningFromTrainer: ["No! There's no running from a trainer battle!", []],
  WildFled: ["Wild … fled!", ["mon"]],
  EnemyFled: ["Enemy … fled!", ["mon"]],
  FledUsingItem: ["… fled using a …!", ["user", "item"]],
  FledFromBattle: ["… fled from battle!", ["user"]],
  MonFainted: ["… fainted!", ["mon"]],
  EnemyMonFainted: ["Enemy … fainted!", ["mon"]],
  NoMovesLeft: ["… has no moves left!", ["mon"]],
  AlreadyOut: ["… is already out.", ["mon"]],
  EggCantBattle: ["An EGG can't battle!", []],
  NoWillToBattle: ["There's no will to battle!", []],
  GainedExp: ["… gained … EXP. Points!", ["mon", "exp"]],
  GrewToLevel: ["… grew to level …!", ["mon", "level"]],
  LearnedMove: ["… learned …!", ["mon", "mv"]],
  WhichMoveToForget: ["Which move should be forgotten?", []],
  UsedMove: ["… used …!", ["user", "mv"]],
  WontObey: ["… won't obey!", ["mon"]],
  IgnoredOrders: ["… ignored orders!", ["mon"]],
  IgnoredOrdersUser: ["… ignored orders!", ["user"]],
  LoafingAround: ["… is loafing around.", ["mon"]],
  TurnedAway: ["… turned away!", ["mon"]],
  BeganToNap: ["… began to nap!", ["mon"]],
  NoPpLeftFor: ["… has no PP left for …!", ["user", "mv"]],
  NoPpLeft: ["But no PP is left for the move!", []],
  Charging: ["… dug a hole!", ["user"]],
  MustRecharge: ["… must recharge!", ["user"]],
  StoringEnergy: ["… is storing energy!", ["user"]],
  UnleashedEnergy: ["… unleashed energy!", ["user"]],
  Crashed: ["… kept going and crashed!", ["user"]],
  Flinched: ["… flinched!", ["user"]],
  Magnitude: ["Magnitude …!", ["magnitude"]],
  HitTimes: ["Hit … times!", ["times"]],
  BeatUpAttack: ["…'s attack!", ["mon"]],
  AttackMissed: ["…'s attack missed!", ["user"]],
  Evaded: ["… evaded the attack!", ["target"]],
  CriticalHit: ["A critical hit!", []],
  SuperEffective: ["It's super-effective!", []],
  DidntAffect: ["It didn't affect …!", ["target"]],
  DoesntAffect: ["It doesn't affect …!", ["target"]],
  Unaffected: ["…'s unaffected!", ["target"]],
  OneHitKo: ["It's a one-hit KO!", []],
  ButItFailed: ["But it failed!", []],
  ItFailed: ["It failed!", []],
  NothingHappened: ["But nothing happened.", []],
  Endured: ["… ENDURED the hit!", ["target"]],
  HungOn: ["… hung on with …!", ["target", "item"]],
  Recoil: ["…'s hit with recoil!", ["user"]],
  SuckedHealth: ["Sucked health from …!", ["target"]],
  DreamEaten: ["…'s dream was eaten!", ["target"]],
  RegainedHealth: ["… regained health!", ["user"]],
  HpIsFull: ["…'s HP is full!", ["user"]],
  SharedPain: ["The battlers shared pain!", []],
  RefusedGift: ["… refused the gift!", ["target"]],
  HitByFutureSight: ["… was hit by FUTURE SIGHT!", ["target"]],
  ForesawAttack: ["… foresaw an attack!", ["user"]],
  TookAim: ["… took aim!", ["user"]],
  Identified: ["… identified …!", ["user", "target"]],
  TookDownWithIt: ["… took down with it, …!", ["target", "user"]],
  DestinyBond: ["…'s trying to take its opponent with it!", ["user"]],
  MirrorMoveFailed: ["The MIRROR MOVE failed!", []],
  MimicLearned: ["… learned …!", ["user", "mv"]],
  Sketched: ["… SKETCHED …!", ["user", "mv"]],
  Transformed: ["… TRANSFORMED into …!", ["user", "species"]],
  TransformedType: ["… transformed into the …-type!", ["user", "kind"]],
  Spite: ["…'s … was reduced by …!", ["target", "mv", "amount"]],
  Stole: ["… stole the …!", ["user", "item"]],
  CoinsScattered: ["Coins scattered everywhere!", []],
  BellChimed: ["A bell chimed!", []],
  BellyDrum: ["… cut its HP and maximized ATTACK!", ["user"]],
  CopiedStats: ["… copied the stat changes of …!", ["user", "target"]],
  StatsEliminated: ["All stat changes were eliminated!", []],
  StartPerish: ["Both Pokémon will faint in 3 turns!", []],
  PerishCount: ["…'s PERISH count is …!", ["user", "count"]],
  PutCurse: ["… cut its own HP and put a CURSE on …!", ["user", "target"]],
  TooWeakForSubstitute: ["Too weak to make a SUBSTITUTE!", []],
  MadeSubstitute: ["… made a SUBSTITUTE!", ["user"]],
  HasSubstitute: ["… has a SUBSTITUTE!", ["user"]],
  SubstituteTookDamage: ["The SUBSTITUTE took damage for …!", ["target"]],
  SubstituteFaded: ["…'s SUBSTITUTE faded!", ["target"]],
  StatRose: ["…'s … went up!", ["user", "stat"]],
  StatFell: ["…'s … fell!", ["target", "stat"]],
  WontRiseAnymore: ["…'s … won't rise anymore!", ["user", "stat"]],
  WontDropAnymore: ["…'s … won't drop anymore!", ["target", "stat"]],
  GettingPumped: ["…'s getting pumped!", ["user"]],
  RageBuilding: ["…'s RAGE is building!", ["user"]],
  FellAsleep: ["… fell asleep!", ["target"]],
  AlreadyAsleep: ["…'s already asleep!", ["target"]],
  FastAsleep: ["… is fast asleep!", ["user"]],
  WokeUp: ["… woke up!", ["user"]],
  Rested: ["… fell asleep and became healthy!", ["user"]],
  WentToSleep: ["… went to sleep!", ["user"]],
  WasPoisoned: ["… was poisoned!", ["target"]],
  BadlyPoisoned: ["…'s badly poisoned!", ["target"]],
  AlreadyPoisoned: ["…'s already poisoned!", ["target"]],
  HurtByPoison: ["… is hurt by poison!", ["user"]],
  WasBurned: ["… was burned!", ["target"]],
  AlreadyBurned: ["…'s already burned!", ["target"]],
  HurtByBurn: ["…'s hurt by its burn!", ["user"]],
  WasFrozen: ["… was frozen solid!", ["target"]],
  AlreadyFrozen: ["…'s already frozen!", ["target"]],
  FrozenSolid: ["… is frozen solid!", ["user"]],
  WasDefrosted: ["… was defrosted!", ["user"]],
  DefrostedOpponent: ["… was defrosted!", ["target"]],
  Paralyzed: ["…'s paralyzed! Maybe it can't attack!", ["target"]],
  AlreadyParalyzed: ["…'s already paralyzed!", ["target"]],
  FullyParalyzed: ["…'s fully paralyzed!", ["user"]],
  BecameConfused: ["… became confused!", ["target"]],
  AlreadyConfused: ["…'s already confused!", ["target"]],
  IsConfused: ["… is confused!", ["user"]],
  HurtItself: ["It hurt itself in its confusion!", []],
  ConfusedNoMore: ["…'s confused no more!", ["user"]],
  FellInLove: ["… fell in love!", ["target"]],
  InLoveWith: ["… is in love with …!", ["user", "target"]],
  Infatuation: ["…'s infatuation kept it from attacking!", ["user"]],
  StartedNightmare: ["… started to have a NIGHTMARE!", ["target"]],
  HasNightmare: ["… has a NIGHTMARE!", ["user"]],
  HurtByCurse: ["…'s hurt by the CURSE!", ["user"]],
  WasSeeded: ["… was seeded!", ["target"]],
  LeechSeedSaps: ["LEECH SEED saps …!", ["user"]],
  ShedLeechSeed: ["… shed LEECH SEED!", ["user"]],
  SafeguardProtect: ["… is protected by SAFEGUARD!", ["target"]],
  SafeguardFaded: ["…'s SAFEGUARD faded!", ["user"]],
  CoveredByVeil: ["…'s covered by a veil!", ["user"]],
  ProtectedByMist: ["…'s protected by MIST.", ["target"]],
  Mist: ["…'s shrouded in MIST!", ["user"]],
  ProtectedByItem: ["…'s protected by …!", ["target", "item"]],
  FledInFear: ["… fled in fear!", ["target"]],
  BlownAway: ["… was blown away!", ["target"]],
  DraggedOut: ["… was dragged out!", ["user"]],
  WrappedBy: ["… was WRAPPED by …!", ["target", "user"]],
  ClampedBy: ["… was CLAMPED by …!", ["target", "user"]],
  UsedBind: ["… used BIND on …!", ["user", "target"]],
  Trapped: ["… was trapped!", ["target"]],
  HurtByTrap: ["…'s hurt by …!", ["user", "mv"]],
  ReleasedFromTrap: ["… was released from …!", ["user", "mv"]],
  ReleasedBy: ["… was released by …!", ["user", "target"]],
  CantEscapeNow: ["… can't escape now!", ["target"]],
  WasDisabled: ["…'s … was DISABLED!", ["target", "mv"]],
  DisabledMove: ["…'s … is DISABLED!", ["user", "mv"]],
  DisabledNoMore: ["…'s disabled no more!", ["user"]],
  GotEncore: ["… got an ENCORE!", ["target"]],
  EncoreEnded: ["…'s ENCORE ended!", ["target"]],
  ProtectedItself: ["… PROTECTED itself!", ["user"]],
  ProtectingItself: ["…'s PROTECTING itself!", ["target"]],
  BracedItself: ["… braced itself!", ["user"]],
  LightScreen: ["…'s SPCL.DEF rose!", ["user"]],
  Reflect: ["…'s DEFENSE rose!", ["user"]],
  Downpour: ["A downpour started!", []],
  RainContinues: ["Rain continues to fall.", []],
  RainStopped: ["The rain stopped.", []],
  SunGotBright: ["The sunlight got bright!", []],
  SunlightIsStrong: ["The sunlight is strong.", []],
  SunlightFaded: ["The sunlight faded.", []],
  SandstormBrewed: ["A SANDSTORM brewed!", []],
  SandstormRages: ["The SANDSTORM rages.", []],
  SandstormHits: ["The SANDSTORM hits …!", ["user"]],
  SandstormSubsided: ["The SANDSTORM subsided.", []],
  Spikes: ["SPIKES scattered all around …!", ["target"]],
  HurtBySpikes: ["…'s hurt by SPIKES!", ["user"]],
  BlewSpikes: ["… blew away SPIKES!", ["user"]],
  ItemActivated: ["…'s … activated!", ["user", "item"]],
  RecoveredWithItem: ["… recovered with ….", ["target", "item"]],
  RecoveredUsing: ["… recovered using a …!", ["target", "item"]],
  RecoveredPpUsing: ["… recovered PP using ….", ["user", "item"]],
  ItemHealedConfusion: ["A … rid … of its confusion.", ["item", "target"]],
  PlayerUsedItem: ["… used the ….", ["player", "item"]],
  EnemyUsedItem: ["… used … on …!", ["trainer", "item", "mon"]],
  ItemsCantBeUsedHere: ["Items can't be used here.", []],
  OakWarning: ["OAK: …! This isn't the time to use that!", ["player"]],
  WontHaveEffect: ["It won't have any effect.", []],
  CantUseOnEgg: ["That can't be used on an EGG.", []],
  RestoreWhichMove: ["Restore the PP of which move?", []],
  PpRestored: ["PP was restored.", []],
  PartyRecoveredHp: ["… recovered … HP!", ["mon", "hp"]],
  PartyCuredOfPoison: ["…'s cured of poison.", ["mon"]],
  PartyBurnHealed: ["…'s burn was healed.", ["mon"]],
  PartyDefrosted: ["… was defrosted.", ["mon"]],
  PartyWokeUp: ["… woke up.", ["mon"]],
  PartyRidOfParalysis: ["…'s rid of paralysis.", ["mon"]],
  PartyHealthReturned: ["…'s health returned.", ["mon"]],
  PartyRevitalized: ["… is revitalized.", ["mon"]],
  PartyCameToSenses: ["… came to its senses.", ["mon"]],
  PartyGrewToLevel: ["… grew to level …!", ["mon", "level"]],
  BallBlocked: ["The trainer blocked the BALL!", []],
  BallDontBeAThief: ["Don't be a thief!", []],
  BallBrokeFree: ["Oh no! The Pokémon broke free!", []],
  BallAppearedCaught: ["Aww! It appeared to be caught!", []],
  BallAlmostHadIt: ["Aargh! Almost had it!", []],
  BallSoClose: ["Shoot! It was so close too!", []],
  Caught: ["Gotcha! … was caught!", ["mon"]],
  NewDexData: ["…'s data was newly added to the Pokédex.", ["mon"]],
};

/** A readable fallback for messages the engine adds in future. */
export function battleMessage(
  message: any,
  move: Options["move"],
  item: Options["itemName"],
  trainerName?: string,
  species?: Options["species"],
): string {
  const plain: Record<string, string> = {
    SentHalfToMom: "Half the money was sent to Mom.",
    SentAllToMom: "All the money was sent to Mom.",
    LooksBitter: "It looks bitter…",
    LightScreenFell: "The Light Screen fell!",
    ReflectFaded: "Reflect faded!",
    CriticalHit: "A critical hit!",
    SuperEffective: "It's super effective!",
    NotVeryEffective: "It's not very effective…",
    BallBrokeFree: "Oh no! The Pokémon broke free!",
    BallAppearedCaught: "It appeared to be caught!",
    BallAlmostHadIt: "Almost had it!",
    BallSoClose: "So close!",
    BallBlocked: "The trainer blocked the ball!",
    BallDontBeAThief: "You can't catch a trainer's Pokémon!",
    GotAwaySafely: "Got away safely!",
    CantEscape: "Can't escape!",
    NoRunningFromTrainer: "You can't run from a trainer battle!",
    ButItFailed: "But it failed!",
    ItFailed: "It failed!",
    NothingHappened: "But nothing happened.",
    OneHitKo: "It's a one-hit KO!",
    HurtItself: "It hurt itself in confusion!",
    WontHaveEffect: "It won't have any effect.",
    WhichMoveToForget: "Which move should be forgotten?",
    NoPpLeft: "No PP is left for this move!",
    Downpour: "A downpour started!",
    RainContinues: "Rain continues to fall.",
    RainStopped: "The rain stopped.",
    SunGotBright: "The sunlight turned harsh!",
    SunlightIsStrong: "The sunlight is strong.",
    SunlightFaded: "The sunlight faded.",
    SandstormBrewed: "A sandstorm began!",
    SandstormRages: "The sandstorm rages.",
    SandstormSubsided: "The sandstorm subsided.",
    PpRestored: "PP was restored.",
    EggCantBattle: "An Egg can't battle!",
    NoWillToBattle: "There's no will to battle!",
  };
  if (typeof message === "string")
    return (
      plain[message] || nativeTemplates[message]?.[0] || "The battle continues."
    );
  const [kind, raw] = (Object.entries(message || {})[0] as [string, any]) || [];
  const d = raw && typeof raw === "object" ? { ...raw } : raw;
  if (trainerName && d?.trainer)
    d.trainer = { ...d.trainer, name: trainerName };
  if (!kind) return "";
  for (const role of ["user", "target"]) {
    const mon = d[role];
    if (mon?.side === "Enemy")
      d[role] = { ...mon, name: `${trainerName ? "Foe" : "Wild"} ${mon.name}` };
  }
  const n = d.user?.name || d.target?.name || d.mon || "Pokémon";
  const m = (id: number) => {
    try {
      return move(id).name;
    } catch {
      return "a move";
    }
  };
  // Native battle messages use one-based stat name IDs, starting with Attack.
  const statName = (stat: number) =>
    [
      "stat",
      "Attack",
      "Defense",
      "Speed",
      "Special Attack",
      "Special Defense",
      "accuracy",
      "evasion",
      "Ability",
    ][stat] || "stat";
  const templates: Record<string, () => string> = {
    IgnoredOrdersSleeping: () => `${n} ignored orders and fell asleep!`,
    WildAppeared: () => `Wild ${d.mon} appeared!`,
    WantsToBattle: () => `${d.trainer.name} wants to battle!`,
    EnemySentOut: () => `${d.trainer.name} sent out ${d.mon}!`,
    PlayerSentOut: () => `Go, ${d.mon}!`,
    Withdraw: () => `${d.mon}, come back!`,
    EnemyWithdrew: () => `${d.trainer.name} withdrew ${d.mon}!`,
    UsedMove: () => `${n} used ${m(d.mv)}!`,
    AttackMissed: () => `${n}'s attack missed!`,
    Evaded: () => `${n} evaded the attack!`,
    MonFainted: () => `${n} fainted!`,
    EnemyMonFainted: () => `Enemy ${n} fainted!`,
    GainedExp: () => `${n} gained ${d.exp} EXP!`,
    GrewToLevel: () => `${n} grew to level ${d.level}!`,
    PartyGrewToLevel: () => `${n} grew to level ${d.level}!`,
    LearnedMove: () => `${n} learned ${m(d.mv)}!`,
    AskForgetMove: () =>
      `${n} wants to learn ${m(d.mv)}. Choose a move to forget.`,
    ForgotMove: () => `${n} forgot ${m(d.mv)}.`,
    Caught: () => `Gotcha! ${n} was caught!`,
    NewDexData: () => `${n}'s data was added to the Pokédex.`,
    PlayerUsedItem: () => `${d.player} used ${item(d.item)}!`,
    EnemyUsedItem: () => `${d.trainer.name} used ${item(d.item)} on ${d.mon}!`,
    PartyRecoveredHp: () => `${n} recovered ${d.hp} HP!`,
    EnemyWasDefeated: () => `${d.trainer.name} was defeated!`,
    GotMoney: () => `${d.player} got ₽${d.money} for winning!`,
    CollectedPayDay: () => `Picked up ₽${d.money} in scattered coins!`,
    HitTimes: () => `Hit ${d.times} times!`,
    Magnitude: () => `Magnitude ${d.magnitude}!`,
    DidntAffect: () => `It didn't affect ${n}!`,
    DoesntAffect: () => `It doesn't affect ${n}!`,
    Flinched: () => `${n} flinched!`,
    FellAsleep: () => `${n} fell asleep!`,
    FastAsleep: () => `${n} is fast asleep!`,
    WokeUp: () => `${n} woke up!`,
    WasPoisoned: () => `${n} was poisoned!`,
    HurtByPoison: () => `${n} is hurt by poison!`,
    WasBurned: () => `${n} was burned!`,
    HurtByBurn: () => `${n} is hurt by its burn!`,
    WasFrozen: () => `${n} was frozen solid!`,
    Paralyzed: () => `${n} was paralyzed!`,
    FullyParalyzed: () => `${n} is fully paralyzed!`,
    BecameConfused: () => `${n} became confused!`,
    IsConfused: () => `${n} is confused!`,
    RegainedHealth: () => `${n} regained health!`,
    StatRose: () =>
      `${n}'s ${statName(d.stat)} ${d.sharply ? "rose sharply" : "rose"}!`,
    StatFell: () =>
      `${n}'s ${statName(d.stat)} ${d.sharply ? "fell sharply" : "fell"}!`,
    Charging: () => `${n} is preparing ${m(d.mv)}!`,
    MustRecharge: () => `${n} must recharge!`,
    NoPpLeftFor: () => `No PP is left for ${m(d.mv)}!`,
    ProtectedItself: () => `${n} protected itself!`,
    Recoil: () => `${n} was hurt by recoil!`,
    WildFled: () => `Wild ${n} fled!`,
    ItemActivated: () => `${n}'s ${item(d.item)} activated!`,
    RecoveredWithItem: () => `${n} recovered with ${item(d.item)}!`,
    RecoveredUsing: () => `${n} recovered using ${item(d.item)}!`,
  };
  if (templates[kind]) return templates[kind]();
  const template = nativeTemplates[kind];
  if (template) {
    let [text, fields] = template;
    for (const field of fields) {
      let value = d[field];
      if (value && typeof value === "object") value = value.name;
      if (field === "mv") value = m(value);
      if (field === "item") value = item(value);
      if (field === "stat") value = statName(value);
      if (field === "species") value = species?.(value).name ?? "another Pokémon";
      if (field === "kind") value = typeNames[value] ?? "???";
      text = text.replace("…", () => String(value ?? "Pokémon"));
    }
    return text;
  }
  return d.user || d.target || d.mon
    ? `${n} is affected!`
    : "The battle continues.";
}

/** Recover HP at the start of this Pokémon's remaining event sequence. */
export function battleMonAtSendOut(
  snapshot: BattleSnapshot,
  side: "player" | "enemy",
  events: Event[],
): BattleMon {
  const mon = structuredClone(snapshot.state[side].active);
  const target = side === "player" ? "Player" : "Enemy";
  const nextSendOut = side === "player" ? "PlayerSentOut" : "EnemySentOut";
  for (const event of events) {
    if (event.Message?.[nextSendOut]) break;
    if (event.HpBar?.target === target) {
      mon.hp = event.HpBar.from;
      mon.max_hp = event.HpBar.max;
      break;
    }
  }
  return mon;
}

export class BattlePresenter {
  private root: HTMLElement;
  private snapshot: BattleSnapshot;
  private shown: Record<Battler, BattleMon>;
  /** The HP an animating bar is drawn at, between whole points; the number shows whole points. */
  private barHp: Partial<Record<Battler, number>> = {};
  private sentOut: Record<Battler, BattleMon>;
  private shownSlots: Record<Battler, number>;
  private expProgress: number;
  private lastMoves = new Map<number, { slot: number; id: number }>();
  private readonly trainerBattle: boolean;
  private queue: Event[] = [];
  private category = "";
  private lastCommand = "FIGHT";
  private bagItem: number | undefined;
  private bagTarget: number | undefined;
  private bagState: BagState = {};
  private bagView?: ReturnType<typeof mountBag>;
  private choosing = false;
  private waiting = false;
  private typing = false;
  private message = "";
  private timer = 0;
  private stopCapture?: () => void;
  private stopEntrance?: () => void;
  private stopMove?: () => void;
  private disposed = false;
  constructor(private o: Options) {
    this.snapshot = o.snapshot;
    this.trainerBattle = Boolean(o.trainerName) || o.snapshot.state.battle_mode === 2;
    this.shownSlots = { player: o.snapshot.state.player.active_slot, enemy: o.snapshot.state.enemy.active_slot };
    this.shown = {
      player: this.initialMon("player"),
      enemy: this.initialMon("enemy"),
    };
    this.sentOut = { ...this.shown };
    this.expProgress = this.expAtSendOut(this.shownSlots.player, o.snapshot.events as Event[]);
    const arena = o.arena ?? (o.trainerName === "Champion Mira" ? "champion" : o.gymBackdrop ? "gym" : o.wildEncounter ?? "field");
    const trainer = o.wildEncounter ? undefined : o.trainerName;
    const teamSize = o.snapshot.state.enemy.party?.length ?? 0;
    const trainerIntro = trainer ? `<div class="battle-challenger">
      <div class="battle-challenge-emblem" aria-hidden="true"></div>
      <div class="battle-challenger-name">${escapeHtml(trainer)}</div>
      ${teamSize ? `<div class="battle-team" role="img" aria-label="${teamSize} Pokémon">${'<i aria-hidden="true"></i>'.repeat(teamSize)}</div>` : ""}
    </div>` : "";
    o.layer.innerHTML = `<section class="battle-scene encounter" data-arena="${arena}" role="dialog" aria-label="Battle">
      <div class="battle-field">
        ${trainerIntro}
        <div class="battle-hud battle-enemy-hud"></div>
        <div class="battle-hud battle-player-hud"></div>
        <div class="battle-mon battle-enemy"><img alt=""></div>
        <div class="battle-mon battle-player"><img alt=""></div>
        <canvas class="battle-move-fx" aria-hidden="true"></canvas>
        <div class="battle-party-effect" hidden></div>
      </div>
      <div class="battle-box">
        <div class="battle-copy" aria-live="polite"></div><div class="battle-controls"></div>
      </div>
    </section>`;
    this.root = o.layer.querySelector(".battle-scene")!;
    if (o.gymBackdrop) this.root.style.setProperty("--gym-backdrop", `url("${o.gymBackdrop}")`);
    if (arena === "field" && o.fieldBackdrop) {
      this.root.classList.add("field-backdrop");
      this.root.style.setProperty("--field-backdrop", `url("${o.fieldBackdrop}")`);
    }
    trackMenuCursor(this.root.querySelector<HTMLElement>(".battle-controls")!, button => {
      if (this.snapshot.site === "BattleMenu" && button.dataset.group)
        this.lastCommand = button.dataset.group;
    });
    this.root.style.setProperty(
      "--battle-speed",
      `${1 / Math.max(0.25, o.speed)}`,
    );
    this.paint();
    const opening = o.snapshot.events as Event[];
    if (
      trainer || opening.some((e) => e.Frontpic !== undefined || e.Message?.EnemySentOut || (e.Animation?.anim === 257 && e.Animation.param === 0 && e.Animation.user === "Enemy"))
    )
      this.conceal("enemy");
    if (opening.some((e) => e.Message?.PlayerSentOut || (e.Animation?.anim === 257 && e.Animation.user === "Player")))
      this.conceal("player");
    this.enqueue(o.snapshot);
  }
  private conceal(side: "enemy" | "player", hidden = true) {
    this.root.classList.toggle(`conceal-${side}`, hidden);
    if (side === "enemy" && !hidden) this.root.querySelector(".battle-challenger")?.remove();
  }
  private initialMon(
    side: "player" | "enemy",
    events: Event[] = this.snapshot.events as Event[],
  ): BattleMon {
    return battleMonAtSendOut(this.snapshot, side, events);
  }
  private expAtSendOut(slot: number, events: Event[]) {
    for (const event of events) {
      if (event.SendOut?.side === "Player" && event.SendOut.slot !== slot) break;
      if (event.ExpBar?.slot === slot) return event.ExpBar.from as number;
    }
    return this.snapshot.exp_progress[slot] ?? 0;
  }
  private portrait(side: Battler): PokemonPortrait {
    const { species, dvs } = this.shown[side];
    return { species, dvs, paletteDvs: this.sentOut[side].dvs };
  }
  private paint() {
    for (const side of ["player", "enemy"] as const) {
      const mon = this.shown[side];
      const hud = this.root.querySelector<HTMLElement>(`.battle-${side}-hud`)!;
      const ratio = Math.max(0, Math.min(1, (this.barHp[side] ?? mon.hp) / Math.max(1, mon.max_hp)));
      const image = this.root.querySelector<HTMLImageElement>(
        `.battle-${side} img`,
      )!;
      const original = this.sentOut[side];
      const traits = `${mon.dvs}:${original.dvs}`;
      if (image.dataset.species !== String(mon.species) || image.dataset.dvs !== traits) {
        image.dataset.dvs = traits;
        image.dataset.species = String(mon.species);
        image.src = this.o.sprite(this.portrait(side), side === "player");
        image.alt = this.o.species(mon.species).name;
      }
      const status = battleStatus(mon.status);
      const name = side === "player" ? this.memberName(this.shownSlots.player)
        : original.species === mon.species ? image.alt : this.o.species(original.species).name;
      const badge = status
        ? `<span class="battle-status ${status[0].toLowerCase()}" aria-label="${status[1]}" title="${status[1]}">${status[0]}</span>`
        : "";
      const owned = side === "enemy" && !this.trainerBattle && this.o.caught?.includes(original.species)
        ? '<i class="battle-owned" role="img" aria-label="Already caught" title="Already caught"></i>' : "";
      hud.innerHTML = `<div class="battle-hud-top"><strong>${escapeHtml(name)}</strong><span>Lv${mon.level}</span></div><div class="battle-hp"><b>HP</b><div class="battle-hp-track"><i class="${ratio <= 0.2 ? "low" : ratio <= 0.5 ? "mid" : ""}" style="width:${ratio * 100}%"></i></div></div><div class="battle-hud-bottom">${owned}${badge}${side === "player" ? `<span class="battle-hp-value">${mon.hp} / ${mon.max_hp}</span>` : ""}</div>${side === "player" ? `<div class="battle-exp" role="meter" aria-label="Experience to next level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${this.expProgress}"><i style="width:${this.expProgress}%"></i></div>` : ""}`;
    }
  }
  private enqueue(snapshot: BattleSnapshot) {
    this.snapshot = snapshot;
    this.queue = [...snapshot.events] as Event[];
    this.clearCapture();
    this.choosing = false;
    this.root.classList.remove("battle-choosing", "battle-moves", "battle-learning", "battle-lesson-confirm");
    this.root.querySelector(".battle-controls")!.innerHTML = "";
    this.next();
  }
  private delay(ms: number, callback: () => void) {
    this.timer = window.setTimeout(
      () => {
        if (!this.disposed) callback();
      },
      ms / Math.max(0.25, this.o.speed),
    );
  }
  private next() {
    if (this.disposed) return;
    const event = this.queue.shift();
    if (!event) {
      if (this.snapshot.outcome && this.snapshot.result) {
        this.destroy();
        this.o.finish(this.snapshot);
        return;
      }
      this.shownSlots = { player: this.snapshot.state.player.active_slot, enemy: this.snapshot.state.enemy.active_slot };
      this.shown = {
        player: structuredClone(this.snapshot.state.player.active),
        enemy: structuredClone(this.snapshot.state.enemy.active),
      };
      this.expProgress = this.snapshot.exp_progress[this.shownSlots.player] ?? 0;
      for (const side of ["player", "enemy"] as const) {
        this.root.querySelector(`.battle-${side}`)?.classList.toggle("faint", this.shown[side].hp === 0);
        // Crystal stores Underground and Flying in bits 5 and 6 of SubStatus3.
        const substatus = this.snapshot.state[side].substatus?.[2] ?? 0;
        this.setOutOfReach(side, (substatus & 0x60) !== 0);
      }
      if (this.snapshot.site === "OfferSwitch")
        this.conceal("enemy");
      else if (this.shown.enemy.hp > 0) this.conceal("enemy", false);
      if (this.shown.player.hp > 0) this.conceal("player", false);
      this.paint();
      this.menu();
      return;
    }
    if (event.Music === "Victory" || event.Music === "Capture") {
      this.o.music?.(event.Music);
      this.next();
      return;
    }
    if (event.Message) {
      const message = event.Message;
      const kind =
        typeof message === "string" ? message : Object.keys(message)[0];
      if (message.Transformed) {
        const side = message.Transformed.user.side === "Player" ? "player" : "enemy";
        const target = this.shown[side === "player" ? "enemy" : "player"];
        this.shown[side] = { ...this.shown[side], species: message.Transformed.species, dvs: target.dvs };
        this.paint();
      }
      const growth = message.GrewToLevel;
      if (growth?.slot === this.shownSlots.player) {
        this.shown.player.level = growth.level;
        this.expProgress = growth.level >= 100 ? 100 : 0;
        this.paint();
      }
      if (kind === "BallBlocked" || kind === "BallDontBeAThief") this.clearCapture();
      if (/^(Downpour|RainContinues|SunGotBright|SunlightIsStrong|SandstormBrewed|SandstormRages)$/.test(kind)) {
        this.root.classList.add("weather-flash");
        this.root.querySelector(".battle-field")?.addEventListener(
          "animationend",
          () => this.root.classList.remove("weather-flash"),
          { once: true },
        );
      }
      this.say(
        battleMessage(
          message,
          this.o.move,
          this.o.itemName,
          this.o.trainerName,
          this.o.species,
        ),
        !/^(WantsToBattle|WildAppeared|Caught|EnemyWasDefeated|GotMoney|GotMoneySentSomeToMom|LostAgainst|TiedAgainst|AskForgetMove)$/.test(kind),
      );
      return;
    }
    if (event.SendOut) {
      const { side, slot, mon } = event.SendOut;
      const battler = side === "Player" ? "player" : "enemy";
      this.shownSlots[battler] = slot;
      this.shown[battler] = mon;
      this.sentOut[battler] = mon;
      this.setOutOfReach(battler, false);
      if (battler === "player") this.expProgress = this.expAtSendOut(slot, this.queue);
      this.paint();
      this.next();
      return;
    }
    if (event.Sound !== undefined) {
      this.o.sound?.(event.Sound);
      this.next();
      return;
    }
    if (event.Cry !== undefined) {
      this.o.cry(event.Cry);
      this.next();
      return;
    }
    if (event.Frontpic !== undefined) {
      this.o.cry(event.Frontpic);
      if (this.root.classList.contains("conceal-enemy")) {
        this.conceal("enemy", false);
        this.animate("enemy", "appear", 500);
      } else {
        this.next();
      }
      return;
    }
    if (event.Faint) {
      this.animate(event.Faint === "Player" ? "player" : "enemy", "faint", 650);
      return;
    }
    if (event.SlideOut) {
      this.animate(
        event.SlideOut === "Player" ? "player" : "enemy",
        "withdraw",
        450,
      );
      return;
    }
    if (event.HpBar) {
      this.hp(event.HpBar);
      return;
    }
    if (event.ExpBar?.slot === this.shownSlots.player) {
      const { from, to } = event.ExpBar;
      const meter = this.root.querySelector(".battle-exp")!;
      meter.querySelector("i")!.animate(
        [{ width: `${from}%` }, { width: `${to}%` }],
        { duration: 550 / Math.max(0.25, this.o.speed), fill: "forwards" },
      );
      this.delay(550, () => {
        this.expProgress = to;
        this.paint();
        this.next();
      });
      return;
    }
    if (event.StatsBox) {
      if (event.StatsBox.slot === this.shownSlots.player)
        this.showMoveVisual("player", healingSparkle);
      else this.next();
      return;
    }
    if (event.Animation) {
      const a = event.Animation;
      const user = a.user === "Player" ? "player" : "enemy";
      if (a.anim === 257) {
        if (a.param === 1) {
          this.showMoveVisual(user, {
            motif: "star", palette: "gold", pattern: "orbit",
            anchor: "user", count: 7,
          }, { event: a });
        } else {
          this.conceal(user, false);
          this.animate(user, "appear", 500, a);
        }
        return;
      }
      if (a.anim === 258) {
        this.animate(user, "withdraw", 450, a);
        return;
      }
      if (a.anim === 256) {
        const capture = this.queue[0]?.BallWobbles;
        if (this.trainerBattle || capture == null) {
          this.clearCapture();
          this.next();
          return;
        }
        this.queue.shift(); // Play the paired native throw and wobble events as one sequence.
        this.stopCapture = playCapture(this.root.querySelector(".battle-field")!, a.param, capture, this.o.speed,
          duration => this.playAnimationSound(user, a, duration, capture),
          () => {
            if (!capture.caught) this.clearCapture();
            this.next();
          });
        return;
      }
      if (a.anim >= 259) {
        const condition = nativeConditionVisual(a.anim);
        if (condition) this.showMoveVisual(user, condition, { event: a });
        else this.next();
        return;
      }
      const move = a.anim >= 1 && a.anim <= 251 ? this.o.move(a.anim) : undefined;
      const name = a.anim === 255 ? "Sweet Scent" : move?.name;
      const visual = name && findMoveVisual(name, a.param);
      if (!visual) {
        this.next();
        return;
      }
      const vanishes = name === "DIG" || name === "FLY";
      if (vanishes) this.setOutOfReach(user, false);
      const nextMove = this.queue.findIndex((e) => e.Message?.UsedMove);
      const following = this.queue.slice(0, nextMove < 0 ? undefined : nextMove);
      const miss = following.some(
        (e) =>
          e.Message?.AttackMissed ||
          e.Message?.Evaded ||
          e.Message?.DidntAffect ||
          e.Message?.DoesntAffect,
      );
      this.showMoveVisual(user, visual, {
        event: a, miss, hit: !!move?.power,
        after: vanishes && a.param === 1 ? () => this.setOutOfReach(user, true) : undefined,
      });
      return;
    }
    this.next();
  }
  private setOutOfReach(side: Battler, active: boolean) {
    this.root.querySelector(`.battle-${side}`)!.classList.toggle("out-of-reach", active);
  }
  private playAnimationSound(user: Battler, event: SoundAnimation, duration: number, capture?: CaptureSoundState) {
    this.o.animationSound?.(event.anim, event.param, this.shown[user].species, user === "enemy", duration, capture);
  }
  private showMoveVisual(
    user: Battler,
    visual: MoveVisual,
    { event, miss = false, hit = false, after }: {
      event?: SoundAnimation; miss?: boolean; hit?: boolean; after?: () => void;
    } = {},
  ) {
    const canvas = this.root.querySelector<HTMLCanvasElement>(".battle-move-fx")!;
    const attacker = this.root.querySelector<HTMLElement>(`.battle-${user}`)!;
    const defender = this.root.querySelector<HTMLElement>(user === "player" ? ".battle-enemy" : ".battle-player")!;
    this.stopMove = playMove(canvas, attacker, defender, visual, {
      speed: this.o.speed, miss, hit, param: event?.param ?? 0,
    }, () => {
      this.stopMove = undefined;
      after?.();
      this.next();
    }, event && ((duration) => this.playAnimationSound(user, event, duration)));
  }
  private animate(side: Battler, effect: string, duration: number, event?: SoundAnimation) {
    const el = this.root.querySelector(`.battle-${side}`)!;
    if (effect !== "appear" && (
      this.root.classList.contains(`conceal-${side}`) ||
      el.classList.contains("faint") ||
      el.classList.contains("withdraw")
    )) {
      this.next();
      return;
    }
    let entrance: PortraitEntrance | undefined;
    if (effect === "appear") {
      el.classList.remove("faint", "withdraw");
      if (this.o.spriteEntrance && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        entrance = this.o.spriteEntrance(this.portrait(side), side === "player");
        if (entrance && "frames" in entrance) {
          // Give the browser time to decode alternate frames during the reveal.
          for (const frame of entrance.frames) new Image().src = frame.image;
        }
      }
    }
    const speed = Math.max(0.25, this.o.speed);
    if (event) this.playAnimationSound(side, event, duration / speed);
    el.classList.add(effect);
    this.delay(duration, () => {
      if (effect !== "faint" && effect !== "withdraw")
        el.classList.remove(effect);
      if (!entrance) return this.next();
      this.stopEntrance = playPortraitEntrance(el.querySelector("img")!, entrance, speed, () => {
        this.stopEntrance = undefined;
        this.next();
      });
    });
  }
  private clearCapture() {
    this.stopCapture?.();
    this.stopCapture = undefined;
  }
  private hp(h: { target: Side | { Party: number }; from: number; to: number; max: number }) {
    const reserve = typeof h.target === "object" && h.target.Party !== this.shownSlots.player
      ? h.target.Party
      : undefined;
    const overlay = this.root.querySelector<HTMLElement>(".battle-party-effect")!;
    const side = h.target === "Enemy" ? "enemy" : "player";
    if (reserve !== undefined) {
      overlay.hidden = false;
      overlay.innerHTML = `<div class="battle-hud-top"><strong>${escapeHtml(this.memberName(reserve))}</strong><span></span></div><div class="battle-hp"><b>HP</b><div class="battle-hp-track"><i></i></div></div>`;
    }
    // As in Crystal, the bar moves smoothly and the number follows it in whole
    // points, reaching the new value as the bar does.
    const setHp = (bar: number) => {
      const hp = h.to < h.from ? Math.ceil(bar) : Math.floor(bar);
      if (reserve === undefined) {
        this.shown[side].hp = hp;
        this.shown[side].max_hp = h.max;
        this.barHp[side] = bar;
        this.paint();
      } else {
        overlay.querySelector("span")!.textContent = `${hp} / ${h.max}`;
        overlay.querySelector("i")!.style.width = `${100 * bar / Math.max(1, h.max)}%`;
      }
    };
    const start = performance.now();
    const duration = 520 / Math.max(0.25, this.o.speed);
    const step = (now: number) => {
      if (this.disposed) return;
      const p = Math.min(1, (now - start) / duration);
      setHp(p < 1 ? h.from + (h.to - h.from) * p : h.to);
      if (p < 1) return void requestAnimationFrame(step);
      delete this.barHp[side];
      if (reserve === undefined) this.next();
      else this.delay(450, () => {
        overlay.hidden = true;
        this.next();
      });
    };
    setHp(h.from);
    requestAnimationFrame(step);
  }
  private say(text: string, routine = false) {
    this.message = text;
    this.waiting = true;
    this.typing = true;
    const copy = this.root.querySelector<HTMLElement>(".battle-copy")!;
    const controls = this.root.querySelector<HTMLElement>(".battle-controls")!;
    controls.innerHTML = `<button class="battle-continue" aria-label="Continue">▼</button>`;
    controls.querySelector("button")!.onclick = () => this.advance();
    const hold = Math.max(560, Math.min(1500, text.length * 27));
    const settle = () => {
      this.typing = false;
      if (routine) this.delay(hold, () => this.advance());
    };
    let i = 0;
    const type = () => {
      if (!this.typing) return;
      copy.textContent = text.slice(0, i += 2);
      if (i < text.length) this.delay(18, type);
      else settle();
    };
    type();
  }
  advance() {
    if (!this.waiting) return;
    if (this.typing) {
      clearTimeout(this.timer);
      this.typing = false;
      this.root.querySelector(".battle-copy")!.textContent = this.message;
      return;
    }
    clearTimeout(this.timer);
    this.waiting = false;
    this.root.querySelector(".battle-controls")!.innerHTML = "";
    this.next();
  }
  back() {
    // B turns the page as A does; it only backs out of a menu.
    if (this.waiting) return this.advance();
    if (!this.choosing) return;
    if (this.snapshot.site === "LearnMove") {
      this.root.querySelector<HTMLButtonElement>("[data-reconsider], .battle-keep")?.click();
      return;
    }
    if (this.bagView) {
      this.bagView.back();
      return;
    }
    if (this.bagTarget !== undefined) {
      const previous = this.bagTarget;
      this.bagTarget = undefined;
      this.menu("", previous);
      return;
    }
    if (this.bagItem !== undefined) {
      this.bagItem = undefined;
      this.root.querySelector(".party-screen")?.remove();
      this.openBag();
      return;
    }
    if (this.category) {
      const previous = this.category;
      this.category = "";
      this.menu(previous);
      return;
    }
    const actions = this.snapshot.legal as any[];
    const cancel = actions.findIndex(
      (a) =>
        a === "Cancel" ||
        a?.Cancel !== undefined ||
        a?.OfferSwitch?.keep === true,
    );
    if (cancel >= 0) this.act(cancel);
  }
  private memberName(slot: number) {
    const saved = this.o.party()[slot];
    const species = this.snapshot.state.player.party?.[slot]?.species ?? saved?.species;
    return saved?.nickname || (species ? this.o.species(species).name : "Pokémon");
  }
  private closeBag() {
    this.bagView?.destroy();
    this.bagView = undefined;
    this.root.querySelector<HTMLElement>(".battle-box")!.inert = false;
    this.root.querySelector(".battle-bag")?.remove();
  }
  private openBag() {
    const actions = this.snapshot.legal as { Item?: ItemAction }[];
    const items: BagItem[] = [];
    const addPocket = (pocket: "items" | "balls", entries: [number, number][]) => {
      for (const [id, count] of entries) {
        if (count <= 0) continue;
        const info = itemInfo(battleBagKey(id));
        const allowed = actions.some((a) => a.Item?.id === id);
        items.push({
          key: String(id),
          pocket,
          name: info.name ?? this.o.itemName(id),
          description: info.description,
          action: info.action,
          count,
          unavailable: pocket === "balls" && this.trainerBattle
            ? "Poké Balls are unavailable in trainer battles."
            : allowed ? undefined : "This item has no effect right now.",
        });
      }
    };
    addPocket("items", this.snapshot.bag.items);
    addPocket("balls", this.snapshot.bag.balls);
    const host = document.createElement("div");
    host.className = "battle-bag";
    this.root.append(host);
    this.root.querySelector<HTMLElement>(".battle-box")!.inert = true;
    this.bagView = mountBag(host, {
      items,
      pockets: ["items", "balls"],
      state: this.bagState,
      onUse: (item) => {
        const id = Number(item.key);
        this.closeBag();
        const noTarget = actions.findIndex((a) => a.Item?.id === id && a.Item.target == null);
        if (noTarget >= 0) this.act(noTarget);
        else {
          this.bagItem = id;
          this.menu();
        }
      },
      onCancel: () => {
        this.closeBag();
        this.category = "";
        this.menu("BAG");
      },
    });
  }
  private showParty(initialSlot?: number) {
    const { state, legal, site } = this.snapshot;
    const actions = legal as {
      Switch?: { slot: number };
      ForcedSwitch?: { slot: number };
      OfferSwitch?: { slot: number | null };
      Item?: ItemAction;
    }[];
    const item = this.bagItem;
    const rows = this.o.party().map((saved, slot) => {
      const active = slot === state.player.active_slot;
      const mon = active ? state.player.active : state.player.party?.[slot];
      const action = actions.findIndex(a => item !== undefined
        ? a.Item?.id === item && a.Item.target === slot
        : (a.Switch ?? a.ForcedSwitch ?? a.OfferSwitch)?.slot === slot);
      return {
        name: this.memberName(slot), sprite: this.o.sprite(saved),
        level: mon?.level ?? saved.level, status: mon?.status ?? saved.status,
        hp: mon?.hp ?? saved.hp, maxHp: mon?.max_hp ?? saved.stats[0],
        note: active ? "In battle" : undefined, disabled: action < 0, action,
      };
    });
    mountParty(this.root, {
      title: item !== undefined ? this.o.itemName(item) : "Switch Pokémon",
      rows, initialSlot, confirm: item !== undefined ? "Use item" : "Send out",
      onBack: site === "ForcedSwitch" ? undefined : () => this.back(),
      onSelect: slot => {
        const index = rows[slot].action;
        if (actions[index].Item?.move_slot != null) {
          this.bagTarget = slot;
          this.menu();
        } else this.act(index);
      },
    });
  }
  private menu(previousGroup = "", initialSlot?: number) {
    this.root.querySelector(".party-screen")?.remove();
    this.root.classList.remove("battle-lesson-confirm");
    this.choosing = true;
    const s = this.snapshot,
      actions = s.legal as any[],
      active = s.state.player.active;
    const key = (v: any) => (typeof v === "string" ? v : Object.keys(v)[0]);
    const group = (v: any) =>
      (
        ({
          Move: "FIGHT",
          Fight: "FIGHT",
          Item: "BAG",
          Switch: "PARTY",
          Run: "RUN",
        }) as Record<string, string>
      )[key(v)] || "";
    const learn = (s.events as Event[])
      .map((x) => x.Message?.AskForgetMove)
      .find(Boolean);
    const learningMon = s.state.player.party?.[s.learning_slot ?? s.state.player.active_slot] ?? active;
    const controls = this.root.querySelector<HTMLElement>(".battle-controls")!;
    if (this.category === "PARTY" || s.site === "ForcedSwitch" ||
        (this.bagItem !== undefined && this.bagTarget === undefined)) {
      controls.replaceChildren();
      this.showParty(initialSlot);
      return;
    }
    const describeMove = (id: number, dvs: number, currentPp?: number) => {
      const move = this.o.move(id, dvs);
      const maxPp = move.pp != null && currentPp != null
        ? Math.min(61, move.pp + Math.min(7, Math.floor(move.pp / 5)) * (currentPp >> 6))
        : move.pp;
      const stats = [
        typeNames[move.type ?? -1],
        move.power === 0 ? "Status" : move.power === 1 ? "Special power" : move.power != null ? `Pwr ${move.power}` : undefined,
        currentPp != null ? `PP ${currentPp & 63}${maxPp ? `/${maxPp}` : ""}` : undefined,
      ].filter(Boolean).join(" · ");
      return [stats, move.description].filter(Boolean).join("\n");
    };
    const standard = s.site === "BattleMenu";
    this.root.classList.toggle("battle-choosing", !standard || this.category !== "");
    const copy = this.root.querySelector(".battle-copy")!;
    if (learn) {
      copy.textContent = `${learn.mon} wants to learn ${this.o.move(learn.mv).name}.\n${describeMove(learn.mv, learningMon.dvs)}`;
    } else if (s.site === "OfferSwitch") {
      const enemy = this.o.species(s.state.enemy.active.species);
      const types = [...new Set(enemy.types)].map((type) => typeNames[type]).filter(Boolean);
      copy.textContent = `${this.o.trainerName || "The opposing trainer"} is sending out ${enemy.name}.${types.length ? `\n${types.join(" / ")}` : ""}`;
    } else if (this.bagTarget !== undefined) {
      copy.textContent = `Restore PP for which move on ${this.memberName(this.bagTarget)}?`;
    } else {
      copy.textContent = standard
        ? `What will ${this.memberName(s.state.player.active_slot)} do?`
        : "Choose a move.";
    }
    const moveMenu = this.category === "FIGHT" || s.site === "MoveSelection" || this.bagTarget !== undefined;
    const learning = s.site === "LearnMove";
    this.root.classList.toggle("battle-moves", moveMenu || learning);
    this.root.classList.toggle("battle-learning", learning);
    let entries: string[];
    if (standard && !this.category) {
      entries = ["FIGHT", "BAG", "PARTY", "RUN"].map((g) =>
        `<button data-group="${g}" aria-label="${g === "PARTY" ? "Pokémon" : g}"${g === "BAG" || g === "PARTY" || actions.some((a) => group(a) === g) ? "" : " disabled"}>${g === "PARTY" ? "POKÉMON" : g}</button>`,
      );
    } else if (learning) {
      const keep = actions.findIndex(a => a.LearnMove?.slot === null);
      entries = [];
      learningMon.moves.forEach((id, slot) => {
        const index = actions.findIndex(a => a.LearnMove?.slot === slot);
        entries.push(`<button data-index="${index}"${index < 0 ? " disabled" : ""}>Forget ${escapeHtml(this.o.move(id).name)}</button>`);
      });
      entries.push(`<button class="battle-keep" data-index="${keep}">Keep current moves</button>`);
    } else if (moveMenu) {
      const target = this.bagTarget;
      const mon = target === undefined ? active : s.state.player.party![target];
      entries = Array.from({ length: 4 }, (_, slot) => {
        const id = mon.moves[slot];
        if (!id) return '<span class="battle-empty-move" aria-hidden="true">—</span>';
        const index = actions.findIndex((a) => target === undefined
          ? a.Move?.slot === slot
          : a.Item?.id === this.bagItem && a.Item.target === target && a.Item.move_slot === slot);
        const detail = describeMove(id, mon.dvs, mon.pp[slot]);
        // Keep unusable moves focusable so muscle memory never lands on a
        // different move; selecting one explains why it can't be used.
        const unusable = index >= 0 ? ""
          : target !== undefined ? " disabled"
          : ` data-unusable="${(mon.pp[slot] & 63) === 0 ? "No PP is left for this move!" : "This move is disabled!"}"`;
        return `<button data-index="${index}" data-move-detail="${escapeHtml(detail)}"${unusable}>${escapeHtml(this.o.move(id).name)}</button>`;
      });
    } else if (s.site === "OfferSwitch") {
      const keep = actions.findIndex(a => a.OfferSwitch?.keep);
      entries = [`<button data-index="${keep}">Keep battling</button>`];
      if (actions.some(a => a.OfferSwitch?.slot != null))
        entries.push('<button data-group="PARTY">Switch Pokémon</button>');
    } else {
      entries = actions.map((action, i) =>
        `<button data-index="${i}">${key(action) === "Cancel" ? "Back" : "Continue"}</button>`);
    }
    controls.innerHTML = entries.join("");
    if (controls.querySelector("[data-move-detail]")) {
      controls.querySelectorAll<HTMLButtonElement>("[data-move-detail]").forEach((button) => {
        button.onfocus = () => {
          const prefix = this.bagTarget === undefined ? "" : "Restore PP · ";
          copy.textContent = prefix + button.dataset.moveDetail;
          const move = actions[Number(button.dataset.index)]?.Move;
          if (move) this.lastMoves.set(s.state.player.active_slot, { slot: move.slot, id: active.moves[move.slot] });
        };
      });
    }
    const last = this.lastMoves.get(s.state.player.active_slot);
    const preferred = moveMenu && this.bagTarget === undefined && last && active.moves[last.slot] === last.id
      ? actions.findIndex((a) => a.Move?.slot === last.slot)
      : -1;
    controls.scrollTop = 0;
    const command = previousGroup || (standard && !this.category ? this.lastCommand : "");
    const selected = controls.querySelector<HTMLButtonElement>(`[data-group="${command}"]:enabled, [data-index="${preferred}"]:enabled`)
      ?? controls.querySelector<HTMLButtonElement>("button:not(:disabled):not([data-unusable])");
    selected?.focus({ preventScroll: true });
    controls.querySelectorAll<HTMLButtonElement>("[data-group]").forEach(
      (b) =>
        (b.onclick = () => {
          const g = b.dataset.group!;
          if (g === "RUN") {
            const i = actions.findIndex((a) => group(a) === g);
            this.act(i);
          } else {
            this.category = g;
            if (g === "BAG") this.openBag();
            else if (g === "FIGHT" && actions.includes("Fight")) this.act(actions.indexOf("Fight"));
            else this.menu();
          }
        }),
    );
    for (const button of controls.querySelectorAll<HTMLButtonElement>("[data-index]")) {
      const index = Number(button.dataset.index);
      button.onclick = () => {
        if (button.dataset.unusable) {
          copy.textContent = button.dataset.unusable;
          return;
        }
        if (!learning) return this.act(index);
        const slot = actions[index].LearnMove.slot;
        const candidate = learn ? this.o.move(learn.mv, learningMon.dvs) : { name: "the new move" };
        if (slot === null) copy.textContent = `Give up on learning ${candidate.name}?\n${candidate.description ?? ""}`;
        else copy.innerHTML = moveComparison(this.o.move(learningMon.moves[slot], learningMon.dvs), candidate);
        this.root.classList.remove("battle-learning", "battle-moves");
        this.root.classList.add("battle-lesson-confirm");
        controls.innerHTML = `<button data-reconsider>Choose again</button><button data-confirm-lesson>${slot === null ? "Keep moves" : "Learn move"}</button>`;
        const reconsider = controls.querySelector<HTMLButtonElement>("[data-reconsider]")!;
        reconsider.onclick = () => {
          this.menu();
          controls.querySelector<HTMLButtonElement>(`[data-index="${index}"]`)?.focus({ preventScroll: true });
        };
        controls.querySelector<HTMLButtonElement>("[data-confirm-lesson]")!.onclick = () => this.act(index);
        reconsider.focus({ preventScroll: true });
      };
    }
  }
  private act(index: number) {
    if (this.waiting || !this.choosing || index < 0) return;
    this.root.querySelector(".party-screen")?.remove();
    this.root.querySelector(".battle-controls")!.innerHTML = "";
    try {
      this.category = "";
      this.bagItem = undefined;
      this.bagTarget = undefined;
      this.enqueue(this.o.act(index));
    } catch (e) {
      this.destroy();
      this.o.error(e);
    }
  }
  destroy() {
    this.disposed = true;
    clearTimeout(this.timer);
    this.stopMove?.();
    this.stopEntrance?.();
    this.clearCapture();
    this.closeBag();
    this.root.remove();
  }
}
