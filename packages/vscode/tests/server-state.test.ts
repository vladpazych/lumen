import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  clearLastUrl,
  ensureAuthKey,
  readAuthKey,
  readLastUrl,
  writeLastUrl,
} from "../src/server-state";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function tempServerDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "lumen-server-state-"));
  dirs.push(dir);
  return dir;
}

describe("server-state", () => {
  test("ensureAuthKey creates and reuses a stable auth key", () => {
    const dir = tempServerDir();

    const first = ensureAuthKey(dir);
    const second = ensureAuthKey(dir);

    expect(first).toBe(second);
    expect(readAuthKey(dir)).toBe(first);
  });

  test("readAuthKey returns null for a missing key", () => {
    expect(readAuthKey(tempServerDir())).toBeNull();
  });

  test("persists and clears the last detected URL", () => {
    const dir = tempServerDir();

    writeLastUrl(dir, "https://example.modal.run");
    expect(readLastUrl(dir)).toBe("https://example.modal.run");

    clearLastUrl(dir);
    expect(readLastUrl(dir)).toBeNull();
  });

  test("treats empty URL files as missing", () => {
    const dir = tempServerDir();
    writeFileSync(join(dir, ".dev.url"), "\n");

    expect(readLastUrl(dir)).toBeNull();
  });
});
