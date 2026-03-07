import { writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { AssetStorePort } from "@lumen/core/ports";

type AssetDeps = {
  logger: { info(msg: string): void };
  /** Convert a file path to a webview-safe URI string */
  toWebviewUri: (filePath: string) => string;
};

export function vscodeAssetStore(deps: AssetDeps): AssetStorePort {
  return {
    async save(url: string, documentUri: string, format: string): Promise<string> {
      const dir = dirname(documentUri);
      const base = basename(documentUri, ".lumen");
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const timestamp = `${String(now.getFullYear()).slice(2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const filePath = join(dir, `${base}-${timestamp}.${format}`);

      let buffer: Buffer;
      if (url.startsWith("data:")) {
        const base64 = url.split(",")[1];
        buffer = Buffer.from(base64, "base64");
      } else {
        const res = await fetch(url);
        if (!res.ok)
          throw new Error(`Failed to download asset: ${res.status}`);
        buffer = Buffer.from(await res.arrayBuffer());
      }

      writeFileSync(filePath, buffer);
      deps.logger.info(`[asset] Saved ${filePath}`);

      return deps.toWebviewUri(filePath);
    },
  };
}
