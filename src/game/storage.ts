export type AdventureId = "astra" | "yellow" | "yellow-legacy" | "crystal" | "crystal-legacy";
export const ADVENTURES: AdventureId[] = ["astra", "yellow", "yellow-legacy", "crystal", "crystal-legacy"];
/** What the journey list shows without opening the save itself. */
export interface JourneySummary {
  place: string;
  badges: number;
  caught: number;
  lead?: { species: number; dvs: number[] };
  player?: string;
}
export interface JourneyEntry {
  id: string;
  adventure: AdventureId;
  created: number;
  updated: number;
  summary?: JourneySummary;
}
type Summarize = (save: any) => JourneySummary | undefined;

const DB = "pokemon-astra";
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("data");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => () => T): Promise<T> {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction("data", mode);
      tx.onabort = () => reject(tx.error ?? new DOMException("Transaction aborted", "AbortError"));
      const result = action(tx.objectStore("data"));
      tx.oncomplete = () => resolve(result());
    });
  } finally {
    db.close();
  }
}
export function get<T>(key: string): Promise<T | undefined> {
  return transact("readonly", store => {
    const request = store.get(key);
    return () => request.result;
  });
}
export async function set(key: string, value: unknown): Promise<void> {
  await transact("readwrite", store => {
    store.put(value, key);
    return () => undefined;
  });
}

export class JourneyConflict extends Error {
  constructor() { super("Another window saved a newer journey. Open Options to keep a copy of this session or load the browser save."); }
}

const INDEX = "journeys";
const LEGACY_SAVE = "save", LEGACY_REVISION = "save-revision";
const saveKey = (id: string) => `journey:${id}`;
const revisionKey = (id: string) => `journey-revision:${id}`;
const isEntry = (e: any): e is JourneyEntry =>
  !!e && typeof e.id === "string" && ADVENTURES.includes(e.adventure) &&
  typeof e.created === "number" && typeof e.updated === "number";

/**
 * Every journey lives under its own key. The single save written by earlier
 * versions becomes the first Astra journey the first time the list is read.
 */
export function listJourneys(summarize?: (adventure: AdventureId, save: unknown) => JourneySummary | undefined): Promise<JourneyEntry[]> {
  return transact("readwrite", store => {
    let list: JourneyEntry[] = [];
    const index = store.get(INDEX);
    index.onsuccess = () => {
      if (Array.isArray(index.result)) {
        list = index.result.filter(isEntry);
        return;
      }
      const legacy = store.get(LEGACY_SAVE), revision = store.get(LEGACY_REVISION);
      revision.onsuccess = () => {
        if (legacy.result !== undefined) {
          const now = Date.now(), id = crypto.randomUUID();
          let summary: JourneySummary | undefined;
          try { summary = summarize?.("astra", legacy.result); } catch { summary = undefined; }
          list = [{ id, adventure: "astra", created: now, updated: now, ...(summary && { summary }) }];
          store.put(legacy.result, saveKey(id));
          store.put(revision.result ?? crypto.randomUUID(), revisionKey(id));
        }
        store.put(list, INDEX);
      };
    };
    return () => [...list].sort((a, b) => b.updated - a.updated);
  });
}

export async function createJourney(adventure: AdventureId, save: unknown, summary?: JourneySummary): Promise<string> {
  const id = crypto.randomUUID(), now = Date.now();
  await listJourneys();
  await transact("readwrite", store => {
    const index = store.get(INDEX);
    index.onsuccess = () => {
      const list: JourneyEntry[] = Array.isArray(index.result) ? index.result.filter(isEntry) : [];
      list.push({ id, adventure, created: now, updated: now, ...(summary && { summary }) });
      store.put(list, INDEX);
      store.put(structuredClone(save), saveKey(id));
      store.put(crypto.randomUUID(), revisionKey(id));
    };
    return () => undefined;
  });
  return id;
}

export async function deleteJourney(id: string): Promise<void> {
  await transact("readwrite", store => {
    const index = store.get(INDEX);
    index.onsuccess = () => {
      const list: JourneyEntry[] = Array.isArray(index.result) ? index.result.filter(isEntry) : [];
      store.put(list.filter(e => e.id !== id), INDEX);
      store.delete(saveKey(id));
      store.delete(revisionKey(id));
    };
    return () => undefined;
  });
}

/** Reads a journey without claiming it for writing, for previews and exports. */
export function peekJourney(id: string): Promise<unknown> {
  return get(saveKey(id));
}

/** Each open game writes from the revision it actually loaded. */
export class JourneyStore {
  private revision: string | null | undefined;
  private lastSnapshot?: string;
  private pending: Promise<void> = Promise.resolve();
  private readonly saveKey: string;
  private readonly revisionKey: string;

  /** Without an id the store uses the single save of earlier versions. */
  constructor(readonly id?: string, private summarize?: Summarize) {
    this.saveKey = id ? saveKey(id) : LEGACY_SAVE;
    this.revisionKey = id ? revisionKey(id) : LEGACY_REVISION;
  }

  private enqueue<T>(action: () => Promise<T>): Promise<T> {
    const work = this.pending.then(action);
    this.pending = work.then(() => {}, () => {});
    return work;
  }

  read(): Promise<unknown> {
    return this.enqueue(async () => {
      this.revision = undefined;
      const record = await transact("readonly", store => {
        const revision = store.get(this.revisionKey);
        const save = store.get(this.saveKey);
        return () => ({ revision: revision.result ?? null, save: save.result });
      });
      this.revision = record.revision;
      // Recovery also accepts damaged IndexedDB records which may not be JSON.
      try { this.lastSnapshot = JSON.stringify(record.save); }
      catch { this.lastSnapshot = undefined; }
      return record.save;
    });
  }

  write(save: unknown, skipUnchanged = false): Promise<boolean> {
    const snapshot = structuredClone(save);
    return this.enqueue(async () => {
      if (this.revision === undefined) throw Error("Read the browser save before writing.");
      const serialized = JSON.stringify(snapshot);
      if (skipUnchanged && serialized === this.lastSnapshot) return false;
      const expected = this.revision;
      const next = crypto.randomUUID();
      let summary: JourneySummary | undefined;
      try { summary = this.summarize?.(snapshot); } catch { summary = undefined; }
      const committed = await transact("readwrite", store => {
        const check = store.get(this.revisionKey);
        check.onsuccess = () => {
          if ((check.result ?? null) !== expected) return;
          store.put(next, this.revisionKey);
          store.put(snapshot, this.saveKey);
          if (!this.id) return;
          const index = store.get(INDEX);
          index.onsuccess = () => {
            const list: JourneyEntry[] = Array.isArray(index.result) ? index.result.filter(isEntry) : [];
            const entry = list.find(e => e.id === this.id);
            if (!entry) return;
            entry.updated = Date.now();
            if (summary) entry.summary = summary;
            store.put(list, INDEX);
          };
        };
        return () => (check.result ?? null) === expected;
      });
      if (!committed) throw new JourneyConflict();
      this.revision = next;
      this.lastSnapshot = serialized;
      return true;
    });
  }
}
export function download(name: string, data: unknown) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
