import type { MoveVisual } from "./move-visuals";

type Motion = NonNullable<MoveVisual["motion"]>;
type MotionFrames = (x: number, y: number) => Keyframe[];

const front: Record<Motion, MotionFrames> = {
  dash: (x, y) => [{ transform: "translate(0)" }, { transform: `translate(${x}px, ${y}px)`, offset: 0.36 }, { transform: "translate(0)" }],
  leap: (x, y) => [{ transform: "translate(0)" }, { transform: `translate(${x}px, ${y - 18}px)`, offset: 0.38 }, { transform: "translate(0)" }],
  spin: (x, y) => [{ transform: "translate(0)" }, { transform: `translate(${x / 2}px, ${y / 2}px) rotate(180deg)` }, { transform: "rotate(360deg)" }],
  stomp: (x, y) => [{ transform: "translate(0)" }, { transform: "translateY(-10px)", offset: 0.2 }, { transform: `translate(${x}px, ${y}px) scaleY(.92)`, offset: 0.45 }, { transform: "translate(0)" }],
  hop: () => [{ transform: "translateY(0)" }, { transform: "translateY(-14px)", offset: 0.4 }, { transform: "translateY(0)" }],
  fade: (x, y) => [{ opacity: 1 }, { opacity: 0.22, transform: `translate(${x}px, ${y}px)`, offset: 0.48 }, { opacity: 1 }],
  recoil: (x, y) => [{ transform: "translate(0)" }, { transform: `translate(${x}px, ${y}px)`, offset: 0.34 },
    { transform: `translate(${-x / 3}px, ${-y / 3}px)`, offset: 0.66 }, { transform: "translate(0)" }],
  shake: () => [{ transform: "translateX(0)" }, { transform: "translateX(-5px)" }, { transform: "translateX(5px)" },
    { transform: "translateX(-4px)" }, { transform: "translateX(0)" }],
  dig: () => [{ transform: "translateY(0)" }, { transform: "translateY(22px)", opacity: 0.12, offset: 0.64 },
    { transform: "translateY(22px)", opacity: 0.12 }],
  launch: () => [{ transform: "translateY(0)" }, { transform: "translateY(-52px)", opacity: 0.14, offset: 0.65 },
    { transform: "translateY(-52px)", opacity: 0.14 }],
  shrink: () => [{ transform: "scale(1)" }, { transform: "scale(.52)", offset: 0.5 }, { transform: "scale(1)" }],
  duplicate: () => [{ transform: "translateX(0)" }, { transform: "translateX(-9px)" },
    { transform: "translateX(9px)" }, { transform: "translateX(0)" }],
};

// A back sprite ends at the dialogue box. Keep its bottom row level or below its
// resting position on every frame, including anticipation and recoil.
const back: Record<Motion, MotionFrames> = {
  dash: (x) => front.dash(x, 0),
  leap: (x) => [
    { transform: "translate(0)" },
    { transform: "translateY(7px) scaleY(.94)", offset: .18 },
    { transform: `translateX(${x}px)`, offset: .41 },
    { transform: "translate(0)" },
  ],
  spin: (x) => [
    { transform: "translateX(0) scaleX(1)" },
    { transform: `translateX(${x * .45}px) scaleX(.32)`, offset: .29 },
    { transform: `translateX(${x}px) scaleX(1)`, offset: .54 },
    { transform: "translateX(0) scaleX(1)" },
  ],
  stomp: (x) => [
    { transform: "translate(0)" },
    { transform: `translate(${x}px, 11px) scaleY(.91)`, offset: .43 },
    { transform: "translate(0)" },
  ],
  hop: () => [{ transform: "translateY(0)" }, { transform: "translateY(10px)" }, { transform: "translateY(0)" }],
  fade: (x) => front.fade(x, 0),
  recoil: (x) => front.recoil(x, 0),
  shake: front.shake,
  dig: front.dig,
  launch: () => [
    { transform: "translateY(0)", opacity: 1 },
    { transform: "translateY(6px) scaleX(.65)", opacity: .1, offset: .65 },
    { transform: "translateY(6px) scaleX(.65)", opacity: .1 },
  ],
  shrink: front.shrink,
  duplicate: front.duplicate,
};

export function moveSpriteFrames(motion: Motion, x: number, y: number, backSprite: boolean) {
  return (backSprite ? back : front)[motion](x, y);
}
