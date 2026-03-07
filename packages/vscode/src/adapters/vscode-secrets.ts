import * as vscode from "vscode";
import type { SecretStorePort } from "@lumen/core/ports";

export function vscodeSecretStore(
  secrets: vscode.SecretStorage,
): SecretStorePort {
  return {
    async get(key: string): Promise<string | undefined> {
      return secrets.get(key);
    },
    async set(key: string, value: string): Promise<void> {
      await secrets.store(key, value);
    },
  };
}
