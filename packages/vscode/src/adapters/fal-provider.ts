import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import * as vscode from "vscode";
import type { ProviderPort } from "@lumen/core/ports";
import type { GenerateResponse, ParamDefinition, PipelineConfig } from "@lumen/core/types";

export const FAL_PROVIDER_URL = "provider://fal";

const ASPECT_RATIO_OPTIONS = [
  { value: "1:1", label: "1:1 Square" },
  { value: "16:9", label: "16:9 Landscape" },
  { value: "9:16", label: "9:16 Portrait" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
  { value: "3:2", label: "3:2" },
  { value: "2:3", label: "2:3" },
  { value: "4:5", label: "4:5" },
  { value: "5:4", label: "5:4" },
  { value: "21:9", label: "21:9 Ultrawide" },
];

const sharedParams = (
  resolutionOptions: { value: string }[],
): ParamDefinition[] => [
  {
    type: "select",
    name: "aspect_ratio",
    label: "Aspect Ratio",
    default: "1:1",
    options: ASPECT_RATIO_OPTIONS,
    group: "basic",
  },
  {
    type: "integer",
    name: "num_images",
    label: "Images",
    default: 1,
    min: 1,
    max: 4,
    group: "basic",
  },
  { type: "seed", name: "seed", label: "Seed", group: "advanced" },
  {
    type: "select",
    name: "output_format",
    label: "Format",
    default: "png",
    options: [{ value: "png" }, { value: "jpeg" }, { value: "webp" }],
    group: "advanced",
  },
  {
    type: "select",
    name: "resolution",
    label: "Resolution",
    default: "1K",
    options: resolutionOptions,
    group: "advanced",
  },
  {
    type: "boolean",
    name: "enable_web_search",
    label: "Web Search",
    default: false,
    group: "advanced",
  },
];

const falPipelines: PipelineConfig[] = [
  {
    id: "nano-banana",
    name: "Nano Banana",
    description: "Gemini 2.5 Flash image generation via fal.ai",
    category: "image",
    params: [
      {
        type: "prompt",
        name: "prompt",
        label: "Prompt",
        required: true,
        group: "basic",
      },
      ...sharedParams([{ value: "1K" }, { value: "2K" }]),
    ],
    output: { type: "image", format: "png" },
  },
  {
    id: "nano-banana-2",
    name: "Nano Banana 2",
    description: "Gemini 3.1 Flash image generation via fal.ai",
    category: "image",
    params: [
      {
        type: "prompt",
        name: "prompt",
        label: "Prompt",
        required: true,
        group: "basic",
      },
      {
        type: "image",
        name: "image_urls",
        label: "Reference Image",
        group: "basic",
      },
      ...sharedParams([
        { value: "0.5K" },
        { value: "1K" },
        { value: "2K" },
        { value: "4K" },
      ]),
    ],
    output: { type: "image", format: "png" },
  },
  {
    id: "nano-banana-pro",
    name: "Nano Banana Pro",
    description: "Gemini 3 Pro high-quality image generation via fal.ai",
    category: "image",
    params: [
      {
        type: "prompt",
        name: "prompt",
        label: "Prompt",
        required: true,
        group: "basic",
      },
      ...sharedParams([{ value: "1K" }, { value: "2K" }, { value: "4K" }]),
    ],
    output: { type: "image", format: "png" },
  },
];

const MODEL_MAP: Record<string, string> = {
  "nano-banana": "fal-ai/nano-banana",
  "nano-banana-2": "fal-ai/nano-banana-2",
  "nano-banana-pro": "fal-ai/nano-banana-pro",
};

const UPLOAD_CACHE_KEY = "lumen.fal.uploadCache";

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

interface FalImage {
  url: string;
  content_type: string;
}

interface FalResponse {
  images: FalImage[];
  seed?: number;
}

type FalProviderDeps = {
  apiKey: () => string | null;
  storage: vscode.Memento;
  /** Resolve a relative image path to absolute, given document directory */
  resolveImagePath: (relativePath: string) => string;
};

/** ProviderPort adapter for fal.ai built-in provider */
export function falProvider(deps: FalProviderDeps): ProviderPort {
  const { apiKey, storage, resolveImagePath } = deps;

  function requireKey(): string {
    const key = apiKey();
    if (!key)
      throw new Error(
        "fal.ai API key not set. Run 'Lumen: Set fal.ai API Key'.",
      );
    return key;
  }

  async function uploadImage(key: string, filePath: string): Promise<string> {
    const bytes = readFileSync(filePath);
    const hash = createHash("sha256").update(bytes).digest("hex");

    const cache = storage.get<Record<string, string>>(UPLOAD_CACHE_KEY, {});
    if (cache[hash]) return cache[hash];

    const name = basename(filePath);
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

    const initRes = await fetch(
      "https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3",
      {
        method: "POST",
        headers: {
          Authorization: `Key ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content_type: contentType, file_name: name }),
      },
    );
    if (!initRes.ok) {
      const text = await initRes.text().catch(() => initRes.statusText);
      throw new Error(`fal upload failed: ${initRes.status} ${text}`);
    }
    const { upload_url, file_url } = (await initRes.json()) as {
      upload_url: string;
      file_url: string;
    };

    const putRes = await fetch(upload_url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: bytes,
    });
    if (!putRes.ok) {
      throw new Error(`fal upload PUT failed: ${putRes.status}`);
    }

    cache[hash] = file_url;
    await storage.update(UPLOAD_CACHE_KEY, cache);
    return file_url;
  }

  return {
    async fetchSchemas(): Promise<PipelineConfig[]> {
      return falPipelines;
    },

    async generate(
      pipelineId: string,
      params: Record<string, unknown>,
    ): Promise<GenerateResponse> {
      const key = requireKey();
      const model = MODEL_MAP[pipelineId];
      if (!model) {
        return {
          status: "failed",
          runId: "",
          error: {
            code: "UNKNOWN_PIPELINE",
            message: `Unknown fal pipeline: ${pipelineId}`,
          },
        };
      }

      const body: Record<string, unknown> = { ...params };
      if (!body.seed) delete body.seed;

      // Upload local reference images
      const imageVal = body.image_urls as string | undefined;
      const hasImage = typeof imageVal === "string" && imageVal.length > 0;
      if (hasImage) {
        let resolvedUrl = imageVal;
        if (!imageVal.startsWith("http")) {
          const absPath = resolveImagePath(imageVal);
          if (!existsSync(absPath))
            throw new Error(`Reference image not found: ${imageVal}`);
          resolvedUrl = await uploadImage(key, absPath);
        }
        body.image_urls = [resolvedUrl];
      } else {
        delete body.image_urls;
      }
      const endpoint = hasImage ? `${model}/edit` : model;

      const res = await fetch(`https://fal.run/${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Key ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let message = `fal.ai error ${res.status}`;
        try {
          const err = (await res.json()) as {
            detail?: string;
            message?: string;
          };
          message = err.detail ?? err.message ?? message;
        } catch {}
        return {
          status: "failed",
          runId: "",
          error: { code: "FAL_ERROR", message },
        };
      }

      const data = (await res.json()) as FalResponse;
      return {
        status: "completed",
        runId: crypto.randomUUID().slice(0, 12),
        outputs: data.images.map((img) => ({
          url: img.url,
          type: "image" as const,
          format: img.content_type.split("/")[1] ?? "png",
          metadata: { seed: data.seed },
        })),
      };
    },

    async pollRun(): Promise<GenerateResponse> {
      // fal.ai is synchronous — polling never needed
      return {
        status: "failed",
        runId: "",
        error: {
          code: "NOT_SUPPORTED",
          message: "fal.ai does not support async polling",
        },
      };
    },
  };
}

export async function getApiKey(
  secrets: vscode.SecretStorage,
): Promise<string | undefined> {
  return secrets.get("lumen.fal.apiKey");
}

export async function promptAndStoreApiKey(
  secrets: vscode.SecretStorage,
): Promise<boolean> {
  const key = await vscode.window.showInputBox({
    prompt: "Enter your fal.ai API key",
    placeHolder: "fal_...",
    password: true,
    ignoreFocusOut: true,
  });
  if (!key) return false;
  await secrets.store("lumen.fal.apiKey", key);
  return true;
}
