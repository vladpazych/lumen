import type { ProviderPort } from "./provider";
import type { AssetStorePort } from "./asset-store";
import type { SecretStorePort } from "./secret-store";
import type { LoggerPort } from "./logger";

export type { ProviderPort } from "./provider";
export type { AssetStorePort } from "./asset-store";
export type { SecretStorePort } from "./secret-store";
export type { LoggerPort } from "./logger";

/** Aggregate of all ports needed by the editor service */
export type EditorPorts = {
  providers: Record<string, ProviderPort>;
  assets: AssetStorePort;
  secrets: SecretStorePort;
  logger: LoggerPort;
};
