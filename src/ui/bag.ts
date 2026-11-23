import { ballSprite } from "./ball-sprite";
import { trackMenuCursor } from "./menu-cursor";
import type { Action } from "../game/input";
import { giveFromBag } from "../game/items";
import { MEDICINE } from "../game/medicine";
import { escapeHtml } from "./shell";
import "./bag.css";

const pocketLabels = { items: "Items", balls: "Poké Balls", key: "Key Items", tms: "TM/HM" };
export type BagPocket = keyof typeof pocketLabels;
export type BagState = { pocket?: BagPocket; selected?: Partial<Record<BagPocket, string>> };
export type BagItem = {
  key: string;
  name: string;
  count: number;
  pocket?: BagPocket;
  description?: string;
  action?: string;
  unavailable?: string;
};
type ItemInfo = Pick<BagItem, "pocket" | "description" | "action"> & {
  name?: string;
};
type BagOptions = {
  items: BagItem[];
  state: BagState;
  pockets?: BagPocket[];
  /** Ask "Use / Cancel" before onUse; off when the caller shows its own item submenu. */
  confirm?: boolean;
  onUse: (item: BagItem) => void;
  onCancel: () => void;
};

const descriptions: Record<string, string> = {
  repel: "Prevents tall-grass encounters for 100 walking tiles.",
  rare_lure: "Attracts a rarer local Pokémon on your next grass encounter.",
  friendship_charm: "Raises a Pokémon’s friendship.",
  link_cable:
    "Evolves Pokémon that usually evolve by trading. Some need a held item.",
  exp_share:
    "A Pokémon holding it earns experience even if it sits out the battle.",
  metal_coat:
    "A metal coating that helps certain Pokémon evolve with a Link Cable.",
  dragon_scale: "A scale that helps Seadra evolve with a Link Cable.",
  kings_rock:
    "A crown-like stone that helps certain Pokémon evolve with a Link Cable.",
  up_grade: "A device that helps Porygon evolve with a Link Cable.",
  poke_ball: "A ball for catching wild Pokémon.",
  great_ball: "A ball with a better catch rate than a Poké Ball.",
  ultra_ball: "A ball with a better catch rate than a Great Ball.",
  master_ball: "A ball that catches any wild Pokémon without fail.",
  aurora_certificate:
    "Professor Alder’s award for recording every species in Astra.",
  courier_parcel: "A sealed delivery from Mossford. Take it to the courier in Bramble.",
};
const names: Record<string, string> = {
  master_ball: "Master Ball",
  ultra_ball: "Ultra Ball",
  great_ball: "Great Ball",
  poke_ball: "Poké Ball",
};
const battleKeys: Record<number, string> = {
  1: "master_ball",
  2: "ultra_ball",
  4: "great_ball",
  5: "poke_ball",
};
for (const [key, { id, name, description }] of Object.entries(MEDICINE)) {
  battleKeys[id] = key;
  names[key] = name;
  descriptions[key] = description;
}

export function battleBagKey(id: number) {
  return battleKeys[id] ?? `item_${id}`;
}

export function itemInfo(key: string): ItemInfo {
  if (key === "nursery_egg")
    return { name: "Nursery Egg", pocket: "key", description: "A warm Egg tucked into a woven reed sling. Walk to help it hatch.", action: "Check" };
  if (key === "courier_parcel")
    return { name: "Courier’s Parcel", pocket: "key", description: descriptions[key], action: "Inspect" };
  if (key === "aurora_certificate")
    return { pocket: "key", description: descriptions[key], action: "Read" };
  if (Object.hasOwn(descriptions, key) && key.endsWith("_ball"))
    return {
      name: names[key],
      pocket: "balls",
      description: descriptions[key],
      action: "Throw",
    };
  return {
    name: Object.hasOwn(names, key) ? names[key] : undefined,
    pocket: "items",
    description: Object.hasOwn(descriptions, key)
      ? descriptions[key]
      : key.endsWith("_stone")
        ? "Evolves certain Pokémon. Check their evolution details in your party."
        : undefined,
    action: giveFromBag(key) ? "Give" : "Use",
  };
}

type BagControl = Extract<Action, "up" | "down" | "left" | "right" | "a">;
type BagController = {
  input: (action: BagControl) => void;
  back: () => void;
  destroy: () => void;
};
const controllers = new WeakMap<HTMLElement, BagController>();

export function bagController(layer: HTMLElement) {
  const bag = layer.querySelector<HTMLElement>("[data-bag]");
  return bag ? controllers.get(bag) : undefined;
}

export function mountBag(
  host: HTMLElement,
  options: BagOptions,
): BagController {
  const { state, onUse, onCancel } = options;
  const pockets: BagPocket[] = options.pockets?.length
    ? options.pockets
    : ["items", "balls", "key"];
  const items = options.items
    .filter(({ count }) => count > 0)
    .map((item) => {
      const info = itemInfo(item.key);
      return {
        ...item,
        pocket: item.pocket ?? info.pocket,
        description: item.description ?? info.description,
        action: item.action ?? info.action,
      };
    });
  const bag = host.ownerDocument.createElement("section");
  bag.className = "astra-bag";
  bag.dataset.bag = "";
  bag.setAttribute("role", "dialog");
  bag.setAttribute("aria-label", "Bag");
  bag.tabIndex = -1;
  host.append(bag);

  if (!state.pocket || !pockets.includes(state.pocket))
    state.pocket = pockets[0];
  const byPocket = state.selected ??= {};
  trackMenuCursor(bag);
  let shown: BagItem[];
  let choosing = false;
  const selected = () => shown.find((item) => item.key === byPocket[state.pocket!]);
  const button = (selector: string) =>
    bag.querySelector<HTMLButtonElement>(selector);
  const focus = (target?: HTMLElement | null) =>
    (target ?? bag).focus({ preventScroll: true });

  function select(key: string | undefined, moveFocus: boolean) {
    byPocket[state.pocket!] = key;
    const item = selected();
    if (state.pocket === "balls") {
      bag.querySelector(".astra-bag-icon")!.innerHTML = (item && ballSprite(item.key)) || "<i></i>";
    }
    let active: HTMLButtonElement | undefined;
    for (const row of bag.querySelectorAll<HTMLButtonElement>(
      "[data-bag-item]",
    )) {
      const current = row.dataset.bagItem === key;
      row.toggleAttribute("data-selected", current);
      if (current) active = row;
    }
    const description = bag.querySelector<HTMLElement>(
      ".astra-bag-description",
    )!;
    description.textContent =
      item?.description ?? (item ? "" : "This pocket is empty.");
    const availability = bag.querySelector<HTMLElement>(
      ".astra-bag-unavailable",
    )!;
    availability.textContent = item?.unavailable ?? "";
    availability.hidden = !item?.unavailable;
    if (moveFocus) {
      focus(active ?? button("[data-bag-cancel]"));
      if (active) {
        const list = active.parentElement!;
        const viewport = list.getBoundingClientRect();
        const row = active.getBoundingClientRect();
        const top = viewport.top + list.clientTop;
        const bottom = top + list.clientHeight;
        if (row.top < top) list.scrollTop -= top - row.top;
        else if (row.bottom > bottom) list.scrollTop += row.bottom - bottom;
      }
    }
  }

  function render() {
    const pocket = state.pocket!;
    bag.dataset.pocket = pocket;
    shown = items.filter((item) => item.pocket === pocket);
    bag.innerHTML = `
      <header><h2>Bag</h2><button type="button" data-bag-cancel>Back</button></header>
      <nav aria-label="Pockets">${pockets.map((name) => `<button type="button" data-pocket-tab="${name}" aria-pressed="${name === pocket}">${pocketLabels[name]}</button>`).join("")}</nav>
      <div class="astra-bag-inventory">
        <div class="astra-bag-icon" aria-hidden="true"><i></i></div>
        <div class="astra-bag-rows" aria-label="${pocketLabels[pocket]}">${shown.map(({ key, name, count }) => `<button type="button" data-bag-item="${escapeHtml(key)}"><span>${pocket === "balls" ? ballSprite(key) : ""}${escapeHtml(name)}</span><span class="astra-bag-count">×${count}</span></button>`).join("")}</div>
      </div>
      <div class="astra-bag-details" aria-live="polite"><p class="astra-bag-description"></p><p class="astra-bag-unavailable" hidden></p></div>`;
    button("[data-bag-cancel]")!.onclick = back;
    for (const tab of bag.querySelectorAll<HTMLButtonElement>(
      "[data-pocket-tab]",
    )) {
      tab.onclick = () => changePocket(tab.dataset.pocketTab as BagPocket);
    }
    for (const row of bag.querySelectorAll<HTMLButtonElement>(
      "[data-bag-item]",
    )) {
      row.onfocus = () => select(row.dataset.bagItem, false);
      row.onclick = () => {
        select(row.dataset.bagItem, false);
        chooseItem();
      };
    }
    select(selected()?.key ?? shown[0]?.key, true);
  }

  function changePocket(pocket: BagPocket) {
    state.pocket = pocket;
    render();
  }

  function chooseItem() {
    const item = selected();
    if (!item) return;
    if (options.confirm === false) {
      if (!item.unavailable) onUse(item);
      return;
    }
    choosing = true;
    const actions = bag.ownerDocument.createElement("div");
    actions.className = "astra-bag-actions";
    actions.innerHTML = `
      <button type="button" data-bag-use ${item.unavailable ? "disabled" : ""}>${escapeHtml(item.action ?? "Use")}</button>
      <button type="button" data-bag-action-cancel>Cancel</button>`;
    bag.querySelector(".astra-bag-inventory")!.append(actions);
    // Keep the current item visible while the action menu has focus.
    for (const element of bag.querySelectorAll<HTMLElement>(
      "nav, .astra-bag-rows",
    )) {
      element.inert = true;
    }
    const use = button("[data-bag-use]")!;
    const cancel = button("[data-bag-action-cancel]")!;
    use.onclick = () => {
      choosing = false;
      onUse(item);
      if (actions.isConnected) render();
    };
    cancel.onclick = back;
    focus(use.disabled ? cancel : use);
  }

  function back() {
    if (choosing) {
      choosing = false;
      render();
    } else onCancel();
  }

  function input(action: BagControl) {
    if (action === "a") {
      button('button[aria-current="true"]:enabled')?.click();
      return;
    }
    if (choosing) {
      if (action === "up") {
        focus(
          button("[data-bag-use]:enabled") ??
            button("[data-bag-action-cancel]"),
        );
      } else if (action === "down") {
        focus(button("[data-bag-action-cancel]"));
      }
      return;
    }
    if (action === "left" || action === "right") {
      const next =
        pockets.indexOf(state.pocket!) + (action === "left" ? -1 : 1);
      changePocket(pockets[(next + pockets.length) % pockets.length]);
    } else {
      const index = shown.findIndex((item) => item.key === byPocket[state.pocket!]);
      const next = index + (action === "up" ? -1 : 1);
      if (shown[next]) select(shown[next].key, true);
    }
  }

  const controller = { input, back, destroy: () => bag.remove() };
  controllers.set(bag, controller);
  render();
  return controller;
}
