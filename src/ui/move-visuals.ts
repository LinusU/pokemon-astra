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
  | "dome" | "anger" | "flameburst" | "dragon" | "spike" | "tail" | "bell" | "drum" | "bottle" | "brush";
type Pattern =
  | "hit" | "shot" | "arc" | "beam" | "orbit" | "fall" | "rise" | "ground"
  | "wave" | "weather" | "link" | "flood" | "vortex" | "tether" | "burst"
  | "discharge" | "inferno" | "triad" | "slice" | "rush" | "geyser" | "radiance"
  | "toss" | "gesture" | "spectrum" | "column" | "boomerang" | "shield" | "echo";
type Anchor = "target" | "user" | "field";
type Motion = "dash" | "leap" | "spin" | "stomp" | "hop" | "fade" | "recoil" | "shake" | "dig" | "launch" | "shrink" | "duplicate";

export type MoveVisual = Readonly<{
  motif: Motif;
  pattern: Pattern;
  /** Fragments released as the move connects or resolves. */
  accent?: Motif;
  wash?: "light" | "shadow";
  palette: Palette;
  anchor?: Anchor;
  motion?: Motion;
  count?: number;
  scale?: number;
  duration?: number;
}>;

const moves = new Map<string, MoveVisual>();
function use(name: string, visual: MoveVisual) {
  if (moves.has(name)) throw new Error(`Duplicate battle animation for ${name}`);
  moves.set(name, visual);
}

// Strikes use the contact point and the sprite's approach instead of throwing a projectile.
use("POUND", { motif: "hand", pattern: "hit", palette: "ivory", motion: "dash", accent: "spark" });
use("TACKLE", { motif: "spark", pattern: "hit", palette: "ivory", motion: "dash" });
use("STRUGGLE", { motif: "spark", pattern: "hit", palette: "red", motion: "recoil", accent: "wind", scale: 0.86 });
use("KARATE CHOP", { motif: "hand", pattern: "hit", palette: "ivory", accent: "slash", scale: 1.25 });
use("CROSS CHOP", { motif: "cross", pattern: "hit", palette: "gold", motion: "leap", accent: "spark", scale: 1.4 });
use("DOUBLESLAP", { motif: "hand", pattern: "hit", palette: "pink", accent: "glint", duration: 310 });
use("COMET PUNCH", { motif: "fist", pattern: "hit", palette: "blue", motion: "dash", accent: "star", scale: 0.96, duration: 370 });
use("MACH PUNCH", { motif: "fist", pattern: "rush", palette: "steel", motion: "dash", accent: "glint", count: 4, scale: 1.12, duration: 350 });
use("MEGA PUNCH", { motif: "fist", pattern: "hit", palette: "gold", motion: "stomp", accent: "ring", scale: 1.65 });
use("DYNAMICPUNCH", { motif: "fist", pattern: "hit", palette: "red", motion: "recoil", accent: "flameburst", scale: 1.65, duration: 660 });
use("DIZZY PUNCH", { motif: "fist", pattern: "hit", palette: "lilac", motion: "dash", accent: "star", scale: 1.26 });
use("FIRE PUNCH", { motif: "fist", pattern: "hit", palette: "red", motion: "dash", accent: "fire" });
use("ICE PUNCH", { motif: "fist", pattern: "hit", palette: "ice", motion: "dash", accent: "ice" });
use("THUNDERPUNCH", { motif: "fist", pattern: "hit", palette: "gold", motion: "dash", accent: "bolt" });
use("SCRATCH", { motif: "slash", pattern: "slice", palette: "ivory", motion: "dash", count: 3, scale: 0.65, duration: 390 });
use("CUT", { motif: "slash", pattern: "slice", palette: "leaf", scale: 1.15, duration: 470 });
use("SLASH", { motif: "slash", pattern: "slice", palette: "steel", motion: "dash", count: 2, scale: 1.4, duration: 530 });
use("FALSE SWIPE", { motif: "slash", pattern: "slice", palette: "ivory", accent: "glint", scale: 0.78, duration: 510 });
use("FURY SWIPES", { motif: "slash", pattern: "slice", palette: "earth", count: 2, scale: 0.9, duration: 320 });
use("FURY CUTTER", { motif: "slash", pattern: "slice", palette: "leaf", motion: "dash", accent: "leaf", scale: 1.35, duration: 370 });
use("METAL CLAW", { motif: "slash", pattern: "slice", palette: "steel", accent: "glint", count: 3, scale: 1.25 });
use("VICEGRIP", { motif: "grip", pattern: "hit", palette: "steel", accent: "slash", scale: 1.35 });
use("CLAMP", { motif: "shell", pattern: "hit", palette: "blue", accent: "bubble", scale: 1.48 });
use("GUILLOTINE", { motif: "grip", pattern: "hit", palette: "red", accent: "cross", scale: 1.75 });
use("BITE", { motif: "jaw", pattern: "hit", palette: "ivory", duration: 420 });
use("CRUNCH", { motif: "jaw", pattern: "hit", palette: "dark", accent: "crack", scale: 1.7, duration: 580 });
use("HYPER FANG", { motif: "jaw", pattern: "hit", palette: "gold", motion: "dash", accent: "needle", scale: 1.2, duration: 395 });
use("SUPER FANG", { motif: "jaw", pattern: "hit", palette: "red", accent: "glint", scale: 1.55, duration: 610 });
use("STOMP", { motif: "boot", pattern: "fall", palette: "earth", motion: "stomp" });
use("DOUBLE KICK", { motif: "boot", pattern: "hit", palette: "gold", motion: "leap", accent: "glint", scale: 0.93, duration: 350 });
use("TRIPLE KICK", { motif: "boot", pattern: "hit", palette: "red", motion: "spin", accent: "ring", scale: 1.04, duration: 370 });
use("MEGA KICK", { motif: "boot", pattern: "hit", palette: "gold", motion: "leap", accent: "wind", scale: 1.55 });
use("JUMP KICK", { motif: "boot", pattern: "arc", palette: "red", motion: "leap", scale: 1.14, duration: 490 });
use("HI JUMP KICK", { motif: "boot", pattern: "fall", palette: "red", motion: "leap", accent: "ring", scale: 1.6, duration: 610 });
use("ROLLING KICK", { motif: "boot", pattern: "hit", palette: "gold", motion: "spin", accent: "wind", scale: 1.25 });
use("LOW KICK", { motif: "boot", pattern: "ground", palette: "earth", motion: "dash", accent: "cloud" });
use("HEADBUTT", { motif: "spark", pattern: "hit", palette: "gold", motion: "dash", accent: "star", scale: 1.22 });
use("SKULL BASH", { motif: "shell", pattern: "rush", palette: "earth", motion: "recoil", accent: "spark", count: 3, scale: 1.5, duration: 520 });
use("STRENGTH", { motif: "rock", pattern: "arc", palette: "earth", motion: "stomp", accent: "cloud", scale: 1.85, duration: 660 });
use("HORN ATTACK", { motif: "horn", pattern: "hit", palette: "ivory", motion: "dash" });
use("FURY ATTACK", { motif: "horn", pattern: "hit", palette: "earth", motion: "dash", accent: "needle", scale: 0.84, duration: 325 });
use("HORN DRILL", { motif: "horn", pattern: "rush", palette: "steel", motion: "spin", accent: "ring", count: 5, scale: 1.6, duration: 620 });
use("DRILL PECK", { motif: "horn", pattern: "hit", palette: "teal", motion: "spin", accent: "wing", scale: 1.2, duration: 430 });
use("PECK", { motif: "horn", pattern: "hit", palette: "gold", motion: "dash", scale: 0.72 });
use("MEGAHORN", { motif: "horn", pattern: "hit", palette: "leaf", motion: "leap", accent: "leaf", scale: 1.65 });
use("SLAM", { motif: "tail", pattern: "hit", palette: "earth", motion: "stomp", accent: "spark", scale: 1.4 });
use("BODY SLAM", { motif: "spark", pattern: "ground", palette: "earth", motion: "stomp", accent: "cloud", scale: 1.55, duration: 600 });
use("TAKE DOWN", { motif: "spark", pattern: "hit", palette: "earth", motion: "recoil", accent: "cloud", scale: 1.4 });
use("DOUBLE-EDGE", { motif: "spark", pattern: "rush", palette: "gold", motion: "recoil", accent: "star", count: 6, scale: 1.65, duration: 550 });
use("THRASH", { motif: "fist", pattern: "hit", palette: "red", motion: "shake", accent: "spark", count: 3, scale: 1.2, duration: 620 });
use("RAGE", { motif: "anger", pattern: "burst", palette: "red", motion: "shake", count: 4, scale: 1.1 });
use("FRUSTRATION", { motif: "anger", pattern: "hit", palette: "dark", motion: "stomp", accent: "spark", count: 2, scale: 1.15 });
use("FLAIL", { motif: "hand", pattern: "hit", palette: "ivory", motion: "shake", accent: "wind", count: 3, scale: 0.9 });
use("RETURN", { motif: "heart", pattern: "hit", palette: "pink", motion: "dash" });
use("QUICK ATTACK", { motif: "glint", pattern: "rush", palette: "ivory", motion: "dash", count: 3, scale: 0.92, duration: 320 });
use("EXTREMESPEED", { motif: "glint", pattern: "rush", palette: "steel", motion: "fade", accent: "wind", count: 9, scale: 1.6, duration: 440 });
use("FAINT ATTACK", { motif: "slash", pattern: "slice", palette: "dark", motion: "fade", wash: "shadow", scale: 1.38, duration: 580 });
use("PURSUIT", { motif: "glint", pattern: "rush", palette: "dark", motion: "dash", accent: "slash", count: 4, scale: 1.08 });
use("THIEF", { motif: "hand", pattern: "boomerang", palette: "dark", motion: "fade", accent: "glint", scale: 0.98 });
use("WING ATTACK", { motif: "wing", pattern: "hit", palette: "teal", motion: "leap", accent: "wind", count: 2, scale: 1.16 });
use("STEEL WING", { motif: "wing", pattern: "slice", palette: "steel", motion: "leap", accent: "glint", scale: 1.4 });
use("FLY", { motif: "wing", pattern: "fall", palette: "teal", motion: "leap", accent: "wind", scale: 1.35 });
use("SKY ATTACK", { motif: "wing", pattern: "rush", palette: "gold", motion: "leap", accent: "star", count: 7, scale: 1.65, duration: 660 });
use("SUBMISSION", { motif: "grip", pattern: "hit", palette: "earth", motion: "spin", accent: "ring", count: 2, scale: 1.15 });
use("SEISMIC TOSS", { motif: "ring", pattern: "toss", palette: "earth", motion: "leap", accent: "rock", scale: 1.58, duration: 720 });
use("VITAL THROW", { motif: "hand", pattern: "toss", palette: "red", motion: "recoil", accent: "cloud", scale: 1.24 });
use("COUNTER", { motif: "fist", pattern: "hit", palette: "red", motion: "recoil", accent: "spark", scale: 1.42 });
use("REVERSAL", { motif: "glint", pattern: "rush", palette: "gold", motion: "recoil", accent: "spark", count: 4, scale: 1.17 });
use("CRABHAMMER", { motif: "grip", pattern: "fall", palette: "blue", motion: "stomp", accent: "drop" });
use("LICK", { motif: "tongue", pattern: "hit", palette: "pink", motion: "dash", scale: 1.35 });
use("IRON TAIL", { motif: "tail", pattern: "hit", palette: "steel", motion: "spin", accent: "glint", scale: 1.4 });
use("ROLLOUT", { motif: "rock", pattern: "rush", palette: "earth", motion: "spin", accent: "rock", count: 3 });
use("RAPID SPIN", { motif: "wind", pattern: "orbit", palette: "teal", anchor: "user", motion: "spin", count: 5 });
use("BEAT UP", { motif: "fist", pattern: "hit", palette: "dark", motion: "dash", duration: 360 });

// Thrown objects follow a visible path before landing.
use("PAY DAY", { motif: "coin", pattern: "arc", palette: "gold", count: 5 });
use("POISON STING", { motif: "needle", pattern: "shot", palette: "poison" });
use("TWINEEDLE", { motif: "needle", pattern: "shot", palette: "leaf", count: 2, scale: 1.08, duration: 380 });
use("PIN MISSILE", { motif: "needle", pattern: "shot", palette: "leaf", accent: "spark", count: 3, scale: 0.94, duration: 385 });
use("SPIKE CANNON", { motif: "spike", pattern: "shot", palette: "steel", accent: "glint", scale: 1.27, duration: 370 });
use("SWIFT", { motif: "star", pattern: "shot", palette: "gold", count: 5 });
use("EGG BOMB", { motif: "egg", pattern: "arc", palette: "ivory", accent: "flameburst", scale: 1.4 });
use("BARRAGE", { motif: "egg", pattern: "arc", palette: "leaf", accent: "spark", duration: 420 });
use("PRESENT", { motif: "gift", pattern: "arc", palette: "red", scale: 1.4 });
use("ROCK THROW", { motif: "rock", pattern: "arc", palette: "earth", scale: 1.28 });
use("ROCK SLIDE", { motif: "rock", pattern: "fall", palette: "earth", accent: "rock", count: 6 });
use("ROCK SMASH", { motif: "rock", pattern: "hit", palette: "earth", motion: "stomp", accent: "rock", scale: 1.35 });
use("BONE CLUB", { motif: "bone", pattern: "hit", palette: "ivory", motion: "stomp", scale: 1.3 });
use("BONEMERANG", { motif: "bone", pattern: "boomerang", palette: "ivory", duration: 460 });
use("BONE RUSH", { motif: "bone", pattern: "hit", palette: "earth", motion: "dash", duration: 370 });

// Beams, weather and sustained effects have different silhouettes and trajectories.
use("RAZOR WIND", { motif: "slash", pattern: "wave", palette: "steel", count: 4 });
use("GUST", { motif: "wind", pattern: "wave", palette: "teal" });
use("WHIRLWIND", { motif: "wind", pattern: "vortex", palette: "teal", scale: 1.25 });
use("TWISTER", { motif: "wind", pattern: "vortex", palette: "lilac", count: 9 });
use("AEROBLAST", { motif: "wing", pattern: "beam", palette: "teal", scale: 1.7, duration: 680 });
use("BIND", { motif: "coil", pattern: "hit", palette: "earth", scale: 1.8, duration: 540 });
use("WRAP", { motif: "coil", pattern: "tether", palette: "leaf", scale: 1.35 });
use("CONSTRICT", { motif: "coil", pattern: "tether", palette: "lilac", scale: 0.75 });
use("VINE WHIP", { motif: "leaf", pattern: "tether", palette: "leaf", accent: "slash", duration: 440 });
use("SAND-ATTACK", { motif: "cloud", pattern: "arc", palette: "earth", count: 5, scale: 0.75 });
use("MUD-SLAP", { motif: "drop", pattern: "arc", palette: "earth", count: 4, scale: 0.94 });
use("EARTHQUAKE", { motif: "crack", pattern: "ground", palette: "earth", anchor: "field", motion: "shake", scale: 1.45 });
use("FISSURE", { motif: "crack", pattern: "tether", palette: "earth", scale: 1.9, duration: 700 });
use("MAGNITUDE", { motif: "rock", pattern: "ground", palette: "earth", anchor: "field", motion: "shake", duration: 630 });
use("DIG", { motif: "rock", pattern: "burst", palette: "earth", motion: "leap", count: 6 });
use("SPIKES", { motif: "spike", pattern: "ground", palette: "steel", count: 5 });
use("ANCIENTPOWER", { motif: "rock", pattern: "vortex", palette: "gold", count: 5 });

use("EMBER", { motif: "fire", pattern: "shot", palette: "red", count: 4, scale: 0.85 });
use("FLAMETHROWER", { motif: "fire", pattern: "beam", palette: "red", accent: "fire", scale: 1.28 });
use("FIRE BLAST", { motif: "fire", pattern: "inferno", palette: "red", wash: "shadow", count: 5, scale: 1.45, duration: 800 });
use("FIRE SPIN", { motif: "fire", pattern: "vortex", palette: "red", accent: "fire", count: 8 });
use("FLAME WHEEL", { motif: "fire", pattern: "orbit", palette: "red", motion: "spin", accent: "fire", count: 7 });
use("SACRED FIRE", { motif: "fire", pattern: "geyser", palette: "red", accent: "glint", count: 6, scale: 1.48, duration: 660 });
use("SELFDESTRUCT", { motif: "fire", pattern: "burst", palette: "red", anchor: "user", accent: "cloud", wash: "light", count: 12, scale: 1.5 });
use("EXPLOSION", { motif: "flameburst", pattern: "burst", palette: "red", anchor: "user", accent: "ring", wash: "light", count: 14, scale: 2, duration: 720 });
use("DRAGON RAGE", { motif: "dragon", pattern: "shot", palette: "lilac", scale: 1.45 });
use("DRAGONBREATH", { motif: "dragon", pattern: "wave", palette: "teal", count: 5 });
use("OUTRAGE", { motif: "dragon", pattern: "orbit", palette: "red", motion: "shake", count: 4 });

use("WATER GUN", { motif: "drop", pattern: "shot", palette: "blue", count: 5 });
use("HYDRO PUMP", { motif: "drop", pattern: "beam", palette: "blue", accent: "drop", scale: 1.7, duration: 680 });
use("BUBBLE", { motif: "bubble", pattern: "arc", palette: "ice", count: 6 });
use("BUBBLEBEAM", { motif: "bubble", pattern: "beam", palette: "ice", accent: "bubble", scale: 1.1 });
use("SURF", { motif: "drop", pattern: "flood", palette: "blue", anchor: "field", duration: 940 });
use("WATERFALL", { motif: "drop", pattern: "geyser", palette: "blue", motion: "leap", accent: "bubble", count: 8, scale: 1.45, duration: 640 });
use("WHIRLPOOL", { motif: "drop", pattern: "vortex", palette: "blue", count: 12 });
use("OCTAZOOKA", { motif: "cloud", pattern: "shot", palette: "dark", accent: "cloud", scale: 1.65 });
use("ICE BEAM", { motif: "ice", pattern: "beam", palette: "ice", accent: "ice", scale: 1.18 });
use("BLIZZARD", { motif: "ice", pattern: "weather", palette: "ice", anchor: "field", count: 24, duration: 690 });
use("POWDER SNOW", { motif: "ice", pattern: "wave", palette: "ice", count: 5, scale: 0.75 });
use("ICY WIND", { motif: "ice", pattern: "wave", palette: "teal", count: 6 });
use("AURORA BEAM", { motif: "ice", pattern: "spectrum", palette: "ice", scale: 1.22 });

use("THUNDERSHOCK", { motif: "bolt", pattern: "discharge", palette: "gold", duration: 560 });
use("THUNDERBOLT", { motif: "bolt", pattern: "discharge", palette: "gold", count: 3, scale: 1.48, duration: 730 });
use("THUNDER", { motif: "bolt", pattern: "column", palette: "gold", accent: "bolt", wash: "shadow", scale: 1.5, duration: 700 });
use("THUNDER WAVE", { motif: "bolt", pattern: "wave", palette: "gold", accent: "bolt", count: 4, scale: 0.85 });
use("SPARK", { motif: "bolt", pattern: "hit", palette: "gold", motion: "dash", accent: "bolt" });
use("ZAP CANNON", { motif: "orb", pattern: "shot", palette: "teal", accent: "bolt", scale: 1.8, duration: 590 });

use("ABSORB", { motif: "seed", pattern: "link", palette: "leaf", count: 3, scale: 0.8 });
use("MEGA DRAIN", { motif: "orb", pattern: "link", palette: "leaf", count: 4 });
use("GIGA DRAIN", { motif: "orb", pattern: "link", palette: "teal", count: 7, scale: 1.35 });
use("LEECH LIFE", { motif: "heart", pattern: "link", palette: "red", count: 4 });
use("LEECH SEED", { motif: "seed", pattern: "arc", palette: "leaf", accent: "leaf", count: 3 });
use("RAZOR LEAF", { motif: "leaf", pattern: "shot", palette: "leaf", count: 5 });
use("PETAL DANCE", { motif: "petal", pattern: "vortex", palette: "pink", count: 9 });
use("SOLARBEAM", { motif: "sun", pattern: "beam", palette: "gold", accent: "sun", scale: 1.75, duration: 700 });

use("ACID", { motif: "drop", pattern: "arc", palette: "poison", count: 4, scale: 0.8 });
use("TOXIC", { motif: "bubbles", pattern: "rise", palette: "poison", count: 5, scale: 1.25 });
use("SMOG", { motif: "cloud", pattern: "wave", palette: "poison", count: 5, scale: 1.17 });
use("POISON GAS", { motif: "cloud", pattern: "vortex", palette: "poison", count: 8, scale: 1.38 });
use("SLUDGE", { motif: "bubbles", pattern: "arc", palette: "poison", count: 3 });
use("SLUDGE BOMB", { motif: "bubbles", pattern: "arc", palette: "poison", accent: "bubbles", scale: 1.65, duration: 640 });
use("POISONPOWDER", { motif: "glint", pattern: "fall", palette: "poison", accent: "bubbles", count: 10 });
use("STUN SPORE", { motif: "glint", pattern: "fall", palette: "gold", accent: "bolt", count: 10 });
use("SLEEP POWDER", { motif: "glint", pattern: "fall", palette: "teal", accent: "sleep", count: 10 });
use("SPORE", { motif: "seed", pattern: "rise", palette: "leaf", accent: "cloud", count: 7, scale: 0.75 });
use("COTTON SPORE", { motif: "cloud", pattern: "fall", palette: "ivory", count: 6, scale: 0.8 });
use("STRING SHOT", { motif: "thread", pattern: "tether", palette: "ivory", scale: 0.8 });
use("SPIDER WEB", { motif: "web", pattern: "hit", palette: "steel", scale: 1.8, duration: 650 });

use("PSYBEAM", { motif: "orb", pattern: "spectrum", palette: "lilac", scale: 0.82 });
use("HYPER BEAM", { motif: "glint", pattern: "beam", palette: "ivory", accent: "ring", scale: 2.15, duration: 730 });
use("CONFUSION", { motif: "ring", pattern: "orbit", palette: "lilac", count: 4 });
use("PSYCHIC", { motif: "orb", pattern: "burst", palette: "lilac", accent: "ring", wash: "shadow", count: 6, scale: 1.35 });
use("PSYWAVE", { motif: "ring", pattern: "wave", palette: "lilac", count: 5 });
use("NIGHT SHADE", { motif: "moon", pattern: "radiance", palette: "dark", wash: "shadow", scale: 1.1 });
use("DREAM EATER", { motif: "moon", pattern: "link", palette: "dark", wash: "shadow", count: 4 });
use("SHADOW BALL", { motif: "orb", pattern: "shot", palette: "dark", accent: "moon", scale: 1.65, duration: 630 });
use("TRI ATTACK", { motif: "glint", pattern: "triad", palette: "gold", count: 3, scale: 1.3, duration: 730 });
use("HIDDEN POWER", { motif: "orb", pattern: "burst", palette: "steel", count: 6 });
use("FUTURE SIGHT", { motif: "clock", pattern: "fall", palette: "lilac", scale: 1.35 });
use("SONICBOOM", { motif: "wind", pattern: "wave", palette: "ivory", count: 4, scale: 1.27 });
use("SNORE", { motif: "sleep", pattern: "wave", palette: "dark", scale: 0.92 });
use("RAIN DANCE", { motif: "drop", pattern: "weather", palette: "blue", anchor: "field", count: 28 });
use("SUNNY DAY", { motif: "sun", pattern: "weather", palette: "gold", anchor: "field", duration: 670 });
use("SANDSTORM", { motif: "cloud", pattern: "weather", palette: "earth", anchor: "field", count: 22 });

// Debuffs and recovery are staged on the Pokémon affected by them.
use("TAIL WHIP", { motif: "tail", pattern: "hit", palette: "earth", anchor: "user", motion: "shake", scale: 1.4 });
use("LEER", { motif: "eye", pattern: "gesture", palette: "red", accent: "glint", scale: 1.15 });
use("GLARE", { motif: "eye", pattern: "beam", palette: "gold", scale: 0.88 });
use("SCARY FACE", { motif: "eye", pattern: "hit", palette: "dark", wash: "shadow", scale: 1.36 });
use("MEAN LOOK", { motif: "eye", pattern: "shield", palette: "dark", scale: 1.3 });
use("FORESIGHT", { motif: "target", pattern: "wave", palette: "teal", count: 3 });
use("LOCK-ON", { motif: "target", pattern: "hit", palette: "red", scale: 1.5 });
use("MIND READER", { motif: "eye", pattern: "link", palette: "lilac", count: 4 });
use("HYPNOSIS", { motif: "ring", pattern: "vortex", palette: "lilac", count: 7 });
use("CONFUSE RAY", { motif: "orb", pattern: "shot", palette: "dark", accent: "star", scale: 0.72 });
use("NIGHTMARE", { motif: "moon", pattern: "orbit", palette: "dark", count: 5 });
use("DISABLE", { motif: "cross", pattern: "shield", palette: "red" });
use("SPITE", { motif: "moon", pattern: "link", palette: "dark", count: 3, scale: 0.72 });
use("KINESIS", { motif: "mirror", pattern: "wave", palette: "steel", count: 3 });
use("CURSE", { motif: "doll", pattern: "hit", palette: "dark", accent: "spike", wash: "shadow", scale: 1.25 });
use("DESTINY BOND", { motif: "thread", pattern: "tether", palette: "dark", scale: 1.45 });
use("PAIN SPLIT", { motif: "heart", pattern: "boomerang", palette: "pink", scale: 1.12 });
use("FLASH", { motif: "glint", pattern: "burst", palette: "gold", wash: "light", count: 7, scale: 1.95 });
use("SMOKESCREEN", { motif: "orb", pattern: "arc", palette: "dark", accent: "cloud", scale: 1.2 });
use("MIST", { motif: "cloud", pattern: "orbit", palette: "ice", anchor: "user", accent: "glint", count: 6 });
use("HAZE", { motif: "cloud", pattern: "weather", palette: "dark", anchor: "field", count: 22 });
use("SWEET SCENT", { motif: "petal", pattern: "wave", palette: "pink", count: 6 });

use("GROWL", { motif: "ring", pattern: "wave", palette: "ivory", count: 3, scale: 0.76 });
use("ROAR", { motif: "ring", pattern: "wave", palette: "red", count: 5, scale: 1.45 });
use("SCREECH", { motif: "slash", pattern: "wave", palette: "gold", count: 5, scale: 1.2 });
use("SUPERSONIC", { motif: "ring", pattern: "wave", palette: "teal", count: 7 });
use("SING", { motif: "note", pattern: "wave", palette: "pink", accent: "sleep", count: 5, duration: 670 });
use("PERISH SONG", { motif: "note", pattern: "weather", palette: "dark", anchor: "field", count: 15, duration: 730 });
use("HEAL BELL", { motif: "bell", pattern: "gesture", palette: "gold", anchor: "user", accent: "note", count: 4 });
use("ENCORE", { motif: "hand", pattern: "echo", palette: "gold", accent: "star", scale: 1.15 });
use("BELLY DRUM", { motif: "drum", pattern: "gesture", palette: "red", anchor: "user", motion: "hop", accent: "note", count: 3 });
use("LOVELY KISS", { motif: "heart", pattern: "shot", palette: "dark", scale: 1.2 });
use("SWEET KISS", { motif: "heart", pattern: "arc", palette: "pink", count: 3 });
use("ATTRACT", { motif: "heart", pattern: "orbit", palette: "pink", count: 6 });
use("CHARM", { motif: "heart", pattern: "wave", palette: "pink", count: 3, scale: 0.84 });
use("SWAGGER", { motif: "anger", pattern: "hit", palette: "red", motion: "hop", count: 5 });

use("SWORDS DANCE", { motif: "sword", pattern: "orbit", palette: "steel", anchor: "user", count: 4, scale: 1.38 });
use("SHARPEN", { motif: "cross", pattern: "orbit", palette: "steel", anchor: "user", count: 3 });
use("GROWTH", { motif: "leaf", pattern: "rise", palette: "leaf", anchor: "user", count: 5, scale: 1.15 });
use("MEDITATE", { motif: "orb", pattern: "orbit", palette: "lilac", anchor: "user", count: 3 });
use("FOCUS ENERGY", { motif: "glint", pattern: "rise", palette: "gold", anchor: "user", count: 6 });
use("AGILITY", { motif: "arrow", pattern: "rise", palette: "teal", anchor: "user", motion: "duplicate", count: 5 });
use("DOUBLE TEAM", { motif: "glint", pattern: "echo", palette: "steel", anchor: "user", motion: "duplicate" });
use("TELEPORT", { motif: "ring", pattern: "vortex", palette: "lilac", anchor: "user", motion: "launch", count: 8 });
use("MINIMIZE", { motif: "spark", pattern: "orbit", palette: "steel", anchor: "user", motion: "shrink", scale: 0.7 });
use("HARDEN", { motif: "shell", pattern: "shield", palette: "steel", anchor: "user" });
use("WITHDRAW", { motif: "shell", pattern: "shield", palette: "blue", anchor: "user", motion: "shrink" });
use("DEFENSE CURL", { motif: "ring", pattern: "shield", palette: "earth", anchor: "user", motion: "shrink" });
use("ACID ARMOR", { motif: "bubbles", pattern: "rise", palette: "poison", anchor: "user", motion: "fade", count: 6 });
use("BARRIER", { motif: "screen", pattern: "shield", palette: "steel", anchor: "user", scale: 1.25 });
use("LIGHT SCREEN", { motif: "screen", pattern: "shield", palette: "gold", anchor: "user", scale: 1.5 });
use("REFLECT", { motif: "mirror", pattern: "shield", palette: "lilac", anchor: "user", scale: 1.5 });
use("PROTECT", { motif: "dome", pattern: "shield", palette: "teal", anchor: "user", scale: 1.1 });
use("DETECT", { motif: "eye", pattern: "shield", palette: "teal", anchor: "user", motion: "hop" });
use("ENDURE", { motif: "shell", pattern: "shield", palette: "gold", anchor: "user", scale: 1.14 });
use("SAFEGUARD", { motif: "glint", pattern: "vortex", palette: "teal", anchor: "user", count: 9, scale: 1.45 });
use("AMNESIA", { motif: "question", pattern: "rise", palette: "lilac", anchor: "user", count: 3 });
use("PSYCH UP", { motif: "arrow", pattern: "link", palette: "lilac", count: 5 });
use("BIDE", { motif: "orb", pattern: "orbit", palette: "red", anchor: "user", count: 4 });
use("SPLASH", { motif: "drop", pattern: "ground", palette: "ice", anchor: "user", motion: "hop", count: 3, scale: 0.6 });

use("RECOVER", { motif: "plus", pattern: "rise", palette: "leaf", anchor: "user", count: 5 });
use("SOFTBOILED", { motif: "egg", pattern: "rise", palette: "ivory", anchor: "user", accent: "plus" });
use("MILK DRINK", { motif: "bottle", pattern: "rise", palette: "ice", anchor: "user", accent: "plus" });
use("REST", { motif: "sleep", pattern: "rise", palette: "dark", anchor: "user", accent: "plus", count: 3, duration: 650 });
use("MORNING SUN", { motif: "sun", pattern: "radiance", palette: "gold", anchor: "user", wash: "light", count: 5, scale: 1.3, duration: 650 });
use("SYNTHESIS", { motif: "leaf", pattern: "orbit", palette: "leaf", anchor: "user", accent: "plus", count: 6, scale: 1.4 });
use("MOONLIGHT", { motif: "moon", pattern: "radiance", palette: "lilac", anchor: "user", wash: "shadow", count: 4, scale: 1.1, duration: 700 });

use("METRONOME", { motif: "hand", pattern: "gesture", palette: "gold", anchor: "user", accent: "glint", count: 3 });
use("MIMIC", { motif: "mirror", pattern: "link", palette: "steel", count: 3 });
use("MIRROR MOVE", { motif: "mirror", pattern: "echo", palette: "teal", anchor: "user" });
use("MIRROR COAT", { motif: "mirror", pattern: "beam", palette: "lilac", scale: 1.18 });
use("TRANSFORM", { motif: "orb", pattern: "burst", palette: "pink", anchor: "user", motion: "fade", count: 7 });
use("CONVERSION", { motif: "glint", pattern: "orbit", palette: "teal", anchor: "user", count: 8, scale: 1.25, duration: 560 });
use("CONVERSION2", { motif: "glint", pattern: "link", palette: "lilac", count: 8, scale: 1.1 });
use("SUBSTITUTE", { motif: "doll", pattern: "hit", palette: "leaf", anchor: "user", scale: 1.75 });
use("SKETCH", { motif: "brush", pattern: "link", palette: "ivory", count: 4 });
use("SLEEP TALK", { motif: "sleep", pattern: "rise", palette: "dark", anchor: "user", accent: "note", count: 3 });
use("BATON PASS", { motif: "baton", pattern: "rise", palette: "gold", anchor: "user", motion: "fade" });

const chargeVisuals = new Map<string, MoveVisual>([
  ["DIG", { motif: "rock", pattern: "ground", palette: "earth", anchor: "user", motion: "dig", count: 4 }],
  ["FLY", { motif: "wing", pattern: "rise", palette: "teal", anchor: "user", motion: "launch", count: 3 }],
  ["SKY ATTACK", { motif: "wing", pattern: "orbit", palette: "gold", anchor: "user", count: 5 }],
  ["SKULL BASH", { motif: "shell", pattern: "shield", palette: "earth", anchor: "user" }],
  ["SOLARBEAM", { motif: "sun", pattern: "orbit", palette: "gold", anchor: "user", count: 5 }],
  ["RAZOR WIND", { motif: "wind", pattern: "vortex", palette: "teal", anchor: "user" }],
  ["JUMP KICK", { motif: "spark", pattern: "ground", palette: "earth", anchor: "user", motion: "stomp" }],
  ["HI JUMP KICK", { motif: "spark", pattern: "ground", palette: "earth", anchor: "user", motion: "stomp" }],
  ["CURSE", { motif: "arrow", pattern: "rise", palette: "dark", anchor: "user", count: 5 }],
  ["BIDE", { motif: "orb", pattern: "beam", palette: "red", scale: 1.5 }],
  ["SUBSTITUTE", { motif: "doll", pattern: "fall", palette: "leaf", anchor: "user", duration: 225 }],
]);

export function findMoveVisual(name: string, param = 0): MoveVisual | undefined {
  const key = name.trim().toUpperCase();
  const variation = param === 1 ? chargeVisuals.get(key) : undefined;
  if (variation) return variation;
  if (key === "PRESENT" && param === 3)
    return { motif: "plus", pattern: "rise", palette: "leaf", count: 4 };
  if (key === "SUBSTITUTE" && param === 2)
    return { motif: "doll", pattern: "rise", palette: "leaf", anchor: "user", duration: 225 };
  return moves.get(key);
}

// Crystal's non-move animation IDs after send-out and recall.
const conditions: Record<number, MoveVisual> = {
  259: { motif: "star", pattern: "orbit", palette: "gold", count: 4 },
  260: { motif: "sleep", pattern: "rise", palette: "dark", count: 3 },
  261: { motif: "fire", pattern: "rise", palette: "red", count: 4 },
  262: { motif: "bubbles", pattern: "rise", palette: "poison", count: 4 },
  263: { motif: "orb", pattern: "link", palette: "leaf", anchor: "target", count: 3 },
  264: { motif: "ice", pattern: "shield", palette: "ice" },
  265: { motif: "bolt", pattern: "burst", palette: "gold", count: 5, motion: "shake" },
  266: { motif: "heart", pattern: "orbit", palette: "pink", count: 4 },
  267: { motif: "cloud", pattern: "wave", palette: "earth", anchor: "user" },
  268: { motif: "moon", pattern: "orbit", palette: "dark", count: 4 },
  269: { motif: "drop", pattern: "vortex", palette: "blue", count: 7 },
  270: { motif: "wind", pattern: "hit", palette: "steel", motion: "dash" },
  271: { motif: "spark", pattern: "hit", palette: "ivory" },
  272: { motif: "arrow", pattern: "fall", palette: "steel" },
  273: { motif: "arrow", pattern: "fall", palette: "steel" },
  274: { motif: "spark", pattern: "hit", palette: "ivory" },
  275: { motif: "wind", pattern: "orbit", palette: "teal", motion: "shake" },
  276: { motif: "crack", pattern: "ground", palette: "earth", motion: "shake" },
  277: { motif: "spark", pattern: "hit", palette: "gold", motion: "recoil" },
};

export function nativeConditionVisual(id: number): MoveVisual | undefined {
  const visual = conditions[id];
  return visual && { anchor: "user", duration: 330, ...visual };
}

export const healingSparkle: MoveVisual = {
  motif: "plus", pattern: "rise", palette: "leaf", anchor: "user", count: 4, duration: 470,
};
