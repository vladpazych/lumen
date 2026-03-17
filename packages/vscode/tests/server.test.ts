import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readAuthKey } from "../src/server-state";
import {
  type SecretStorageLike,
  WorkspaceSecretStore,
} from "../src/workspace-secrets";

mock.module("vscode", () => ({
  workspace: {
    getConfiguration: () => ({ get: () => "server" }),
    workspaceFolders: [],
  },
  window: {
    showErrorMessage: () => {},
    showWarningMessage: () => {},
  },
}));

const { prepareServerStart } = await import("../src/server");

class MemorySecretStorage implements SecretStorageLike {
  private readonly values = new Map<string, string>();

  get(key: string): Promise<string | undefined> {
    return Promise.resolve(this.values.get(key));
  }

  store(key: string, value: string): Promise<void> {
    this.values.set(key, value);
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.values.delete(key);
    return Promise.resolve();
  }
}

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

describe("prepareServerStart", () => {
  test("writes the auth key file from secret storage", async () => {
    const workspaceRoot = tempDir("lumen-workspace-");
    const serverPath = join(workspaceRoot, "assets", "server");
    mkdirSync(serverPath, { recursive: true });

    const storage = new MemorySecretStorage();
    const store = new WorkspaceSecretStore(storage, () => workspaceRoot);

    const env = await prepareServerStart(serverPath, store);
    const authToken = await store.getLumenAuthToken(serverPath);

    expect(env).toBe(process.env);
    expect(readAuthKey(serverPath)).toBe(authToken);
  });
});
