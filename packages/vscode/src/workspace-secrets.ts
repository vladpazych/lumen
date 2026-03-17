import { createHash, randomBytes } from "node:crypto";
import { readAuthKey, writeAuthKey } from "./server-state";

export type SecretStorageLike = {
  get(key: string): Thenable<string | undefined>;
  store(key: string, value: string): Thenable<void>;
  delete(key: string): Thenable<void>;
};

const LUMEN_AUTH_TOKEN_KEY = "lumen.authToken";

export class WorkspaceSecretStore {
  constructor(
    private readonly storage: SecretStorageLike,
    private readonly getWorkspaceRoot: () => string | null = () => null,
  ) {}

  private scopedKey(name: string): string {
    const root = this.getWorkspaceRoot();
    if (!root) {
      throw new Error("Open a workspace folder to use Lumen");
    }

    const scope = createHash("sha256").update(root).digest("hex");
    return `lumen:${scope}:${name}`;
  }

  private async getValue(name: string): Promise<string | null> {
    const value = await this.storage.get(this.scopedKey(name));
    return value?.trim() ? value : null;
  }

  private async setValue(name: string, value: string): Promise<void> {
    await this.storage.store(this.scopedKey(name), value.trim());
  }

  async getLumenAuthToken(serverPath?: string): Promise<string> {
    const existing = await this.getValue(LUMEN_AUTH_TOKEN_KEY);
    if (existing) {
      return existing;
    }

    const migrated = serverPath ? readAuthKey(serverPath) : null;
    const token = migrated ?? randomBytes(32).toString("hex");
    await this.setValue(LUMEN_AUTH_TOKEN_KEY, token);
    return token;
  }

  async peekLumenAuthToken(serverPath?: string): Promise<string | null> {
    const existing = await this.getValue(LUMEN_AUTH_TOKEN_KEY);
    if (existing) {
      return existing;
    }

    const migrated = serverPath ? readAuthKey(serverPath) : null;
    if (!migrated) {
      return null;
    }

    await this.setValue(LUMEN_AUTH_TOKEN_KEY, migrated);
    return migrated;
  }

  async syncLumenAuthKeyFile(serverPath: string): Promise<string> {
    const token = await this.getLumenAuthToken(serverPath);
    writeAuthKey(serverPath, token);
    return token;
  }
}
