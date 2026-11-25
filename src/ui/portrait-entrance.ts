import type { EntranceMotion, PortraitEntrance } from "../emerald/portraits";

const poses: Record<EntranceMotion, Keyframe[]> = {
  hop: [{ translate: "0 0" }, { translate: "0 -7%" }, { translate: "0 0" }, { translate: "0 -3%" }, { translate: "0 0" }],
  sway: [{ translate: "0 0" }, { translate: "4% -3%" }, { translate: "-3% -2%" }, { translate: "0 0" }],
  shake: [{ translate: "0" }, { translate: "4%" }, { translate: "-4%" }, { translate: "2%" }, { translate: "-2%" }, { translate: "0" }],
  stretch: [{ scale: "1" }, { scale: "1.05 0.94" }, { scale: "0.98 1.08" }, { scale: "1" }],
};

export function playPortraitEntrance(image: HTMLImageElement, entrance: PortraitEntrance, speed: number, done: () => void) {
  const resting = image.src;
  if ("motion" in entrance) {
    const animation = image.animate(poses[entrance.motion], { duration: 420 / speed });
    animation.onfinish = done;
    return () => animation.cancel();
  }

  const { frames } = entrance;
  const started = performance.now();
  let request = requestAnimationFrame(update);
  function update(now: number) {
    let elapsed = (now - started) * speed;
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
