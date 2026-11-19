import type { Save } from "./save";

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

/** Each open game writes from the revision it actually loaded. */
export class JourneyStore {
  private revision: string | null | undefined;
  private lastSnapshot?: string;
  private pending: Promise<void> = Promise.resolve();

  private enqueue<T>(action: () => Promise<T>): Promise<T> {
    const work = this.pending.then(action);
    this.pending = work.then(() => {}, () => {});
    return work;
  }

  read(): Promise<unknown> {
    return this.enqueue(async () => {
      this.revision = undefined;
      const record = await transact("readonly", store => {
        const revision = store.get("save-revision");
        const save = store.get("save");
        return () => ({ revision: revision.result ?? null, save: save.result });
      });
      this.revision = record.revision;
      // Recovery also accepts damaged IndexedDB records which may not be JSON.
      try { this.lastSnapshot = JSON.stringify(record.save); }
      catch { this.lastSnapshot = undefined; }
      return record.save;
    });
  }

  write(save: Save, skipUnchanged = false): Promise<boolean> {
    const snapshot = structuredClone(save);
    return this.enqueue(async () => {
      if (this.revision === undefined) throw Error("Read the browser save before writing.");
      const serialized = JSON.stringify(snapshot);
      if (skipUnchanged && serialized === this.lastSnapshot) return false;
      const expected = this.revision;
      const next = crypto.randomUUID();
      const committed = await transact("readwrite", store => {
        const check = store.get("save-revision");
        check.onsuccess = () => {
          if ((check.result ?? null) !== expected) return;
          store.put(next, "save-revision");
          store.put(snapshot, "save");
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
