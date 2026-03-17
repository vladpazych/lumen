import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readAuthKey } from "../src/server-state";
import {
  type SecretStorageLike,
  WorkspaceSecretStore,
} from "../src/workspace-secrets";

let currentServerSetting = "server";
let currentWorkspaceRoot = "";

mock.module("vscode", () => ({
  workspace: {
    getConfiguration: () => ({
      get: () => currentServerSetting,
      update: (_key: string, value: string) => {
        currentServerSetting = value;
        return Promise.resolve();
      },
    }),
    workspaceFolders: [
      {
        uri: {
          get fsPath() {
            return currentWorkspaceRoot;
          },
        },
      },
    ],
  },
  window: {
    showErrorMessage: () => {},
    showWarningMessage: () => {},
  },
  ConfigurationTarget: {
    Workspace: 1,
  },
}));

const {
  getServerSetting,
  getServerSource,
  migrateLegacyServerSetting,
  prepareServerStart,
} = await import("../src/server");

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
  currentServerSetting = "server";
  currentWorkspaceRoot = "";
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
    const serverPath = join(workspaceRoot, "server");
    mkdirSync(serverPath, { recursive: true });

    const storage = new MemorySecretStorage();
    const store = new WorkspaceSecretStore(storage, () => workspaceRoot);

    const env = await prepareServerStart(serverPath, store);
    const authToken = await store.getLumenAuthToken(serverPath);

    expect(env).toBe(process.env);
    expect(readAuthKey(serverPath)).toBe(authToken);
  });

  test("creates the auth key path when the server directory is missing", async () => {
    const workspaceRoot = tempDir("lumen-workspace-");
    const serverPath = join(workspaceRoot, "server");

    const storage = new MemorySecretStorage();
    const store = new WorkspaceSecretStore(storage, () => workspaceRoot);

    await prepareServerStart(serverPath, store);

    expect(readAuthKey(serverPath)).not.toBeNull();
  });
});

describe("server setting migration", () => {
  test("falls back from legacy assets/server to server when the runtime moved", async () => {
    const workspaceRoot = tempDir("lumen-workspace-");
    currentWorkspaceRoot = workspaceRoot;
    currentServerSetting = "assets/server";
    const serverPath = join(workspaceRoot, "server");

    mkdirSync(serverPath, { recursive: true });
    writeFileSync(join(serverPath, "serve.py"), "print('ok')\n");

    expect(getServerSetting()).toBe("server");
    expect(getServerSource()).toBe(serverPath);

    await migrateLegacyServerSetting();

    expect(currentServerSetting).toBe("server");
  });
});
