import type { Action } from "../game/input";

export type MenuControl = Extract<Action, "up" | "down" | "left" | "right" | "a">;
type Controller = { input: (action: MenuControl) => void };
const controllers = new WeakMap<Element, Controller>();
const dismissHandlers = new WeakMap<Element, () => void>();

export function setMenuDismiss(panel: HTMLElement, dismiss: () => void) {
  dismissHandlers.set(panel, dismiss);
}

export function dismissMenu(layer: HTMLElement) {
  const panel = layer.querySelector(":scope > .overlay > .panel");
  if (panel) dismissHandlers.get(panel)?.();
}

/**
 * Gives a screen the D-pad and A outright, as a Game Boy screen has them:
 * the pad drives the screen itself, not a cursor that walks over its buttons.
 */
export function setMenuController(root: HTMLElement, input: (action: MenuControl) => void) {
  root.dataset.menuController = "";
  controllers.set(root, { input });
}

/** The controller of the topmost screen that has one. */
export function menuController(layer: HTMLElement) {
  const roots = layer.querySelectorAll("[data-menu-controller]");
  const root = roots[roots.length - 1] ?? (layer.matches("[data-menu-controller]") ? layer : undefined);
  return root && controllers.get(root);
}
