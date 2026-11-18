import { trackMenuCursor } from "./menu-cursor";
import { Input, type Action } from "../game/input";
export function createShell(input: Input) {
  document.querySelector<HTMLDivElement>("#app")!.innerHTML =
    `<main class="shell"><header class="topbar"><div class="brand"><i>✦</i><span>POKÉMON ASTRA</span></div><button class="sound-toggle" id="sound-toggle" aria-label="Toggle game sound" aria-pressed="true">♫ Enable sound</button></header><div class="device"><div class="screen"><canvas width="320" height="240" aria-label="Pokémon Astra game screen"></canvas><div id="layer"></div></div></div><div class="statusbar"><span>✦ &nbsp; THE ASTRA REGION</span><span>ARROWS / WASD &nbsp; · &nbsp; Z CONFIRM &nbsp; · &nbsp; X BACK &nbsp; · &nbsp; M MENU</span></div><div class="controls" aria-label="Touch controls"><div class="dpad"><button class="touch up" data-action="up" aria-label="Up">▲</button><button class="touch left" data-action="left" aria-label="Left">◀</button><button class="touch right" data-action="right" aria-label="Right">▶</button><button class="touch down" data-action="down" aria-label="Down">▼</button></div><button class="touch round button-b" data-action="b" aria-label="B, Back">B</button><button class="touch round button-a" data-action="a" aria-label="A, Confirm">A</button><button class="touch button-menu" data-action="menu">MENU</button></div></main>`;
  document
    .querySelectorAll<HTMLElement>("[data-action]")
    .forEach((el) => input.bind(el, el.dataset.action as Action));
  return {
    canvas: document.querySelector<HTMLCanvasElement>("canvas")!,
    layer: document.querySelector<HTMLElement>("#layer")!,
  };
}
export type PanelCursor = { key?: string; scrollTop?: number };

export function panel(
  layer: HTMLElement,
  title: string,
  body: string,
  klass = "",
  cursor?: PanelCursor,
) {
  layer.innerHTML = `<div class="overlay"><section class="panel ${klass}" role="dialog" aria-labelledby="panel-title"><div class="eyebrow">✦ &nbsp; Pokémon Astra</div><h2 id="panel-title">${escapeHtml(title)}</h2>${body}</section></div>`;
  const menu = layer.querySelector<HTMLElement>(".panel")!;
  const key = (button: HTMLButtonElement) => button.id || button.textContent;
  trackMenuCursor(menu, button => {
    if (cursor) {
      cursor.key = key(button) ?? undefined;
      cursor.scrollTop = menu.scrollTop;
    }
  });
  if (cursor?.key) {
    const previous = Array.from(menu.querySelectorAll<HTMLButtonElement>("button:enabled"))
      .find(button => key(button) === cursor.key);
    if (previous) {
      menu.scrollTop = cursor.scrollTop ?? 0;
      previous.focus({ preventScroll: true });
      const row = previous.getBoundingClientRect(), viewport = menu.getBoundingClientRect();
      if (row.bottom > viewport.bottom) menu.scrollTop += row.bottom - viewport.bottom;
      else if (row.top < viewport.top) menu.scrollTop -= viewport.top - row.top;
    }
  }
  return menu;
}
export function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
