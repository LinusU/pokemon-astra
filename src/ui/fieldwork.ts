import type { FieldDevice } from "../world/expeditions";
import { panel, escapeHtml } from "./shell";

interface Instrument {
  instructions: string;
  buttons: string[];
  display(): string;
  use(key: number): boolean;
  status: string;
  revealed?(key: number): boolean;
}
const bells = ["Harbor", "Street", "Roof"];
const targets = [0, 2, 1];

/** Each instrument holds only its current attempt. Leaving or retrying cannot spend a reward. */
export function instrument(
  device: Exclude<FieldDevice, "promise" | "atlas">,
  ring: (pitch: number) => void,
): Instrument {
  let x = 0,
    y = 3,
    progress = 0;
  const uncovered = new Set<number>();
  const end = (line: string) => '<div class="instrument-reading">' + escapeHtml(line) + "</div>";
  switch (device) {
    case "breaker":
      return {
        instructions:
          "The clinic lamps and canal pumps must stay live. Isolate the stolen load. The night meter is in the loft above the alley.",
        buttons: ["Clinic", "Foundry", "Canal pumps"],
        status: "Three circuits live.",
        display: () => end("CLINIC ▮▮　 FOUNDRY ▮▮▮▮▮　 PUMP ▮"),
        use(key) {
          this.status =
            key === 0
              ? "The clinic alarm sounds. The safety trip restores its lights."
              : "The intake pressure falls. The safety trip restarts the pumps.";
          return key === 1;
        },
      };
    case "carillon":
      return {
        instructions: "Ring the old watch peal. The choir stalls describe its journey.",
        buttons: bells,
        status: "The ropes are still.",
        display: () =>
          end(Array.from({ length: 3 }, (_, i) => (i < progress ? bells[targets[i]] : "○")).join("  ·  ")),
        use(key) {
          ring(key);
          if (key !== targets[progress]) {
            progress = key === targets[0] ? 1 : 0;
            this.status = "That cadence fades. The watch climbs from harbor to roof, then halfway home.";
          } else {
            progress++;
            this.status = bells[key] + " rings true.";
          }
          return progress === targets.length;
        },
      };
    case "telescope":
      return {
        instructions:
          "Center the double star. Each wheel moves one notch and wraps around.",
        buttons: ["Turn azimuth →", "Turn altitude ↑"],
        status: "The brass wheels turn independently.",
        display: () =>
          '<div class="scope-grid" role="img" aria-label="Star column ' +
          (x + 1) +
          ", row " +
          (y + 1) +
          '. Target column 3, row 3.">' +
          Array.from(
            { length: 25 },
            (_, i) => "<i>" + (i === y * 5 + x ? "✦" : i === 12 ? "⊹" : i % 3 === 0 ? "·" : "") + "</i>",
          ).join("") +
          "</div>",
        use(key) {
          if (key === 0) x = (x + 1) % 5;
          else y = (y + 4) % 5;
          this.status = "Star at column " + (x + 1) + ", row " + (y + 1) + ".";
          return x === 2 && y === 2;
        },
      };
    case "float":
      return {
        instructions:
          "Ease the line out with the tide. A nibble tips the float. A bite pulls it under. Lift when the fish has the hook.",
        buttons: ["Feed slack", "Lift rod"],
        status: "The red tip rides high.",
        display: () => '<div class="float-pool" aria-hidden="true" data-dip="' + progress + '"><i></i></div>',
        use(key) {
          if (key === 1 && progress === 2) return true;
          if (key === 1) {
            progress = 0;
            this.status = "An empty hook. The angler baits it again.";
          } else {
            progress = (progress + 1) % 3;
            this.status = [
              "The fish let go. A new cast settles.",
              "One light nibble. The float is still showing.",
              "The red tip disappears. The line pulls tight!",
            ][progress];
          }
          return false;
        },
      };
    case "fossil": {
      const strata = ["·", "≋", "·", "≋", "·", "·", "·", "≋", "·"];
      return {
        instructions: "Brush the three ribbed patches of the chalk face. Smooth chalk crumbles away.",
        buttons: strata.map((texture, i) => texture + " " + (i + 1)),
        status: "≋ marks a shell impression.",
        display: () => end(uncovered.size + " / 3 impressions exposed"),
        revealed: (key) => uncovered.has(key),
        use(key) {
          if (strata[key] === "≋") {
            uncovered.add(key);
            this.status = "A fan of shell ribs shows through the chalk.";
          } else this.status = "Only fine chalk here. Try a rippled patch.";
          return uncovered.size === 3;
        },
      };
    }
    case "forge":
      return {
        instructions:
          "Pump the bellows until the ore glows amber, hammer it into the coupling mould, then quench the shaped metal.",
        buttons: ["Bellows", "Hammer", "Quench"],
        status: "The coupling blank is cold.",
        display: () => end(["Cold iron", "Red heat ▰", "Amber heat ▰▰", "Shaped coupling ◯"][progress]),
        use(key) {
          if (key === 0) {
            progress = progress < 2 ? progress + 1 : 1;
            this.status =
              progress === 2
                ? "Amber. The metal yields under the tongs."
                : "Red. Scale flakes from the surface.";
          }
          if (key === 1) {
            if (progress === 2) {
              progress = 3;
              this.status = "The smith turns the newly shaped eye toward the water trough.";
            } else this.status = "The blank needs amber heat before it will take the mould.";
          }
          if (key === 2) {
            if (progress === 3) return true;
            progress = 0;
            this.status = "Steam clears. The blank is cold again.";
          }
          return false;
        },
      };
  }
}

export function openFieldwork(
  layer: HTMLElement,
  title: string,
  device: FieldDevice,
  complete: (choice?: string) => void,
  leave: () => void,
  ring: (pitch: number) => void,
) {
  const choice = device === "promise" || device === "atlas";
  const model = choice ? undefined : instrument(device, ring);
  const labels =
    model?.buttons ??
    (device === "promise"
      ? ["Fire Stone", "Water Stone", "Thunder Stone"]
      : ["Dawn meadow", "Moon pool", "Ember nursery"]);
  const intro =
    model?.instructions ??
    (device === "promise"
      ? "Robin opens Eevee’s travel case. Choose a stone to take along with Eevee."
      : "The atlas is ready for binding. Which habitat should a new researcher see on the opening spread?");
  const p = panel(
    layer,
    title,
    "<p>" +
      escapeHtml(intro) +
      '</p><div class="field-display"></div><p class="field-status small" role="status"></p><div data-menu-start class="field-keys ' +
      (device === "fossil" ? "dig-grid" : "") +
      '">' +
      labels.map((label, i) => '<button data-key="' + i + '">' + escapeHtml(label) + "</button>").join("") +
      '</div><button class="secondary" id="back">Leave</button>',
    "fieldwork " + device,
  );
  const refresh = () => {
    p.querySelector<HTMLElement>(".field-display")!.innerHTML = model?.display() ?? "";
    p.querySelector<HTMLElement>(".field-status")!.textContent = model?.status ?? "";
    if (model?.revealed) {
      p.querySelectorAll<HTMLButtonElement>("[data-key]").forEach((button, i) => {
        if (model.revealed!(i)) {
          button.dataset.exposed = "true";
          button.textContent = "✓ " + (i + 1);
          button.setAttribute("aria-label", "Shell impression " + (i + 1) + " exposed");
        }
      });
    }
  };
  refresh();
  p.querySelector<HTMLElement>("#back")!.onclick = leave;
  p.querySelectorAll<HTMLButtonElement>("[data-key]").forEach((button, i) => {
    button.onclick = () => {
      if (!model) complete(labels[i].toLowerCase().replaceAll(" ", "_"));
      else if (model.use(i)) complete();
      else refresh();
    };
  });
}
