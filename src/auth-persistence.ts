export interface AuthWaitResult {
  connected: boolean;
  message: string;
}

const CONNECTED_RESULT: AuthWaitResult = {
  connected: true,
  message: "WhatsApp connected successfully.",
};

export class AuthPersistenceGate {
  private connected = false;
  private writeVersion = 0;
  private successfulWriteVersion = 0;
  private latestWrite: Promise<void> = Promise.resolve();
  private latestWriteError: unknown = null;
  private terminalResult: AuthWaitResult | null = null;
  private waiters: Array<(result: AuthWaitResult) => void> = [];
  private checkScheduled = false;

  constructor(private readonly persistedBeforeStart: boolean) {}

  trackWrite(write: () => Promise<void>): void {
    const version = ++this.writeVersion;
    const pending = this.latestWrite.catch(() => undefined).then(write);
    this.latestWrite = pending;
    void pending.then(
      () => {
        this.successfulWriteVersion = version;
        this.latestWriteError = null;
        this.scheduleCheck();
      },
      (error: unknown) => {
        if (version === this.writeVersion) this.latestWriteError = error;
        this.scheduleCheck();
      },
    );
  }

  markConnected(): void {
    this.connected = true;
    this.scheduleCheck();
  }

  markFailed(message: string): void {
    this.finish({ connected: false, message });
  }

  waitUntilDurable(): Promise<AuthWaitResult> {
    if (this.terminalResult) return Promise.resolve(this.terminalResult);
    this.scheduleCheck();
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  private scheduleCheck(): void {
    if (this.checkScheduled || this.terminalResult) return;
    this.checkScheduled = true;
    setImmediate(() => {
      this.checkScheduled = false;
      void this.checkLatestWrite();
    });
  }

  private async checkLatestWrite(): Promise<void> {
    if (this.terminalResult) return;
    const observedVersion = this.writeVersion;
    await this.latestWrite.catch(() => undefined);
    if (observedVersion !== this.writeVersion) {
      this.scheduleCheck();
      return;
    }
    if (!this.connected) return;
    if (this.latestWriteError) {
      const reason = this.latestWriteError instanceof Error
        ? this.latestWriteError.message
        : String(this.latestWriteError);
      this.finish({
        connected: false,
        message: `Failed to persist WhatsApp credentials: ${reason}`,
      });
      return;
    }
    if (this.persistedBeforeStart || this.successfulWriteVersion > 0) {
      this.finish(CONNECTED_RESULT);
    }
  }

  private finish(result: AuthWaitResult): void {
    if (this.terminalResult) return;
    this.terminalResult = result;
    for (const resolve of this.waiters.splice(0)) resolve(result);
  }
}
