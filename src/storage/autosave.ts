export type AutosaveState =
  | { status: "idle" }
  | { status: "dirty" }
  | { status: "saving" }
  | { status: "saved"; savedAt: string }
  | { status: "error"; error: Error };

export interface AutosaveOptions<T> {
  write: (value: T) => Promise<void>;
  debounceMs?: number;
  now?: () => Date;
  onStateChange?: (state: AutosaveState) => void;
}

export class SerializedAutosave<T> {
  private readonly debounceMs: number;
  private readonly now: () => Date;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private latest: T | undefined;
  private revision = 0;
  private savedRevision = 0;
  private queuedRevision = 0;
  private writeChain: Promise<void> = Promise.resolve();
  private disposed = false;
  private state: AutosaveState = { status: "idle" };

  constructor(private readonly options: AutosaveOptions<T>) {
    this.debounceMs = options.debounceMs ?? 500;
    this.now = options.now ?? (() => new Date());
  }

  schedule(value: T): void {
    if (this.disposed) return;
    this.latest = value;
    this.revision += 1;
    this.emit({ status: "dirty" });
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.enqueueLatest();
    }, this.debounceMs);
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    await this.enqueueLatest();
    await this.writeChain;
    if (this.savedRevision < this.revision) {
      await this.enqueueLatest();
      await this.writeChain;
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  getState(): AutosaveState {
    return this.state;
  }

  getLatestValue(): T | undefined {
    return this.latest;
  }

  private async enqueueLatest(): Promise<void> {
    if (this.latest === undefined || this.queuedRevision >= this.revision) return this.writeChain;
    const value = this.latest;
    const revision = this.revision;
    this.queuedRevision = revision;
    this.writeChain = this.writeChain
      .catch(() => undefined)
      .then(async () => {
        this.emit({ status: "saving" });
        try {
          await this.options.write(value);
          this.savedRevision = Math.max(this.savedRevision, revision);
          if (this.savedRevision === this.revision) {
            this.emit({ status: "saved", savedAt: this.now().toISOString() });
          }
        } catch (cause) {
          this.queuedRevision = this.savedRevision;
          const error = cause instanceof Error ? cause : new Error("Autosave failed.", { cause });
          this.emit({ status: "error", error });
          throw error;
        }
      });
    return this.writeChain;
  }

  private emit(state: AutosaveState): void {
    this.state = state;
    this.options.onStateChange?.(state);
  }
}
