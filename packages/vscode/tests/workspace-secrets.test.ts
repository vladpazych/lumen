import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeAuthKey } from "../src/server-state";
import {
  type SecretStorageLike,
  WorkspaceSecretStore,
} from "../src/workspace-secrets";

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

function createStore(
  storage: SecretStorageLike,
  workspaceRoot: string,
): WorkspaceSecretStore {
  return new WorkspaceSecretStore(storage, () => workspaceRoot);
}

describe("workspace-secrets", () => {
  test("migrates an existing auth key into secret storage", async () => {
    const workspaceRoot = tempDir("lumen-workspace-");
    const serverPath = join(workspaceRoot, "assets", "server");
    mkdirSync(serverPath, { recursive: true });
    writeAuthKey(serverPath, "migrated-token");

    const storage = new MemorySecretStorage();
    const store = createStore(storage, workspaceRoot);

    expect(await store.peekLumenAuthToken(serverPath)).toBe("migrated-token");

    rmSync(join(serverPath, ".authkey"), { force: true });
    expect(await store.getLumenAuthToken()).toBe("migrated-token");
  });

  test("scopes secrets to the active workspace root", async () => {
    const storage = new MemorySecretStorage();
    const first = createStore(storage, tempDir("lumen-workspace-a-"));
    const second = createStore(storage, tempDir("lumen-workspace-b-"));

    const firstToken = await first.getLumenAuthToken();

    expect(firstToken.length).toBeGreaterThan(0);
    expect(await second.peekLumenAuthToken()).toBeNull();
  });
});
