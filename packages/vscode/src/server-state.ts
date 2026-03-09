import { randomBytes } from "node:crypto";
import {
  existsSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

function authKeyFile(serverPath: string): string {
  return join(serverPath, ".authkey");
}

function urlFile(serverPath: string): string {
  return join(serverPath, ".dev.url");
}

export function ensureAuthKey(serverPath: string): string {
  const file = authKeyFile(serverPath);
  if (existsSync(file)) {
    return readFileSync(file, "utf-8").trim();
  }
  const key = randomBytes(32).toString("hex");
  writeFileSync(file, key + "\n");
  return key;
}

export function readAuthKey(serverPath: string): string | null {
  const file = authKeyFile(serverPath);
  if (!existsSync(file)) return null;
  const key = readFileSync(file, "utf-8").trim();
  return key || null;
}

export function readLastUrl(serverPath: string): string | null {
  const file = urlFile(serverPath);
  if (!existsSync(file)) return null;
  const url = readFileSync(file, "utf-8").trim();
  return url || null;
}

export function writeLastUrl(serverPath: string, url: string): void {
  writeFileSync(urlFile(serverPath), url + "\n");
}

export function clearLastUrl(serverPath: string): void {
  try {
    unlinkSync(urlFile(serverPath));
  } catch {}
}
