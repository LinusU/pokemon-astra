import { ballIds } from "../game/items";
import type { CaptureSoundState } from "../engine/battle-sound";
import { ballSprite } from "./ball-sprite";
import "./capture.css";

// BattleAnim_ThrowPokeBall resumes one frame after each anim_wait counter expires.
export function captureTiming(ball: number, { wobbles, caught }: CaptureSoundState) {
  const master = ball === ballIds.master_ball;
  const absorb = master ? 144 : 71;
  const drop = absorb + 26;
  const bounce = drop + 33;
  const firstCheck = bounce + 33 * 3 + 9 + 49;
  const result = firstCheck + wobbles * 49;
  return { absorb, drop, bounce, firstCheck, result, end: result + (caught ? 0 : 36) };
}

type Pose = [frame: number, properties: Keyframe];

export function playCapture(
  field: HTMLElement, ball: number, outcome: CaptureSoundState, speed: number,
  sound: (duration: number) => void, finish: () => void,
) {
  const timing = captureTiming(ball, outcome);
  const ms = (1000 / 59.7275) / Math.max(0.25, speed);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const prop = document.createElement("div");
  prop.className = "capture-prop";
  const shell = ballSprite(ball) || ballSprite(ballIds.poke_ball);
  prop.innerHTML = `<div class="capture-ball">${shell}<i class="capture-core"></i>${shell}</div>`;
  field.append(prop);
  const body = prop.querySelector<HTMLElement>(".capture-ball")!;
  const lid = body.firstElementChild!;
  const enemy = field.querySelector<HTMLImageElement>(".battle-enemy img")!;
  const animations: Animation[] = [];
  // Absolute frame positions keep the sprite, target and cartridge audio on one clock.
  function animate(element: Element, poses: Pose[], iterations = 1) {
    const start = poses[0][0], length = poses[poses.length - 1][0] - start;
    const frames = poses.map(([frame, pose]) => ({ ...pose, offset: (frame - start) / length }));
    const animation = element.animate(frames, {
      delay: start * ms, duration: length * ms, iterations, fill: "both",
    });
    animations.push(animation);
    return animation;
  }

  // Field coordinates are percentages so the throw still lands on the enemy platform after rotation.
  const ground = 54, contact = 36;
  const trajectory: Pose[] = [];
  for (let frame = 0; frame <= 36; frame += 3) {
    const t = frame / 36;
    trajectory.push([frame, {
      left: `${reduced ? 78 : 23 + 55 * t}%`,
      top: `${reduced ? contact : 83 + (contact - 83) * t - 88 * t * (1 - t)}%`,
    }]);
  }
  trajectory.push([timing.drop, { left: "78%", top: `${contact}%`, easing: "ease-in" }]);
  // The landing sound marks first contact. Each of the three rebounds loses four pixels of lift.
  trajectory.push([timing.bounce, { left: "78%", top: `${ground}%` }]);
  if (!reduced) {
    for (const [index, height] of [12, 8, 4].entries()) {
      for (let step = 1; step <= 8; step++) {
        trajectory.push([timing.bounce + index * 32 + step * 4, {
          left: "78%", top: `${ground - height * Math.sin(step * Math.PI / 8)}%`,
        }]);
      }
    }
    animate(body, [[0, { rotate: "-270deg" }], [36, { rotate: "0deg" }]]);
  }
  animate(prop, trajectory);
  const open: Pose[] = [[36, { transform: "none" }], [52, { transform: "translateY(-58%) rotate(-12deg)" }],
    [timing.absorb + 9, { transform: "translateY(-58%) rotate(-12deg)" }], [timing.drop, { transform: "none" }]];
  if (!outcome.caught) open.push([timing.result, { transform: "none" }], [timing.result + 5, { transform: "translateY(-65%) rotate(-15deg)" }]);
  animate(lid, open);
  const glow: Pose[] = [[36, { opacity: 0 }], [52, { opacity: 0.9 }],
    [timing.absorb + 9, { opacity: 0.9 }], [timing.drop, { opacity: 0 }]];
  if (!outcome.caught) glow.push([timing.result, { opacity: 0 }],
    [timing.result + 4, { opacity: 1 }], [timing.result + 13, { opacity: 0 }]);
  animate(body.querySelector(".capture-core")!, glow);
  const visible = { opacity: 1, filter: "none", transform: "none" };
  const inside = { opacity: 0, filter: "brightness(0) invert(1)", transform: reduced ? "none" : "scale(0.05)" };
  const target: Pose[] = [[timing.absorb, visible], [timing.absorb + 5, { ...visible, filter: inside.filter }],
    [timing.drop, inside]];
  if (!outcome.caught) target.push([timing.result + 3, inside], [timing.end - 6, visible]);
  animate(enemy, target);

  function burst(start: number, length: number, radius: number, color: string) {
    if (reduced) return;
    for (let i = 0; i < 8; i++) {
      const spark = document.createElement("i");
      spark.className = "capture-spark";
      spark.style.background = i % 2 ? color : "#fff8dc";
      prop.append(spark);
      const angle = i * Math.PI / 4;
      const travel = (r: number) => `translate(${Math.cos(angle) * r}%, ${Math.sin(angle) * r}%)`;
      animate(spark, [[start, { opacity: 0, transform: travel(160) }],
        [start + 3, { opacity: 1, transform: travel(240) }],
        [start + length, { opacity: 0, transform: travel(radius) + " scale(0.35)" }]]);
    }
  }
  burst(54, 16, 750, "#ffc785");
  if (ball === ballIds.master_ball) burst(79, 56, 1250, "#ff9cde");

  if (outcome.wobbles > 0) {
    const check = timing.firstCheck;
    // Frameset_PokeBall5 holds center, left, center, right, center for eight frames each.
    const pose = (angle: number) => ({ transform: `rotate(${angle}deg)`, easing: "steps(1, end)" });
    const tilt = reduced ? 6 : 22;
    animate(body, [[check, pose(0)], [check + 8, pose(-tilt)], [check + 16, pose(0)],
      [check + 24, pose(tilt)], [check + 32, pose(0)], [check + 49, pose(0)]], outcome.wobbles);
  }

  if (!outcome.caught) {
    burst(timing.result, 25, 940, "#ffbc81");
    animate(body, [[timing.result + 4, { opacity: 1 }], [timing.result + 13, { opacity: 0 }]]);
  }
  const duration = timing.end * ms;
  sound(duration);
  const timer = window.setTimeout(() => {
    if (outcome.caught) {
      // Keep the latched ball on the platform under the catch message.
      prop.classList.add("secured");
      field.classList.add("capture-secured");
    }
    finish();
  }, duration);
  return () => {
    clearTimeout(timer);
    for (const animation of animations) animation.cancel();
    prop.remove();
    field.classList.remove("capture-secured");
  };
}
