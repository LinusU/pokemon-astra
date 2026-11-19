/** navigator.serviceWorker.ready never rejects after a failed first install. */
export function waitForActivation(registration: ServiceWorkerRegistration) {
  const worker = registration.active ?? registration.waiting ?? registration.installing;
  return new Promise<void>((resolve, reject) => {
    if (!worker) {
      reject(Error("Offline installation did not start"));
      return;
    }
    const changed = () => {
      if (worker.state !== "activated" && worker.state !== "redundant") return;
      worker.removeEventListener("statechange", changed);
      if (worker.state === "activated") resolve();
      else reject(Error("Offline installation did not finish"));
    };
    worker.addEventListener("statechange", changed);
    changed();
  });
}

export async function removeDevelopmentWorker(workers: ServiceWorkerContainer, scope: string) {
  const registration = await workers.getRegistration(scope);
  if (registration?.scope === scope) await registration.unregister();
}

const labels = {
  preparing: "Saving for offline play…",
  failed: "Offline setup failed",
  ready: "✓ Offline ready",
  updated: "Update ready · reload to play",
};
type State = keyof typeof labels;

export function setupOfflinePlay(workers: ServiceWorkerContainer, script: URL, status: HTMLElement) {
  const controller = workers.controller;
  let state: State;
  let option: HTMLButtonElement | undefined;
  status.id = "offline-status";
  status.setAttribute("role", "status");
  function drawOption() {
    if (!option) return;
    option.hidden = state !== "failed" && !option.hasAttribute("data-attempted");
    option.disabled = state !== "failed";
    option.textContent = state === "failed" ? "Retry offline setup" : labels[state];
  }
  function show(next: State) {
    state = next;
    status.textContent = labels[next];
    if (next === "failed") {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "Retry";
      retry.setAttribute("aria-label", "Retry offline setup");
      retry.onclick = setup;
      status.append(" · ", retry);
    }
    drawOption();
  }
  async function setup() {
    if (state === "preparing") return;
    show("preparing");
    try {
      const registration = await workers.register(script, { updateViaCache: "none" });
      if (controller?.scriptURL === script.href) void registration.update().catch(() => {});
      await waitForActivation(registration);
      if (state !== "updated") show("ready");
    } catch (error) {
      if (state !== "updated") show("failed");
      console.warn("Offline setup failed", error);
    }
  }
  workers.addEventListener("controllerchange", () => {
    if (controller?.scriptURL === script.href && workers.controller?.scriptURL === script.href &&
        controller !== workers.controller) show("updated");
  });
  void setup();
  return {
    bindOptions(panel: HTMLElement) {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.id = "retry-offline";
      retry.onclick = () => {
        retry.setAttribute("data-attempted", "");
        void setup();
      };
      panel.querySelector(".save-tools .buttons")!.append(retry);
      option = retry;
      drawOption();
    },
  };
}
