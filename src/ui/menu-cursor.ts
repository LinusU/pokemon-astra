/** Keep the game cursor when a tap or another window takes DOM focus. */
export function trackMenuCursor(menu: HTMLElement, onSelect?: (button: HTMLButtonElement) => void) {
  menu.addEventListener("focusin", event => {
    const button = event.target;
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;
    menu.querySelector('[aria-current="true"]')?.removeAttribute("aria-current");
    button.setAttribute("aria-current", "true");
    onSelect?.(button);
  });
  // Some browsers activate tapped buttons without focusing them.
  menu.addEventListener("click", event => {
    if (event.detail && event.target instanceof Element)
      event.target.closest<HTMLButtonElement>("button:enabled")?.focus({ preventScroll: true });
  }, true);
}
