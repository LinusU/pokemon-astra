export const colors = {
  ivory: ["#fff6cf", "#eaaa57", "#7c4b45"],
  red: ["#fff1a1", "#ef7353", "#993e51"],
  blue: ["#e0fcff", "#61c8ef", "#3464b0"],
  ice: ["#ffffff", "#a4ecff", "#498ebf"],
  gold: ["#fffbd3", "#f4d052", "#b66b35"],
  leaf: ["#e4ffa6", "#84d86d", "#397e59"],
  earth: ["#edd19b", "#b48a5a", "#674c55"],
  steel: ["#f4fbff", "#b7c5d6", "#586986"],
  lilac: ["#ffe9ff", "#dc9cf1", "#794ea4"],
  dark: ["#e5cafe", "#8070b7", "#392855"],
  pink: ["#fff0ee", "#f49eb9", "#aa4d79"],
  teal: ["#efffec", "#77dace", "#467f95"],
  poison: ["#f8ddfb", "#ab77ca", "#63387a"],
} as const;

export type Palette = keyof typeof colors;
export type Motif =
  | "spark" | "slash" | "cross" | "fist" | "boot" | "jaw" | "horn" | "wing"
  | "rock" | "bone" | "needle" | "coin" | "egg" | "gift" | "tongue" | "grip"
  | "fire" | "bubble" | "drop" | "ice" | "bolt" | "leaf" | "seed" | "petal"
  | "orb" | "cloud" | "note" | "star" | "heart" | "plus" | "eye" | "sleep"
  | "wind" | "ring" | "crack" | "bubbles" | "web" | "coil" | "screen"
  | "shell" | "mirror" | "sword" | "clock" | "target" | "moon" | "sun"
  | "question" | "arrow" | "doll" | "baton" | "hand" | "thread" | "glint"
  | "flameburst" | "dragon" | "spike";
type Pattern =
  | "hit" | "shot" | "arc" | "beam" | "orbit" | "fall" | "rise" | "ground"
  | "wave" | "weather" | "link" | "flood" | "vortex" | "tether" | "burst"
  | "spectrum" | "column" | "boomerang" | "shield" | "echo";
type Anchor = "target" | "user" | "field";
type Motion = "dash" | "leap" | "spin" | "stomp" | "hop" | "fade" | "recoil" | "shake" | "dig" | "launch" | "shrink";

export type MoveVisual = Readonly<{
  motif: Motif;
  pattern: Pattern;
  palette: Palette;
  anchor?: Anchor;
  motion?: Motion;
  count?: number;
  scale?: number;
  duration?: number;
}>;

const moves = new Map<string, MoveVisual>();
function use(names: string, visual: MoveVisual) {
  for (const name of names.split("|")) {
    if (moves.has(name)) throw new Error(`Duplicate battle animation for ${name}`);
    moves.set(name, visual);
  }
}

// Strikes use the contact point and the sprite's approach instead of throwing a projectile.
use("POUND|TACKLE|STRUGGLE", { motif: "spark", pattern: "hit", palette: "ivory", motion: "dash" });
use("KARATE CHOP", { motif: "slash", pattern: "hit", palette: "ivory", scale: 1.25 });
use("CROSS CHOP", { motif: "cross", pattern: "hit", palette: "gold", scale: 1.4, motion: "leap" });
use("DOUBLESLAP", { motif: "hand", pattern: "hit", palette: "pink" });
use("COMET PUNCH|MACH PUNCH", { motif: "fist", pattern: "hit", palette: "steel", motion: "dash", duration: 380 });
use("MEGA PUNCH|DYNAMICPUNCH", { motif: "fist", pattern: "hit", palette: "gold", motion: "dash", scale: 1.55 });
use("DIZZY PUNCH", { motif: "fist", pattern: "orbit", palette: "lilac", count: 3, motion: "dash" });
use("FIRE PUNCH", { motif: "fist", pattern: "hit", palette: "red", motion: "dash" });
use("ICE PUNCH", { motif: "fist", pattern: "hit", palette: "ice", motion: "dash" });
use("THUNDERPUNCH", { motif: "fist", pattern: "hit", palette: "gold", motion: "dash" });
use("SCRATCH|CUT|SLASH|FALSE SWIPE", { motif: "slash", pattern: "hit", palette: "ivory", motion: "dash" });
use("FURY SWIPES|FURY CUTTER", { motif: "slash", pattern: "hit", palette: "leaf", duration: 370 });
use("METAL CLAW", { motif: "slash", pattern: "hit", palette: "steel", scale: 1.25 });
use("VICEGRIP|CLAMP", { motif: "grip", pattern: "hit", palette: "steel", scale: 1.35 });
use("GUILLOTINE", { motif: "grip", pattern: "hit", palette: "red", scale: 1.75 });
use("BITE|CRUNCH|HYPER FANG|SUPER FANG", { motif: "jaw", pattern: "hit", palette: "ivory", duration: 500 });
use("STOMP", { motif: "boot", pattern: "fall", palette: "earth", motion: "stomp" });
use("DOUBLE KICK|TRIPLE KICK", { motif: "boot", pattern: "hit", palette: "gold", motion: "leap", duration: 380 });
use("MEGA KICK", { motif: "boot", pattern: "hit", palette: "gold", motion: "leap", scale: 1.55 });
use("JUMP KICK|HI JUMP KICK", { motif: "boot", pattern: "hit", palette: "red", motion: "leap" });
use("ROLLING KICK|LOW KICK", { motif: "boot", pattern: "ground", palette: "earth", motion: "spin" });
use("HEADBUTT|SKULL BASH|STRENGTH", { motif: "spark", pattern: "hit", palette: "gold", motion: "stomp", scale: 1.3 });
use("HORN ATTACK|FURY ATTACK", { motif: "horn", pattern: "hit", palette: "ivory", motion: "dash" });
use("HORN DRILL|DRILL PECK", { motif: "horn", pattern: "hit", palette: "steel", motion: "spin", scale: 1.35 });
use("PECK", { motif: "horn", pattern: "hit", palette: "gold", motion: "dash", scale: 0.72 });
use("MEGAHORN", { motif: "horn", pattern: "hit", palette: "leaf", motion: "leap", scale: 1.65 });
use("SLAM|BODY SLAM", { motif: "spark", pattern: "ground", palette: "earth", motion: "stomp", scale: 1.35 });
use("TAKE DOWN|DOUBLE-EDGE", { motif: "spark", pattern: "hit", palette: "gold", motion: "recoil", scale: 1.6 });
use("THRASH|RAGE|FRUSTRATION|FLAIL", { motif: "spark", pattern: "orbit", palette: "red", motion: "shake", count: 5 });
use("RETURN", { motif: "heart", pattern: "hit", palette: "pink", motion: "dash" });
use("QUICK ATTACK|EXTREMESPEED", { motif: "glint", pattern: "shot", palette: "ivory", motion: "dash", count: 5, duration: 320 });
use("FAINT ATTACK|PURSUIT|THIEF", { motif: "slash", pattern: "hit", palette: "dark", motion: "fade" });
use("WING ATTACK|STEEL WING", { motif: "wing", pattern: "hit", palette: "steel", motion: "leap" });
use("FLY|SKY ATTACK", { motif: "wing", pattern: "fall", palette: "teal", motion: "leap", scale: 1.4 });
use("SUBMISSION|SEISMIC TOSS|VITAL THROW", { motif: "ring", pattern: "ground", palette: "gold", motion: "leap", scale: 1.55 });
use("COUNTER|REVERSAL", { motif: "fist", pattern: "hit", palette: "red", motion: "recoil", scale: 1.35 });
use("CRABHAMMER", { motif: "grip", pattern: "fall", palette: "blue", motion: "stomp" });
use("LICK", { motif: "tongue", pattern: "hit", palette: "pink", motion: "dash", scale: 1.35 });
use("IRON TAIL", { motif: "slash", pattern: "hit", palette: "steel", motion: "spin", scale: 1.4 });
use("ROLLOUT", { motif: "rock", pattern: "ground", palette: "earth", motion: "spin" });
use("RAPID SPIN", { motif: "wind", pattern: "orbit", palette: "teal", anchor: "user", motion: "spin", count: 5 });
use("BEAT UP", { motif: "fist", pattern: "hit", palette: "dark", motion: "dash", duration: 360 });

// Thrown objects follow a visible path before landing.
use("PAY DAY", { motif: "coin", pattern: "arc", palette: "gold", count: 5 });
use("POISON STING", { motif: "needle", pattern: "shot", palette: "poison" });
use("TWINEEDLE|PIN MISSILE|SPIKE CANNON", { motif: "needle", pattern: "shot", palette: "leaf", count: 2 });
use("SWIFT", { motif: "star", pattern: "shot", palette: "gold", count: 5 });
use("EGG BOMB", { motif: "egg", pattern: "arc", palette: "ivory", scale: 1.4 });
use("BARRAGE", { motif: "egg", pattern: "arc", palette: "leaf", duration: 420 });
use("PRESENT", { motif: "gift", pattern: "arc", palette: "red", scale: 1.4 });
use("ROCK THROW", { motif: "rock", pattern: "arc", palette: "earth", scale: 1.28 });
use("ROCK SLIDE", { motif: "rock", pattern: "fall", palette: "earth", count: 6 });
use("ROCK SMASH", { motif: "rock", pattern: "hit", palette: "earth", motion: "stomp", scale: 1.35 });
use("BONE CLUB", { motif: "bone", pattern: "hit", palette: "ivory", motion: "stomp", scale: 1.3 });
use("BONEMERANG", { motif: "bone", pattern: "boomerang", palette: "ivory", duration: 460 });
use("BONE RUSH", { motif: "bone", pattern: "hit", palette: "earth", motion: "dash", duration: 370 });

// Beams, weather and sustained effects have different silhouettes and trajectories.
use("RAZOR WIND", { motif: "slash", pattern: "wave", palette: "steel", count: 4 });
use("GUST", { motif: "wind", pattern: "wave", palette: "teal" });
use("WHIRLWIND", { motif: "wind", pattern: "vortex", palette: "teal", scale: 1.25 });
use("TWISTER", { motif: "wind", pattern: "vortex", palette: "lilac", count: 9 });
use("AEROBLAST", { motif: "wing", pattern: "beam", palette: "teal", scale: 1.7, duration: 680 });
use("BIND|WRAP", { motif: "coil", pattern: "tether", palette: "earth" });
use("CONSTRICT", { motif: "coil", pattern: "tether", palette: "lilac", scale: 0.75 });
use("VINE WHIP", { motif: "leaf", pattern: "tether", palette: "leaf", duration: 440 });
use("SAND-ATTACK", { motif: "cloud", pattern: "arc", palette: "earth", count: 5, scale: 0.75 });
use("MUD-SLAP", { motif: "drop", pattern: "arc", palette: "earth", count: 4, scale: 0.94 });
use("EARTHQUAKE", { motif: "crack", pattern: "ground", palette: "earth", anchor: "field", motion: "shake", scale: 1.45 });
use("FISSURE", { motif: "crack", pattern: "tether", palette: "earth", scale: 1.9, duration: 700 });
use("MAGNITUDE", { motif: "rock", pattern: "ground", palette: "earth", anchor: "field", motion: "shake", duration: 630 });
use("DIG", { motif: "rock", pattern: "burst", palette: "earth", motion: "leap", count: 6 });
use("SPIKES", { motif: "spike", pattern: "ground", palette: "steel", count: 5 });
use("ANCIENTPOWER", { motif: "rock", pattern: "vortex", palette: "gold", count: 5 });

use("EMBER", { motif: "fire", pattern: "shot", palette: "red", count: 4, scale: 0.85 });
use("FLAMETHROWER", { motif: "fire", pattern: "beam", palette: "red", scale: 1.28 });
use("FIRE BLAST", { motif: "flameburst", pattern: "shot", palette: "red", scale: 1.75, duration: 690 });
use("FIRE SPIN", { motif: "fire", pattern: "vortex", palette: "red", count: 8 });
use("FLAME WHEEL", { motif: "fire", pattern: "orbit", palette: "red", motion: "spin", count: 7 });
use("SACRED FIRE", { motif: "fire", pattern: "column", palette: "pink", scale: 1.65, count: 5 });
use("SELFDESTRUCT", { motif: "fire", pattern: "burst", palette: "red", anchor: "user", count: 12, scale: 1.5 });
use("EXPLOSION", { motif: "flameburst", pattern: "burst", palette: "red", anchor: "user", count: 14, scale: 2, duration: 720 });
use("DRAGON RAGE", { motif: "dragon", pattern: "shot", palette: "lilac", scale: 1.45 });
use("DRAGONBREATH", { motif: "dragon", pattern: "wave", palette: "teal", count: 5 });
use("OUTRAGE", { motif: "dragon", pattern: "orbit", palette: "red", motion: "shake", count: 4 });

use("WATER GUN", { motif: "drop", pattern: "shot", palette: "blue", count: 5 });
use("HYDRO PUMP", { motif: "drop", pattern: "beam", palette: "blue", scale: 1.7, duration: 680 });
use("BUBBLE", { motif: "bubble", pattern: "arc", palette: "ice", count: 6 });
use("BUBBLEBEAM", { motif: "bubble", pattern: "beam", palette: "ice", scale: 1.1 });
use("SURF", { motif: "drop", pattern: "flood", palette: "blue", anchor: "field", duration: 720 });
use("WATERFALL", { motif: "drop", pattern: "column", palette: "blue", motion: "leap", count: 7, scale: 1.5 });
use("WHIRLPOOL", { motif: "drop", pattern: "vortex", palette: "blue", count: 9 });
use("OCTAZOOKA", { motif: "cloud", pattern: "shot", palette: "dark", scale: 1.65 });
use("ICE BEAM", { motif: "ice", pattern: "beam", palette: "ice", scale: 1.18 });
use("BLIZZARD", { motif: "ice", pattern: "weather", palette: "ice", anchor: "field", count: 24, duration: 690 });
use("POWDER SNOW", { motif: "ice", pattern: "wave", palette: "ice", count: 5, scale: 0.75 });
use("ICY WIND", { motif: "ice", pattern: "wave", palette: "teal", count: 6 });
use("AURORA BEAM", { motif: "ice", pattern: "spectrum", palette: "ice", scale: 1.22 });

use("THUNDERSHOCK", { motif: "bolt", pattern: "shot", palette: "gold", count: 3 });
use("THUNDERBOLT", { motif: "bolt", pattern: "burst", palette: "gold", count: 6 });
use("THUNDER", { motif: "bolt", pattern: "column", palette: "gold", scale: 1.5, duration: 700 });
use("THUNDER WAVE", { motif: "bolt", pattern: "wave", palette: "gold", count: 4, scale: 0.85 });
use("SPARK", { motif: "bolt", pattern: "hit", palette: "gold", motion: "dash" });
use("ZAP CANNON", { motif: "bolt", pattern: "shot", palette: "teal", scale: 1.8, duration: 590 });

use("ABSORB", { motif: "seed", pattern: "link", palette: "leaf", count: 3, scale: 0.8 });
use("MEGA DRAIN", { motif: "orb", pattern: "link", palette: "leaf", count: 4 });
use("GIGA DRAIN", { motif: "orb", pattern: "link", palette: "teal", count: 7, scale: 1.35 });
use("LEECH LIFE", { motif: "heart", pattern: "link", palette: "red", count: 4 });
use("LEECH SEED", { motif: "seed", pattern: "arc", palette: "leaf", count: 3 });
use("RAZOR LEAF", { motif: "leaf", pattern: "shot", palette: "leaf", count: 5 });
use("PETAL DANCE", { motif: "petal", pattern: "vortex", palette: "pink", count: 9 });
use("SOLARBEAM", { motif: "sun", pattern: "beam", palette: "gold", scale: 1.75, duration: 700 });

use("ACID", { motif: "drop", pattern: "arc", palette: "poison", count: 4, scale: 0.8 });
use("TOXIC", { motif: "bubbles", pattern: "rise", palette: "poison", count: 5, scale: 1.25 });
use("SMOG|POISON GAS", { motif: "cloud", pattern: "wave", palette: "poison", count: 5 });
use("SLUDGE", { motif: "bubbles", pattern: "arc", palette: "poison", count: 3 });
use("SLUDGE BOMB", { motif: "bubbles", pattern: "arc", palette: "poison", scale: 1.65, duration: 640 });
use("POISONPOWDER", { motif: "glint", pattern: "fall", palette: "poison", count: 10 });
use("STUN SPORE", { motif: "glint", pattern: "fall", palette: "gold", count: 10 });
use("SLEEP POWDER", { motif: "glint", pattern: "fall", palette: "teal", count: 10 });
use("SPORE", { motif: "seed", pattern: "rise", palette: "leaf", count: 7, scale: 0.75 });
use("COTTON SPORE", { motif: "cloud", pattern: "fall", palette: "ivory", count: 6, scale: 0.8 });
use("STRING SHOT", { motif: "thread", pattern: "tether", palette: "ivory", scale: 0.8 });
use("SPIDER WEB", { motif: "web", pattern: "hit", palette: "steel", scale: 1.8, duration: 650 });

use("PSYBEAM", { motif: "orb", pattern: "spectrum", palette: "lilac", scale: 0.82 });
use("HYPER BEAM", { motif: "glint", pattern: "beam", palette: "ivory", scale: 2.15, duration: 730 });
use("CONFUSION", { motif: "ring", pattern: "orbit", palette: "lilac", count: 4 });
use("PSYCHIC", { motif: "orb", pattern: "burst", palette: "lilac", count: 6, scale: 1.35 });
use("PSYWAVE", { motif: "ring", pattern: "wave", palette: "lilac", count: 5 });
use("NIGHT SHADE", { motif: "moon", pattern: "column", palette: "dark", scale: 1.1 });
use("DREAM EATER", { motif: "moon", pattern: "link", palette: "dark", count: 4 });
use("SHADOW BALL", { motif: "orb", pattern: "shot", palette: "dark", scale: 1.65, duration: 630 });
use("TRI ATTACK", { motif: "glint", pattern: "spectrum", palette: "gold", scale: 1.45 });
use("HIDDEN POWER", { motif: "orb", pattern: "burst", palette: "steel", count: 6 });
use("FUTURE SIGHT", { motif: "clock", pattern: "fall", palette: "lilac", scale: 1.35 });
use("SONICBOOM", { motif: "wind", pattern: "wave", palette: "ivory", count: 4, scale: 1.27 });
use("SNORE", { motif: "sleep", pattern: "wave", palette: "dark", scale: 0.92 });
use("RAIN DANCE", { motif: "drop", pattern: "weather", palette: "blue", anchor: "field", count: 28 });
use("SUNNY DAY", { motif: "sun", pattern: "weather", palette: "gold", anchor: "field", duration: 670 });
use("SANDSTORM", { motif: "cloud", pattern: "weather", palette: "earth", anchor: "field", count: 22 });

const chargeVisuals = new Map<string, MoveVisual>([
  ["DIG", { motif: "rock", pattern: "ground", palette: "earth", anchor: "user", motion: "dig", count: 4 }],
  ["FLY", { motif: "wing", pattern: "rise", palette: "teal", anchor: "user", motion: "launch", count: 3 }],
  ["SKY ATTACK", { motif: "wing", pattern: "orbit", palette: "gold", anchor: "user", count: 5 }],
  ["SKULL BASH", { motif: "shell", pattern: "shield", palette: "earth", anchor: "user" }],
  ["SOLARBEAM", { motif: "sun", pattern: "orbit", palette: "gold", anchor: "user", count: 5 }],
  ["RAZOR WIND", { motif: "wind", pattern: "vortex", palette: "teal", anchor: "user" }],
  ["JUMP KICK", { motif: "spark", pattern: "ground", palette: "earth", anchor: "user", motion: "stomp" }],
  ["HI JUMP KICK", { motif: "spark", pattern: "ground", palette: "earth", anchor: "user", motion: "stomp" }],
]);

export function findMoveVisual(name: string, param = 0) {
  const key = name.trim().toUpperCase();
  if (param === 1 && chargeVisuals.has(key)) return chargeVisuals.get(key);
  if (key === "PRESENT" && param === 3)
    return { motif: "plus", pattern: "rise", palette: "leaf", count: 4 } satisfies MoveVisual;
  return moves.get(key);
}
