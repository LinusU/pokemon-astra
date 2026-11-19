import { describe, expect, it, vi } from "vitest";
import type { Action } from "../src/game/input";
import { MenuInput } from "../src/ui/menu-input";

function panel(
  layout: number[][],
  height = 120,
  battle = false,
  journey = false,
  party = false,
) {
  const ownerDocument = { activeElement: null as unknown };
  let cursor: unknown;
  const rect = (left: number, top: number, right: number, bottom: number) => ({
    left,
    right,
    top,
    bottom,
  });
  const scroller = {
    scrollTop: 0,
    clientHeight: height,
    getBoundingClientRect: () => rect(0, 0, 200, height),
    querySelectorAll: () => buttons,
    querySelector: (selector: string) => {
      if (selector === '[aria-current="true"]') return cursor;
      return selector === "button:not(:disabled)" ? buttons[0] : journey ? {} : null;
    },
  };
  const buttons = layout.map(([left, top, width, buttonHeight]) => {
    const button = {
      dataset: {} as DOMStringMap,
      getBoundingClientRect: () =>
        rect(
          left,
          top - scroller.scrollTop,
          left + width,
          top + buttonHeight - scroller.scrollTop,
        ),
      focus: vi.fn((_: FocusOptions) => {
        ownerDocument.activeElement = button;
        cursor = button;
      }),
      click: vi.fn(),
    };
    return button;
  });
  if (party) buttons[0]?.focus({ preventScroll: true });
  const layer = {
    firstElementChild: {},
    ownerDocument,
    querySelector: (selector: string) =>
      selector === "[data-bag]" || (selector === ".party-screen" && !party) ? null : scroller,
  } as unknown as HTMLElement;
  const menu = new MenuInput();
  const update = (now: number, pressed?: Action, held = pressed) =>
    menu.update(
      layer,
      { hit: (a) => a === pressed, held: (a) => a === held },
      now,
      battle,
    );
  return { update, buttons, scroller, ownerDocument };
}

describe("menu input", () => {
  it("turns map entries with left and right, repeating while the D-pad is held", () => {
    const { update, buttons } = panel([[0, 80, 25, 25], [175, 80, 25, 25]]);
    buttons[0].dataset.mapStep = "-1";
    buttons[1].dataset.mapStep = "1";
    update(0);
    update(10, "right");
    expect(buttons[1].click).toHaveBeenCalledTimes(1);
    update(310, undefined, "right");
    expect(buttons[1].click).toHaveBeenCalledTimes(2);
    update(320, "left");
    expect(buttons[0].click).toHaveBeenCalledOnce();
  });

  it("moves down a column, across a row and confirms the selected button", () => {
    const { update, buttons, ownerDocument } = panel([
      [0, 6, 88, 26],
      [96, 6, 88, 26],
      [0, 38, 88, 26],
      [96, 38, 88, 26],
      [0, 70, 88, 26],
      [96, 70, 88, 26],
    ]);
    update(0);
    expect(ownerDocument.activeElement).toBe(buttons[0]);
    update(10, "down");
    expect(ownerDocument.activeElement).toBe(buttons[2]);
    update(30, "right");
    expect(ownerDocument.activeElement).toBe(buttons[3]);
    update(50, "up");
    expect(ownerDocument.activeElement).toBe(buttons[1]);
    update(70, "a");
    expect(buttons[1].click).toHaveBeenCalledOnce();
  });

  it.each([false, true])("uses the marked grid choice after focus leaves (battle %s)", battle => {
    const { update, buttons, ownerDocument } = panel(
      [[0, 0, 88, 26], [96, 0, 88, 26], [0, 38, 88, 26], [96, 38, 88, 26]],
      120, battle,
    );
    update(0);
    update(10, "right");
    ownerDocument.activeElement = null;
    update(20, "down");
    expect(ownerDocument.activeElement).toBe(buttons[3]);
    ownerDocument.activeElement = null;
    update(30, "a");
    expect(buttons[3].click).toHaveBeenCalledOnce();
  });

  it("focuses the first battle option on a submenu redraw", () => {
    const { update, buttons, ownerDocument } = panel(
      [
        [0, 6, 88, 26],
        [0, 38, 88, 26],
        [0, 70, 88, 26],
      ],
      120,
      true,
    );
    update(0);
    expect(ownerDocument.activeElement).toBe(buttons[0]);
    buttons.shift();
    update(20);
    expect(ownerDocument.activeElement).toBe(buttons[0]);
    update(30, "a");
    expect(buttons[0].click).toHaveBeenCalledOnce();
  });

  it("repeats down the battle roster and stops at its last available slot", () => {
    const { update, buttons, scroller, ownerDocument } = panel(
      [[0, 2, 190, 18], [0, 42, 190, 18], [0, 102, 190, 18]],
      120, true, false, true,
    );
    update(0);
    update(10, "down");
    expect(ownerDocument.activeElement).toBe(buttons[1]);
    update(320, undefined, "down");
    expect(ownerDocument.activeElement).toBe(buttons[2]);
    update(430, undefined, "down");
    expect(scroller.scrollTop).toBe(0);
    update(440, "a");
    expect(buttons[2].click).toHaveBeenCalledOnce();
  });

  it.each([false, true])("keeps the party cursor after focus leaves (battle %s)", (battle) => {
    const { update, buttons, ownerDocument } = panel(
      [[0, 2, 190, 18], [0, 42, 190, 18], [0, 82, 190, 18]],
      120, battle, false, true,
    );
    update(0);
    update(10, "down");
    ownerDocument.activeElement = null;
    update(20, "down");
    expect(ownerDocument.activeElement).toBe(buttons[2]);
    ownerDocument.activeElement = null;
    update(30, "a");
    expect(buttons[2].click).toHaveBeenCalledOnce();
    expect(buttons[0].click).not.toHaveBeenCalled();
  });

  it("scrolls text before reaching Back and repeats only while a direction is held", () => {
    const { update, buttons, scroller, ownerDocument } = panel([
      [0, 270, 88, 26],
    ]);
    update(0);
    update(10, "a");
    expect(ownerDocument.activeElement).toBeNull();
    expect(buttons[0].click).not.toHaveBeenCalled();
    update(20, "down");
    const firstStep = scroller.scrollTop;
    expect(firstStep).toBeGreaterThan(0);
    update(100, undefined, "down");
    expect(scroller.scrollTop).toBe(firstStep);
    update(350, undefined, "down");
    expect(scroller.scrollTop).toBeGreaterThan(firstStep);
    update(360, "up");
    expect(scroller.scrollTop).toBeCloseTo(firstStep);
    expect(buttons[0].focus).not.toHaveBeenCalled();
  });

  it("highlights a newly revealed action in a scrolling text panel", () => {
    const { update, buttons, ownerDocument } = panel([[0, 135, 88, 26]]);
    update(0);
    expect(ownerDocument.activeElement).toBeNull();
    update(10, "down");
    expect(ownerDocument.activeElement).toBe(buttons[0]);
  });

  it("reveals the remembered selection before confirming after manual scrolling", () => {
    const { update, buttons, scroller, ownerDocument } = panel([[0, 6, 88, 26], [0, 200, 88, 26]]);
    update(0);
    scroller.scrollTop = 160;
    ownerDocument.activeElement = null;
    update(10, "a");
    expect(ownerDocument.activeElement).toBe(buttons[0]);
    expect(buttons[1].click).not.toHaveBeenCalled();
    update(20, "a");
    expect(buttons[0].click).toHaveBeenCalledOnce();
  });

  it("reveals the first Journey action when the header fills a compact panel", () => {
    const { update, buttons, scroller, ownerDocument } = panel(
      [
        [0, 150, 88, 26],
        [96, 150, 88, 26],
        [0, 184, 88, 26],
      ],
      120,
      false,
      true,
    );
    update(0);
    expect(scroller.scrollTop).toBe(56);
    expect(ownerDocument.activeElement).toBe(buttons[0]);
    update(10, "down");
    expect(ownerDocument.activeElement).toBe(buttons[2]);
  });

  it("keeps battle commands spatial and does not repeat or scroll single-button prompts", () => {
    const battle = panel(
      [
        [0, 6, 88, 26],
        [96, 6, 88, 26],
        [0, 38, 88, 26],
        [96, 38, 88, 26],
        [0, 70, 88, 26],
        [96, 70, 88, 26],
      ],
      70,
      true,
    );
    battle.update(0, "down");
    expect(battle.ownerDocument.activeElement).toBe(battle.buttons[2]);
    battle.update(400, undefined, "down");
    expect(battle.ownerDocument.activeElement).toBe(battle.buttons[2]);
    const prompt = panel([[5, 6, 80, 24]], 30, true);
    prompt.update(0, "up");
    expect(prompt.scroller.scrollTop).toBe(0);
    expect(prompt.buttons[0].focus).not.toHaveBeenCalled();
    prompt.update(10, "a");
    expect(prompt.buttons[0].click).toHaveBeenCalledOnce();
  });
});
