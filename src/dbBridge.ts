type ProgressMessage = {
  type: 'progress';
  message: string;
};

type WorkerResponse = {
  id: number;
  result?: unknown;
  error?: string;
};

type PendingHandlers = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

class DbBridge {
  #worker: Worker | null = null;
  #pending = new Map<number, PendingHandlers>();
  #nextId = 1;
  #initPromise: Promise<unknown> | null = null;
  #currentFile: File | null = null;
  #progressCallback: ((msg: string) => void) | null = null;

  #spawnWorker() {
    if (this.#worker) return;

    this.#worker = new Worker(new URL('./db-worker.ts', import.meta.url), {
      type: 'module',
    });

    this.#worker.onmessage = ({ data }: MessageEvent<ProgressMessage | WorkerResponse>) => {
      if ((data as ProgressMessage).type === 'progress') {
        this.#progressCallback?.((data as ProgressMessage).message);
        return;
      }

      const { id, result, error } = data as WorkerResponse;
      const handlers = this.#pending.get(id);
      if (!handlers) return;

      this.#pending.delete(id);
      if (error !== undefined) {
        handlers.reject(new Error(error));
        return;
      }

      handlers.resolve(result);
    };

    this.#worker.onerror = (event) => {
      const errMsg = event.message || 'Unknown worker error';
      for (const { reject } of this.#pending.values()) {
        reject(new Error(errMsg));
      }
      this.#pending.clear();
    };
  }

  #send(type: string, payload: Record<string, unknown> = {}) {
    this.#spawnWorker();
    const id = this.#nextId++;

    return new Promise<unknown>((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#worker?.postMessage({ type, id, payload });
    });
  }

  init(file?: File | null) {
    if (file) this.#currentFile = file;

    if (!this.#initPromise) {
      const fileToSend = this.#currentFile;
      if (!fileToSend) {
        throw new Error('DbBridge.init() requires a File — call with a File first');
      }

      this.#initPromise = this.#send('init', { file: fileToSend }).catch((err) => {
        this.#initPromise = null;
        throw err;
      });
    }

    return this.#initPromise;
  }

  async reinit(file?: File | null) {
    if (file) this.#currentFile = file;
    await this.close();
    return this.init();
  }

  async close() {
    if (this.#worker) {
      try {
        await this.#send('close');
      } catch {
      }

      this.#worker.terminate();
      this.#worker = null;
    }

    this.#initPromise = null;
    this.#pending.clear();
  }

  get isReady() {
    return this.#initPromise !== null;
  }

  async getRaids() {
    await this.init();
    return this.#send('getRaids');
  }

  async getDailyGuardianRaids(characterName: string) {
    await this.init();
    return this.#send('getDailyGuardianRaids', { characterName });
  }

  async getDailyFieldBoss(rosterNames: string[]) {
    await this.init();
    return this.#send('getDailyFieldBoss', { rosterNames });
  }

  async getDailyChaosGate(rosterNames: string[]) {
    await this.init();
    return this.#send('getDailyChaosGate', { rosterNames });
  }

  async getWeeklyThaemine(rosterNames: string[]) {
    await this.init();
    return this.#send('getWeeklyThaemine', { rosterNames });
  }

  async getCharactersFromDatabase(onProgress?: (msg: string) => void) {
    await this.init();
    this.#progressCallback = onProgress ?? null;

    try {
      return await this.#send('getCharactersFromDatabase');
    } finally {
      this.#progressCallback = null;
    }
  }
}

const dbBridge = new DbBridge();

export { DbBridge, dbBridge };
