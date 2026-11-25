import type { EntranceMotion, PortraitEntrance } from "../emerald/portraits";

// The back art ends at the dialogue box. Vertical motion keeps the cut
// edge below that boundary, and scaling pivots around the sprite's base.
const backPoses: Record<EntranceMotion, Keyframe[]> = {
  hop: [{ translate: "0 0" }, { translate: "0 7%" }, { translate: "0 0" }, { translate: "0 3%" }, { translate: "0 0" }],
  sway: [{ translate: "0 0" }, { translate: "4% 3%" }, { translate: "-3% 2%" }, { translate: "0 0" }],
  shake: [{ translate: "0" }, { translate: "4%" }, { translate: "-4%" }, { translate: "2%" }, { translate: "-2%" }, { translate: "0" }],
  stretch: [{ scale: "1" }, { scale: "1.05 0.94" }, { scale: "0.98 1.08" }, { scale: "1" }],
};

const frontSway: Keyframe[] = [
  { translate: "0 0" }, { translate: "4% -3%" }, { translate: "-3% -2%" }, { translate: "0 0" },
];
const FRONT_POSE_LIMIT_MS = 400;

export function playPortraitEntrance(image: HTMLImageElement, entrance: PortraitEntrance, back: boolean, speed: number, done: () => void) {
  const resting = image.src;
  if ("motion" in entrance) {
    const poses = back ? backPoses[entrance.motion] : frontSway;
    const animation = image.animate(poses, { duration: (back ? 420 : 260) / speed });
    animation.onfinish = done;
    return () => animation.cancel();
  }

  const { frames } = entrance;
  const duration = frames.reduce((total, frame) => total + frame.duration, 0);
  // Preserve each species' pose order and relative timing within a short entrance.
  const playbackRate = speed * Math.max(1.5, duration / FRONT_POSE_LIMIT_MS);
  const started = performance.now();
  let request = requestAnimationFrame(update);
  function update(now: number) {
    let elapsed = (now - started) * playbackRate;
    for (const frame of frames) {
      if (elapsed < frame.duration) {
        if (image.src !== frame.image) image.src = frame.image;
        request = requestAnimationFrame(update);
        return;
      }
      elapsed -= frame.duration;
    }
    image.src = resting;
    done();
  }
  return () => {
    cancelAnimationFrame(request);
    image.src = resting;
  };
}
