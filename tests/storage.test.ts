import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { freshSave } from "../src/game/save";
import { get, set, JourneyConflict, JourneyStore } from "../src/game/storage";

beforeEach(() => { vi.stubGlobal("indexedDB", new IDBFactory()); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("preserves a legacy save when two windows race to update it", async () => {
  const original = freshSave();
  await set("save", original);
  const windows = [new JourneyStore(), new JourneyStore()];
  expect(await Promise.all(windows.map(w => w.read()))).toEqual([original, original]);
  const updates = [100, 250].map(steps => ({ ...original, steps }));
  const results = await Promise.allSettled(windows.map((w, i) => w.write(updates[i])));
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  const loser = results.findIndex(r => r.status === "rejected");
  expect(results[loser]).toMatchObject({ reason: expect.any(JourneyConflict) });
  expect(await get("save")).toEqual(updates[1 - loser]);
  await expect(windows[loser].write(original)).rejects.toBeInstanceOf(JourneyConflict);
  expect(await windows[loser].read()).toEqual(updates[1 - loser]);
  await windows[loser].write(original);
  expect(await get("save")).toEqual(original);
});

it("commits snapshots in input order even when the active journey keeps changing", async () => {
  const window = new JourneyStore(), save = freshSave();
  const opened = window.read();
  const first = window.write(save);
  save.x = 8.5;
  const second = window.write(save);
  save.x = 9.5;
  expect(await opened).toBeUndefined();
  await Promise.all([first, second]);
  expect(await get("save")).toEqual({ ...save, x: 8.5 });
});

it("leaves the revision alone when an idle window autosaves an unchanged journey", async () => {
  const original = freshSave(), idle = new JourneyStore(), active = new JourneyStore();
  await set("save", original);
  await Promise.all([idle.read(), active.read()]);
  expect(await idle.write(original, true)).toBe(false);
  expect(await get("save-revision")).toBeUndefined();
  const travelled = { ...original, steps: 42 };
  await active.write(travelled);
  expect(await idle.write(original, true)).toBe(false);
  expect(await get("save")).toEqual(travelled);
  await expect(idle.write({ ...original, steps: 5 }, true)).rejects.toBeInstanceOf(JourneyConflict);
});

it("rolls the revision back with an aborted write and allows a retry", async () => {
  const window = new JourneyStore(), save = freshSave();
  await window.read();
  await window.write(save);
  const revision = await get("save-revision");
  const put = IDBObjectStore.prototype.put;
  const abort = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function(value, key) {
    const request = put.call(this, value, key);
    if (key === "save") this.transaction.abort();
    return request;
  });
  const next = { ...save, steps: 200 };
  await expect(window.write(next)).rejects.toMatchObject({ name: "AbortError" });
  expect(await get("save")).toEqual(save);
  expect(await get("save-revision")).toEqual(revision);
  abort.mockRestore();
  await window.write(next);
  expect(await get("save")).toEqual(next);
  expect(await get("save-revision")).not.toEqual(revision);
});
