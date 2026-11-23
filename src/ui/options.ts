/**
 * Which way an option row was changed: left steps back, right and A step on.
 * The menu input marks a row before it clicks it.
 */
export function optionStep(button: HTMLElement): 1 | -1 {
  const back = button.dataset.step === "-1";
  delete button.dataset.step;
  return back ? -1 : 1;
}

/** The value `step` places from `current` among `count` values numbered from `first`, coming round at the ends. */
export function cycleOption(current: number, step: number, count: number, first = 0) {
  return ((current - first + step) % count + count) % count + first;
}
