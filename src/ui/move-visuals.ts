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
  | "question" | "arrow" | "doll" | "baton" | "hand" | "thread" | "glint";
type Pattern =
  | "hit" | "shot" | "arc" | "beam" | "orbit" | "fall" | "rise" | "ground"
  | "wave" | "weather" | "link";
type Anchor = "target" | "user" | "field" | "opponentSide";
type Motion = "dash" | "leap" | "spin" | "stomp" | "hop" | "fade" | "recoil" | "shake";

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
use("BONEMERANG", { motif: "bone", pattern: "arc", palette: "ivory", count: 1 });
use("BONE RUSH", { motif: "bone", pattern: "hit", palette: "earth", motion: "dash", duration: 370 });

export function findMoveVisual(name: string) {
  return moves.get(name.trim().toUpperCase());
}
