import { typeNames } from "../game/type-names";
import { escapeHtml, panel } from "./shell";

type Specimen = {
  id: number;
  name: string;
  types: number[];
  image: string;
  category: string;
  description: string;
};

export function specimenCard(layer: HTMLElement, heading: string, mon: Specimen, detail: string,
  action: string, confirm: () => void, { back, grant }: { back?: () => void; grant?: number } = {}) {
  const types = [...new Set(mon.types)].map(type => typeNames[type]).join(" / ");
  const card = panel(layer, heading, `
    <div class="specimen-body">
      <div class="specimen-plate">
        <span>#${String(mon.id).padStart(3, "0")}</span>
        <img src="${mon.image}" alt="">
        <small>${types}</small>
      </div>
      <div class="specimen-notes">
        <h3>${escapeHtml(mon.name)}</h3>
        <small>${escapeHtml(mon.category)} Pokémon</small>
        <p>${escapeHtml(mon.description)}</p>
      </div>
    </div>
    <p class="specimen-detail">${escapeHtml(detail)}</p>
    <div class="buttons"><button id="specimen-confirm">${escapeHtml(action)}</button>${back ? '<button class="secondary" id="back">Meet the others</button>' : ""}
      ${grant === undefined ? "" : `<small class="specimen-grant">${grant ? "Survey grant +₽" + grant : "Wallet full"}</small>`}</div>`, "specimen-card");
  const button = card.querySelector<HTMLButtonElement>("#specimen-confirm")!;
  button.onclick = confirm;
  button.focus({ preventScroll: true });
  if (back) card.querySelector<HTMLButtonElement>("#back")!.onclick = back;
}
