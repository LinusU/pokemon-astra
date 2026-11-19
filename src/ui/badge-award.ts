import { ABILITIES, BADGES } from "../world";
import { badgeArt } from "./journal";
import { escapeHtml } from "./shell";
import "./badge-award.css";

export function showBadgeAward(
  layer: HTMLElement, number: number, mask: number, keeper: string, message: string, done: () => void,
) {
  const index = number - 1;
  const ability = ABILITIES[index];
  const name = ability === "rockSmash" ? "Rock Smash" : ability[0].toUpperCase() + ability.slice(1);
  const count = BADGES.filter((_, i) => mask & (1 << i)).length;
  layer.innerHTML = `<section class="badge-award" role="dialog" aria-labelledby="earned-badge">
    <header><span>Beacon Journal</span><span>${count} / ${BADGES.length} badges</span></header>
    <div class="award-setting">
      <div class="award-mount">${badgeArt(index)}</div>
      <div class="award-heading"><h1 id="earned-badge">${BADGES[index]} Badge</h1><p>${name} unlocked</p></div>
    </div>
    <blockquote><cite>${escapeHtml(keeper)}</cite>${escapeHtml(message)}</blockquote>
    <footer><div class="award-case" aria-hidden="true">${BADGES.map((_, i) =>
      `<span class="${mask & (1 << i) ? "earned" : ""}">${badgeArt(i)}</span>`).join("")}</div>
      <button>Continue ▸</button></footer>
  </section>`;
  const button = layer.querySelector<HTMLButtonElement>("button")!;
  button.addEventListener("click", done, { once: true });
  button.focus({ preventScroll: true });
}
