import type { Request, Response } from "../workspace/service";

/** The UI's side of the core worker: one promise per request. */
export class CoreClient {
  private readonly worker = new Worker(new URL("./core.worker.ts", import.meta.url), { type: "module" });
  private readonly pending = new Map<number, (res: Response) => void>();
  private next = 1;

  constructor() {
    this.worker.onmessage = (event: MessageEvent<{ id: number; res: Response }>) => {
      this.pending.get(event.data.id)?.(event.data.res);
      this.pending.delete(event.data.id);
    };
    this.worker.onerror = (event) => {
      for (const resolve of this.pending.values()) resolve({ ok: false, error: event.message || "the core worker failed" });
      this.pending.clear();
    };
  }

  request(req: Request): Promise<Response> {
    const id = this.next++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.worker.postMessage({ id, req });
    });
  }
}
