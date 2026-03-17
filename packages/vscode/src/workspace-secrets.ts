import { createHash, randomBytes } from "node:crypto";
import { readAuthKey, writeAuthKey } from "./server-state";

export type SecretStorageLike = {
  get(key: string): Thenable<string | undefined>;
  store(key: string, value: string): Thenable<void>;
  delete(key: string): Thenable<void>;
};

export type ModalCredentials = {
  tokenId: string;
  tokenSecret: string;
};

export type WorkspaceAuthInfo = {
  modalCredentialsSaved: boolean;
  lumenAuthTokenSaved: boolean;
  modalSecretName: string;
};

const MODAL_TOKEN_ID_KEY = "modal.tokenId";
const MODAL_TOKEN_SECRET_KEY = "modal.tokenSecret";
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

  async getModalCredentials(): Promise<ModalCredentials | null> {
    const tokenId = await this.getValue(MODAL_TOKEN_ID_KEY);
    const tokenSecret = await this.getValue(MODAL_TOKEN_SECRET_KEY);
    if (!tokenId || !tokenSecret) {
      return null;
    }
    return { tokenId, tokenSecret };
  }

  async saveModalCredentials(
    tokenId: string,
    tokenSecret: string,
  ): Promise<void> {
    await this.setValue(MODAL_TOKEN_ID_KEY, tokenId);
    await this.setValue(MODAL_TOKEN_SECRET_KEY, tokenSecret);
  }

  async clearModalCredentials(): Promise<void> {
    await this.storage.delete(this.scopedKey(MODAL_TOKEN_ID_KEY));
    await this.storage.delete(this.scopedKey(MODAL_TOKEN_SECRET_KEY));
  }

  async getModalProcessEnv(): Promise<Record<string, string>> {
    const credentials = await this.getModalCredentials();
    if (!credentials) {
      throw new Error(
        "Save Modal credentials in the Lumen workspace home before starting the server.",
      );
    }

    return {
      MODAL_TOKEN_ID: credentials.tokenId,
      MODAL_TOKEN_SECRET: credentials.tokenSecret,
    };
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

  async describeAuth(
    modalSecretName: string,
    serverPath?: string,
  ): Promise<WorkspaceAuthInfo> {
    return {
      modalCredentialsSaved: (await this.getModalCredentials()) !== null,
      lumenAuthTokenSaved: (await this.peekLumenAuthToken(serverPath)) !== null,
      modalSecretName,
    };
  }
}
