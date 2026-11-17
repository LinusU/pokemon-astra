import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { runInNewContext } from "node:vm";

const run = promisify(execFile);
const generator = resolve("scripts/build-service-worker.mjs");
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((p) => rm(p, { recursive: true, force: true })),
  );
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "astra-offline-"));
  roots.push(root);
  await mkdir(join(root, "dist/assets"), { recursive: true });
  for (const [name, value] of Object.entries({
    "index.html": "shell",
    "assets/game-abc.js": "script",
    "assets/game-abc.css": "style",
    "astra_native.wasm": "wasm-v1",
  }))
    await writeFile(join(root, "dist", name), value);
  return root;
}
async function generate(root: string) {
  await run(process.execPath, [generator], { cwd: root });
  return readFile(join(root, "dist/sw.js"), "utf8");
}

describe("offline app cache", () => {
  it("installs the whole build and serves shell, scripts, styles and WASM without network", async () => {
    const root = await fixture(),
      source = await generate(root);
    const handlers: Record<string, Function> = {},
      data = new Map<string, string>();
    const cache = {
      async addAll(requests: Request[]) {
        for (const request of requests) {
          expect(request.cache).toBe("reload");
          const url = request.url;
          data.set(
            url,
            await readFile(
              join(root, "dist", new URL(url).pathname.slice("/game/".length)),
              "utf8",
            ),
          );
        }
      },
      async match(url: string) {
        return data.get(url);
      },
      async put(url: string, value: string) {
        data.set(url, value);
      },
    };
    let claimed = false,
      skipped = false,
      networkCalls = 0;
    const caches = {
      async open() {
        return cache;
      },
      async keys() {
        return ["astra-v1", "unrelated"];
      },
      async delete(key: string) {
        expect(key).toBe("astra-v1");
        return true;
      },
    };
    runInNewContext(source, {
      URL,
      Request,
      caches,
      fetch: () => {
        networkCalls++;
        throw Error("offline");
      },
      self: {
        location: { href: "https://example.test/game/sw.js" },
        addEventListener(name: string, handler: Function) {
          handlers[name] = handler;
        },
        async skipWaiting() {
          skipped = true;
        },
        clients: {
          async claim() {
            claimed = true;
          },
        },
      },
    });
    const lifecycle = async (name: string) => {
      let pending: Promise<unknown> | undefined;
      handlers[name]({
        waitUntil(p: Promise<unknown>) {
          pending = p;
        },
      });
      await pending;
    };
    await lifecycle("install");
    await lifecycle("activate");
    expect(skipped && claimed).toBe(true);
    const fetchRequest = async (path: string, mode = "same-origin") => {
      let response: Promise<string> | undefined;
      handlers.fetch({
        request: {
          url: `https://example.test/game/${path}`,
          method: "GET",
          mode,
        },
        respondWith(p: Promise<string>) {
          response = p;
        },
      });
      return response;
    };
    expect(await fetchRequest("", "navigate")).toBe("shell");
    expect(await fetchRequest("assets/game-abc.js")).toBe("script");
    expect(await fetchRequest("assets/game-abc.css")).toBe("style");
    expect(await fetchRequest("astra_native.wasm")).toBe("wasm-v1");
    expect(await fetchRequest("user.gbc")).toBeUndefined();
    expect(await fetchRequest("unknown.dat")).toBeUndefined();
    expect(networkCalls).toBe(0);
  });
  it("changes cache version when a build asset changes and rejects cartridge files", async () => {
    const root = await fixture(),
      first = await generate(root);
    await writeFile(join(root, "dist/astra_native.wasm"), "wasm-v2");
    const second = await generate(root);
    expect(first.match(/pokemon-astra-[a-f0-9]+/)?.[0]).not.toBe(
      second.match(/pokemon-astra-[a-f0-9]+/)?.[0],
    );
    await writeFile(join(root, "dist/private.GBC"), "cartridge");
    await expect(generate(root)).rejects.toThrow();
  });
});
