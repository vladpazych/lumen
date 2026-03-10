import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import * as vscode from "vscode";
import type { LumenConfig, PipelineConfig } from "@vladpazych/lumen/types";

type SchemaCache = Record<string, PipelineConfig[]>;

/** Convert local image paths to data URIs so servers can receive them. */
export function resolveImageParams(
  schemas: SchemaCache,
  service: string,
  pipelineId: string,
  params: Record<string, unknown>,
  docDir: string,
): Record<string, unknown> {
  const schema = schemas[service]?.find((p) => p.id === pipelineId);
  if (!schema) return params;
  const resolved = { ...params };
  for (const param of schema.params) {
    if (param.type !== "image") continue;
    const val = resolved[param.name];
    if (typeof val === "string") {
      const resolvedValue = resolveImageValue(val, docDir);
      if (resolvedValue) resolved[param.name] = resolvedValue;
      continue;
    }
    if (!Array.isArray(val)) continue;
    resolved[param.name] = val.map((item) =>
      typeof item === "string"
        ? (resolveImageValue(item, docDir) ?? item)
        : item,
    );
  }
  return resolved;
}

/** Resolve a relative image path to a webview-safe URI. */
export function imageThumbUri(
  relPath: string,
  docDir: string,
  webview: vscode.Webview,
): string | undefined {
  if (!relPath || relPath.startsWith("http")) return undefined;
  const absPath = resolve(docDir, relPath);
  if (!existsSync(absPath)) return undefined;
  return webview.asWebviewUri(vscode.Uri.file(absPath)).toString();
}

/** Collect thumbnail URIs for all image-valued params in configs. */
export function collectThumbs(
  schemas: SchemaCache,
  configs: LumenConfig[],
  docDir: string,
  webview: vscode.Webview,
): Record<string, string> {
  const thumbs: Record<string, string> = {};
  for (const config of configs) {
    const schema = schemas[config.service]?.find((p) => p.id === config.pipeline);
    if (!schema) continue;
    for (const param of schema.params) {
      if (param.type !== "image") continue;
      const value = config.params[param.name];
      const paths =
        typeof value === "string"
          ? [value]
          : Array.isArray(value)
          ? value.filter((item): item is string => typeof item === "string")
          : [];
      for (const path of paths) {
        if (!path || path.startsWith("http") || path.startsWith("data:")) {
          continue;
        }
        const uri = imageThumbUri(path, docDir, webview);
        if (uri) thumbs[path] = uri;
      }
    }
  }
  return thumbs;
}

function resolveImageValue(
  value: string,
  docDir: string,
): string | undefined {
  if (!value || value.startsWith("http") || value.startsWith("data:")) {
    return undefined;
  }
  const absPath = resolve(docDir, value);
  if (!existsSync(absPath)) return undefined;
  const bytes = readFileSync(absPath);
  const ext = absPath.split(".").pop()?.toLowerCase() ?? "png";
  const mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

/** In-webview file picker for reference images. */
export function pickImage(docDir: string): Promise<string | undefined> {
  type PickItem = vscode.QuickPickItem & {
    dirName?: string;
    imagePath?: string;
  };
  const IMAGE_EXT = /\.(png|jpg|jpeg|webp|gif)$/i;

  return new Promise((resolve) => {
    let currentDir = docDir;
    let settled = false;
    const done = (path: string | undefined) => {
      if (settled) return;
      settled = true;
      resolve(path);
    };

    const buildItems = (): PickItem[] => {
      const items: PickItem[] = [
        { label: "$(arrow-up) ../", alwaysShow: true, dirName: ".." },
      ];
      try {
        const entries = readdirSync(currentDir, { withFileTypes: true })
          .filter((e) => !e.name.startsWith("."))
          .sort((a, b) => {
            if (a.isDirectory() !== b.isDirectory())
              return a.isDirectory() ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            items.push({
              label: `$(folder) ${entry.name}`,
              alwaysShow: true,
              dirName: entry.name,
            });
          } else if (IMAGE_EXT.test(entry.name)) {
            const abs = join(currentDir, entry.name);
            const rel = relative(docDir, abs);
            const norm = rel.startsWith(".") ? rel : `./${rel}`;
            items.push({
              label: entry.name,
              description: norm,
              alwaysShow: true,
              imagePath: norm,
            });
          }
        }
      } catch {
        // permission error
      }
      return items;
    };

    const qp = vscode.window.createQuickPick<PickItem>();
    qp.title = "Pick reference image";

    const navigateTo = (dir: string) => {
      currentDir = dir;
      const rel = relative(docDir, dir);
      qp.placeholder = (rel || ".") + "/";
      qp.value = "";
      qp.items = buildItems();
    };

    qp.onDidAccept(() => {
      const item = qp.activeItems[0];
      if (!item) return;
      if (item.dirName) {
        navigateTo(join(currentDir, item.dirName));
      } else if (item.imagePath) {
        done(item.imagePath);
        qp.hide();
      }
    });

    qp.onDidHide(() => {
      done(undefined);
      qp.dispose();
    });

    navigateTo(docDir);
    qp.show();
  });
}
