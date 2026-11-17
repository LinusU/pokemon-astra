import type { BattleMon, BattleSnapshot } from "../engine";
import { escapeHtml } from "./shell";
import "./battle.css";

type Side = "Player" | "Enemy";
type Event = Record<string, any>;
type Experience = { mon: string; exp: number };
type Options = {
  layer: HTMLElement;
  trainerName?: string;
  prizeMoney?: number;
  arena?: "league" | "champion";
  wildEncounter?: "legendary";
  snapshot: BattleSnapshot;
  act: (index: number) => BattleSnapshot;
  sprite: (id: number, back?: boolean) => string;
  species: (id: number) => { name: string; types?: number[] };
  move: (id: number) => { name: string; type?: number; pp?: number; power?: number };
  cry: (id: number) => void;
  sound?: (id: number) => void;
  itemName: (id: number) => string;
  party: () => { species: number; moves: number[]; nickname?: string }[];
  speed: number;
  finish: (snapshot: BattleSnapshot) => void;
  error: (error: unknown) => void;
};

const typeNames: Record<number, string> = {
  0: "Normal", 1: "Fighting", 2: "Flying", 3: "Poison", 4: "Ground",
  5: "Rock", 7: "Bug", 8: "Ghost", 9: "Steel", 20: "Fire", 21: "Water",
  22: "Grass", 23: "Electric", 24: "Psychic", 25: "Ice", 26: "Dragon", 27: "Dark",
};

export function battleStatus(status: number): [string, string] | undefined {
  if (status & 7) return ["SLP", "Asleep"];
  if (status & 8) return ["PSN", "Poisoned"];
  if (status & 16) return ["BRN", "Burned"];
  if (status & 32) return ["FRZ", "Frozen"];
  if (status & 64) return ["PAR", "Paralyzed"];
}

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
  Stole: ["… stole … from its foe!", ["item", "user"]],
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
  HurtByBurn: ["…'s hurt by its burn!", ["user"]],
  WasFrozen: ["… was frozen solid!", ["target"]],
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
  prizeMoney = 0,
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
  if ((kind === "GotMoney" || kind === "GotMoneySentSomeToMom") && d)
    d.money += prizeMoney;
  if (!kind) return "";
  const n = d.user?.name || d.target?.name || d.mon || "Pokémon";
  const m = (id: number) => {
    try {
      return move(id).name;
    } catch {
      return "a move";
    }
  };
  const statName = (stat: number) =>
    [
      "stat",
      "HP",
      "Attack",
      "Defense",
      "Speed",
      "Special Attack",
      "Special Defense",
      "accuracy",
      "evasion",
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
    GotMoney: () => `${d.player} got ¥${d.money} for winning!`,
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
      if (field === "species") value = "another Pokémon";
      if (field === "kind") value = "different";
      text = text.replace("…", String(value ?? "Pokémon"));
    }
    return text;
  }
  return d.user || d.target || d.mon
    ? `${n} is affected!`
    : "The battle continues.";
}

/** Distinct visual families cover every move ID, including unknown future IDs. */
export function moveEffect(name: string, type?: number): string {
  const byType: Record<number, string> = {
    1: "impact",
    2: "impact",
    3: "poison",
    4: "earth",
    5: "earth",
    7: "grass",
    8: "psychic",
    20: "fire",
    21: "water",
    22: "grass",
    23: "electric",
    24: "psychic",
    25: "ice",
    26: "psychic",
    27: "psychic",
  };
  const n = name.toLowerCase();
  if (/fire|flame|ember|burn|heat/.test(n)) return "fire";
  if (/water|bubble|surf|hydro|rain|whirlpool|crabhammer/.test(n))
    return "water";
  if (/thunder|shock|spark|zap/.test(n)) return "electric";
  if (/ice|freeze|blizzard|frost/.test(n)) return "ice";
  if (/leaf|vine|razor|seed|solar|grass|petal/.test(n)) return "grass";
  if (/psychic|psybeam|confusion|dream|hypnosis/.test(n)) return "psychic";
  if (/poison|toxic|sludge|acid|smog/.test(n)) return "poison";
  if (/rock|earth|mud|sand|dig|magnitude/.test(n)) return "earth";
  if (/heal|recover|rest|softboiled|wish/.test(n)) return "heal";
  if (
    /growl|leer|tail whip|screech|charm|sing|dance|agility|barrier|protect/.test(
      n,
    )
  )
    return "status";
  if (/beam|blast|pulse|ray/.test(n)) return "beam";
  return byType[type ?? -1] || "impact";
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

function groupExperience(events: Event[]): Event[] {
  const grouped: Event[] = [];
  let gains: Experience[] | undefined;
  for (const event of events) {
    const gain = event.Message?.GainedExp;
    if (gain) {
      if (!gains) {
        gains = [];
        grouped.push({ Experience: gains });
      }
      gains.push(gain);
      continue;
    }
    if (
      !event.ExpBar && !event.StatsBox && event.Sound === undefined
      && !event.Message?.GrewToLevel && !event.Message?.LearnedMove
    ) gains = undefined;
    grouped.push(event);
  }
  return grouped;
}

export class BattlePresenter {
  private root: HTMLElement;
  private snapshot: BattleSnapshot;
  private shown: { player: BattleMon; enemy: BattleMon };
  private queue: Event[] = [];
  private category = "";
  private bagItem: number | undefined;
  private waiting = false;
  private typing = false;
  private message = "";
  private timer = 0;
  private disposed = false;
  constructor(private o: Options) {
    this.snapshot = o.snapshot;
    this.shown = {
      player: this.initialMon("player"),
      enemy: this.initialMon("enemy"),
    };
    const arena = o.arena ?? (o.trainerName === "Champion Mira" ? "champion" : o.wildEncounter ?? "field");
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
        <div class="battle-fx"></div>
      </div>
      <div class="battle-box">
        <div class="battle-copy" aria-live="polite"></div><div class="battle-controls"></div>
      </div>
    </section>`;
    this.root = o.layer.querySelector(".battle-scene")!;
    this.root.style.setProperty(
      "--battle-speed",
      `${1 / Math.max(0.25, o.speed)}`,
    );
    this.paint();
    const opening = o.snapshot.events as Event[];
    if (
      trainer || opening.some((e) => e.Frontpic !== undefined || e.Message?.EnemySentOut || (e.Animation?.anim === 257 && e.Animation.user === "Enemy"))
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
  private paint() {
    for (const side of ["player", "enemy"] as const) {
      const mon = this.shown[side];
      const hud = this.root.querySelector<HTMLElement>(`.battle-${side}-hud`)!;
      const ratio = Math.max(0, Math.min(1, mon.hp / Math.max(1, mon.max_hp)));
      const image = this.root.querySelector<HTMLImageElement>(
        `.battle-${side} img`,
      )!;
      if (image.dataset.species !== String(mon.species)) {
        image.dataset.species = String(mon.species);
        image.src = this.o.sprite(mon.species, side === "player");
        image.alt = this.o.species(mon.species).name;
      }
      const status = battleStatus(mon.status);
      const badge = status
        ? `<span class="battle-status ${status[0].toLowerCase()}" aria-label="${status[1]}" title="${status[1]}">${status[0]}</span>`
        : "";
      hud.innerHTML = `<div class="battle-hud-top"><strong>${escapeHtml(image.alt)}</strong><span>Lv${mon.level}</span></div><div class="battle-hp"><b>HP</b><div class="battle-hp-track"><i class="${ratio <= 0.2 ? "low" : ratio <= 0.5 ? "mid" : ""}" style="width:${ratio * 100}%"></i></div></div><div class="battle-hud-bottom">${badge}${side === "player" ? `<span class="battle-hp-value">${mon.hp} / ${mon.max_hp}</span>` : ""}</div>`;
    }
  }
  private enqueue(snapshot: BattleSnapshot) {
    this.snapshot = snapshot;
    this.queue = groupExperience(snapshot.events as Event[]);
    this.root.classList.remove("battle-choosing");
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
      this.shown = {
        player: structuredClone(this.snapshot.state.player.active),
        enemy: structuredClone(this.snapshot.state.enemy.active),
      };
      for (const side of ["player", "enemy"] as const)
        this.root.querySelector(`.battle-${side}`)?.classList.toggle("faint", this.shown[side].hp === 0);
      if (this.snapshot.site === "OfferSwitch")
        this.conceal("enemy");
      else if (this.shown.enemy.hp > 0) this.conceal("enemy", false);
      if (this.shown.player.hp > 0) this.conceal("player", false);
      this.paint();
      this.menu();
      return;
    }
    if (event.Experience) {
      const [first, ...others] = event.Experience as Experience[];
      const names = [first, ...others].map(({ mon, exp }) => `${mon} +${exp}`);
      const text = others.length
        ? `EXP · ${names.join(" · ")}`
        : `${first.mon} gained ${first.exp} EXP!`;
      this.say(text, true, true);
      return;
    }
    if (event.Message) {
      const message = event.Message;
      for (const [kind, side] of [
        ["PlayerSentOut", "player"],
        ["EnemySentOut", "enemy"],
      ] as const) {
        if (message[kind]) {
          this.shown[side] = this.initialMon(side, this.queue);
          this.root
            .querySelector(`.battle-${side}`)
            ?.classList.remove("faint", "withdraw");
          this.paint();
        }
      }
      const kind =
        typeof message === "string" ? message : Object.keys(message)[0];
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
          this.o.prizeMoney,
        ),
        /^(UsedMove|StatRose|StatFell|GainedExp|GrewToLevel|LearnedMove|PartyGrewToLevel|CriticalHit|SuperEffective|NotVeryEffective)$/.test(kind),
      );
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
      this.conceal("enemy", false);
      this.o.cry(event.Frontpic);
      this.animate("enemy", "appear", 500);
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
    if (event.ExpBar) {
      const hud = this.root.querySelector<HTMLElement>(".battle-player-hud")!;
      const bar = document.createElement("div");
      bar.className = "battle-exp";
      bar.innerHTML = "<i></i>";
      hud.append(bar);
      this.delay(550, () => {
        bar.remove();
        this.next();
      });
      return;
    }
    if (event.StatsBox) {
      if (event.StatsBox.slot === this.snapshot.state.player.active_slot)
        this.animate("player", "effect-heal", 500);
      else this.next();
      return;
    }
    if (event.BallWobbles !== undefined && event.BallWobbles !== null) {
      const b = event.BallWobbles;
      this.root.classList.add("capture", b.caught ? "caught" : "escape");
      const ball = this.root.querySelector<HTMLElement>(".battle-enemy")!;
      ball.style.setProperty("--wobbles", String(b.wobbles));
      this.delay(500 + b.wobbles * 450, () => {
        this.root.classList.remove("capture", "caught", "escape");
        if (b.caught) ball.classList.add("concealed");
        this.next();
      });
      return;
    }
    if (event.Animation) {
      const a = event.Animation;
      const user = a.user === "Player" ? "player" : "enemy";
      if (a.anim === 257) {
        this.conceal(user, false);
        this.shown[user] = this.initialMon(user, this.queue);
        this.paint();
        this.animate(user, "appear", 500);
        return;
      }
      if (a.anim === 258) {
        this.animate(user, "withdraw", 450);
        return;
      }
      if (a.anim === 256) {
        this.root.classList.add("capture", "throwing");
        this.delay(450, () => {
          this.root.classList.remove("throwing");
          this.next();
        });
        return;
      }
      if (a.anim >= 260) {
        const family =
          (
            {
              260: "status",
              262: "poison",
              263: "heal",
              265: "electric",
              273: "status",
              274: "impact",
            } as Record<number, string>
          )[a.anim] || "status";
        this.animate(user, `effect-${family}`, 500);
        return;
      }
      let name = "",
        type: number | undefined;
      if (a.anim > 0 && a.anim < 256) {
        try {
          const move = this.o.move(a.anim);
          name = move.name;
          type = move.type;
        } catch {}
      }
      const self =
        /heal|recover|rest|softboiled|agility|barrier|protect|swords dance|growth|harden|defense curl|amnesia|meditate|focus energy/i.test(
          name,
        );
      const side = (a.user === "Player") === self ? "player" : "enemy";
      const nextMove = this.queue.findIndex((e) => e.Message?.UsedMove);
      const following = this.queue.slice(0, nextMove < 0 ? undefined : nextMove);
      const miss = following.some(
        (e) =>
          e.Message?.AttackMissed ||
          e.Message?.Evaded ||
          e.Message?.DidntAffect ||
          e.Message?.DoesntAffect,
      );
      this.moveAnimation(user, side, moveEffect(name, type), miss);
      return;
    }
    this.next();
  }
  private moveAnimation(
    user: string,
    target: string,
    family: string,
    miss: boolean,
  ) {
    if (user === target) {
      this.animate(target, `effect-${family}`, 500);
      return;
    }
    const attacker = this.root.querySelector<HTMLElement>(`.battle-${user}`)!;
    const fx = this.root.querySelector<HTMLElement>(".battle-fx")!;
    attacker.classList.add("attack-windup");
    this.delay(180, () => {
      attacker.classList.remove("attack-windup");
      fx.className = `battle-fx projectile ${family} from-${user}${miss ? " misses" : ""}`;
      this.delay(360, () => {
        fx.className = "battle-fx";
        if (miss) this.next();
        else this.animate(target, `effect-${family}`, 500);
      });
    });
  }
  private animate(side: string, effect: string, duration: number) {
    const el = this.root.querySelector(`.battle-${side}`)!;
    el.classList.remove("faint", "withdraw");
    el.classList.add(effect);
    this.delay(duration, () => {
      if (effect !== "faint" && effect !== "withdraw")
        el.classList.remove(effect);
      this.next();
    });
  }
  private hp(h: {
    target: Side | { Party: number };
    from: number;
    to: number;
    max: number;
  }) {
    const side =
      h.target === "Player" ||
      (typeof h.target === "object" && h.target.Party === this.snapshot.state.player.active_slot)
        ? "player"
        : h.target === "Enemy" ? "enemy" : null;
    if (!side) {
      this.next();
      return;
    }
    const start = performance.now(),
      duration = 500 / Math.max(0.25, this.o.speed);
    const step = (now: number) => {
      if (this.disposed) return;
      const p = Math.min(1, (now - start) / duration);
      this.shown[side].hp = Math.round(h.from + (h.to - h.from) * p);
      this.shown[side].max_hp = h.max;
      this.paint();
      if (p < 1) requestAnimationFrame(step);
      else this.next();
    };
    requestAnimationFrame(step);
  }
  private say(text: string, routine = false, instant = false) {
    this.message = text;
    this.waiting = true;
    this.typing = true;
    const copy = this.root.querySelector<HTMLElement>(".battle-copy")!;
    const controls = this.root.querySelector<HTMLElement>(".battle-controls")!;
    controls.innerHTML = `<button class="battle-continue" aria-label="Continue">▼</button>`;
    controls.querySelector("button")!.onclick = () => this.advance();
    const quick = routine && this.o.speed > 1;
    const settle = () => {
      this.typing = false;
      if (quick) this.delay(Math.max(720, text.length * 35), () => this.advance());
    };
    let i = 0;
    const type = () => {
      if (!this.typing) return;
      copy.textContent = text.slice(0, ++i);
      if (i < text.length) this.delay(24, type);
      else settle();
    };
    if (instant) {
      copy.textContent = text;
      settle();
    } else type();
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
    if (this.waiting) return;
    if (this.bagItem !== undefined) {
      this.bagItem = undefined;
      this.menu();
      return;
    }
    if (this.category) {
      this.category = "";
      this.menu();
      return;
    }
    const actions = this.snapshot.legal as any[];
    const cancel = actions.findIndex(
      (a) =>
        a === "Cancel" ||
        a?.Cancel !== undefined ||
        a?.LearnMove?.slot === null ||
        a?.OfferSwitch?.keep === true,
    );
    if (cancel >= 0) this.act(cancel);
  }
  private menu() {
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
    const memberName = (slot: number) => {
      const saved = this.o.party()[slot];
      const species = s.state.player.party?.[slot]?.species ?? saved?.species;
      return saved?.nickname || (species ? this.o.species(species).name : "Pokémon");
    };
    const member = (slot: number) => {
      const mon = s.state.player.party?.[slot];
      if (!mon) return memberName(slot);
      const status = battleStatus(mon.status);
      return `${memberName(slot)} · Lv${mon.level} · ${mon.hp}/${mon.max_hp} HP${status ? ` · ${status[0]}` : ""}`;
    };
    const describeMove = (id: number, currentPp?: number) => {
      const move = this.o.move(id);
      const maxPp = move.pp != null && currentPp != null
        ? Math.min(61, move.pp + Math.min(7, Math.floor(move.pp / 5)) * (currentPp >> 6))
        : move.pp;
      return [
        typeNames[move.type ?? -1],
        move.power != null && move.power > 1 ? `Pwr ${move.power}` : undefined,
        currentPp != null ? `PP ${currentPp & 63}${maxPp ? `/${maxPp}` : ""}` : undefined,
      ].filter(Boolean).join(" · ");
    };
    const label = (v: any) => {
      const k = key(v),
        x = typeof v === "string" ? {} : v[k];
      if (k === "Move") return this.o.move(active.moves[x.slot]).name;
      if (k === "Switch" || k === "ForcedSwitch")
        return member(x.slot);
      if (k === "Item") {
        const target = x.target == null ? this.o.itemName(x.id) : member(x.target);
        const targetMove = x.move_slot == null || x.target == null
          ? undefined
          : s.state.player.party?.[x.target]?.moves[x.move_slot];
        return targetMove ? `${target} · ${this.o.move(targetMove).name}` : target;
      }
      if (k === "LearnMove")
        return x.slot === null
          ? "Keep current moves"
          : `Forget ${this.o.move(learningMon.moves[x.slot]).name}`;
      if (k === "OfferSwitch")
        return x.keep ? "Keep battling" : member(x.slot);
      return (
        (
          { Fight: "Fight", Run: "Run", Cancel: "Back" } as Record<
            string,
            string
          >
        )[k] || "Continue"
      );
    };
    const standard = s.site === "BattleMenu";
    this.root.classList.toggle("battle-choosing", !standard || this.category !== "");
    const copy = this.root.querySelector(".battle-copy")!;
    if (learn) {
      copy.textContent = `${learn.mon} wants to learn ${this.o.move(learn.mv).name}.\n${describeMove(learn.mv)}`;
    } else if (s.site === "ForcedSwitch") {
      copy.textContent = "Which Pokémon will battle next?";
    } else if (s.site === "OfferSwitch") {
      const enemy = this.o.species(s.state.enemy.active.species);
      const types = [...new Set(enemy.types)].map((type) => typeNames[type]).filter(Boolean);
      copy.textContent = `${this.o.trainerName || "The opposing trainer"} is sending out ${enemy.name}.${types.length ? `\n${types.join(" / ")}` : ""}`;
    } else if (this.bagItem !== undefined) {
      copy.textContent = `Use ${this.o.itemName(this.bagItem)} on which Pokémon?`;
    } else {
      copy.textContent = standard
        ? `What will ${memberName(s.state.player.active_slot)} do?`
        : "Choose a move.";
    }
    const controls = this.root.querySelector<HTMLElement>(".battle-controls")!;
    const entries =
      standard && !this.category
        ? ["FIGHT", "BAG", "PARTY", "RUN"].map(
            (g) =>
              `<button data-group="${g}" aria-label="${g === "PARTY" ? "Pokémon" : g}"${actions.some((a) => group(a) === g) ? "" : " disabled"}>${g === "PARTY" ? "POKÉMON" : g}</button>`,
          )
        : standard && this.category === "BAG" && this.bagItem === undefined
          ? Array.from(new Set<number>(actions.flatMap((a) => a.Item ? [a.Item.id] : [])))
              .map((id) => `<button data-item="${id}">${escapeHtml(this.o.itemName(id))}</button>`)
          : actions
            .map((a, i) => ({ a, i }))
            .filter(({ a }) => !standard || (this.bagItem !== undefined ? a.Item?.id === this.bagItem : group(a) === this.category))
            .map(({ a, i }) => {
              const detail = a.Move
                ? describeMove(active.moves[a.Move.slot], active.pp[a.Move.slot])
                : a.LearnMove?.slot != null
                  ? describeMove(learningMon.moves[a.LearnMove.slot], learningMon.pp[a.LearnMove.slot])
                  : "";
              return `<button data-index="${i}">${escapeHtml(label(a))}${detail ? `<small>${escapeHtml(detail)}</small>` : ""}</button>`;
            });
    if (standard && this.category)
      entries.push('<button data-back aria-label="Back">Back</button>');
    controls.innerHTML = entries.join("");
    controls.querySelectorAll<HTMLButtonElement>("[data-item]").forEach((b) => {
      b.onclick = () => {
        const id = Number(b.dataset.item);
        const noTarget = actions.findIndex((a) => a.Item?.id === id && a.Item.target == null);
        if (noTarget >= 0) this.act(noTarget);
        else {
          this.bagItem = id;
          this.menu();
        }
      };
    });
    controls.querySelectorAll<HTMLButtonElement>("[data-group]").forEach(
      (b) =>
        (b.onclick = () => {
          const g = b.dataset.group!;
          if (g === "RUN") {
            const i = actions.findIndex((a) => group(a) === g);
            this.act(i);
          } else {
            this.category = g;
            this.menu();
          }
        }),
    );
    controls
      .querySelectorAll<HTMLButtonElement>("[data-index]")
      .forEach((b) => (b.onclick = () => this.act(Number(b.dataset.index))));
    controls
      .querySelector<HTMLButtonElement>("[data-back]")
      ?.addEventListener("click", () => this.back());
  }
  private act(index: number) {
    if (this.waiting || !this.root.querySelector(".battle-controls button"))
      return;
    this.root.querySelector(".battle-controls")!.innerHTML = "";
    try {
      this.category = "";
      this.bagItem = undefined;
      this.enqueue(this.o.act(index));
    } catch (e) {
      this.destroy();
      this.o.error(e);
    }
  }
  destroy() {
    this.disposed = true;
    clearTimeout(this.timer);
    this.root.remove();
  }
}
