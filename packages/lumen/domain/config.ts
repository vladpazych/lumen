import type { LumenConfig, PipelineConfig } from "../types";

/** Parse a .lumen file's text content into configs */
export function parseConfigs(text: string): LumenConfig[] {
  const trimmed = text.trim();
  if (!trimmed || trimmed === "[]" || trimmed === "{}") return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) return parsed as LumenConfig[];
    if (typeof parsed === "object" && parsed !== null) {
      return migrateOldFormat(parsed as Record<string, unknown>);
    }
    return [];
  } catch {
    return [];
  }
}

/** Serialize configs back to .lumen file content */
export function serializeConfigs(configs: LumenConfig[]): string {
  return JSON.stringify(configs, null, 2) + "\n";
}

/** Assign UUIDs to configs missing an id. Returns true if any were assigned. */
export function ensureIds(configs: LumenConfig[]): boolean {
  let assigned = false;
  for (const config of configs) {
    if (!config.id) {
      config.id = crypto.randomUUID();
      assigned = true;
    }
  }
  return assigned;
}

/** Update a single param value in the config list (immutable) */
export function updateParam(
  configs: LumenConfig[],
  configId: string,
  paramName: string,
  value: unknown,
): LumenConfig[] {
  return configs.map((c) =>
    c.id === configId
      ? { ...c, params: { ...c.params, [paramName]: value } }
      : c,
  );
}

/** Update config name (immutable) */
export function updateName(
  configs: LumenConfig[],
  configId: string,
  name: string,
): LumenConfig[] {
  return configs.map((c) =>
    c.id === configId ? { ...c, name } : c,
  );
}

/** Create a new config with auto-generated name based on dupe count */
export function createConfig(
  service: string,
  pipeline: string,
  schemas: Record<string, PipelineConfig[]>,
  existingConfigs: LumenConfig[],
): LumenConfig {
  const schema = schemas[service]?.find((p) => p.id === pipeline);
  const displayName = schema?.name ?? pipeline;
  const dupeCount = existingConfigs.filter(
    (c) => c.service === service && c.pipeline === pipeline,
  ).length;
  const name =
    dupeCount === 0 ? displayName : `${displayName} #${dupeCount + 1}`;
  return {
    id: crypto.randomUUID(),
    name,
    service,
    pipeline,
    params: {},
  };
}

// Old nested format: { "serverUrl": { "pipelineId": { params } } }
function migrateOldFormat(raw: Record<string, unknown>): LumenConfig[] {
  const configs: LumenConfig[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith("_") || typeof value !== "object" || value === null)
      continue;
    const pipelines = value as Record<string, unknown>;
    for (const [pipelineId, params] of Object.entries(pipelines)) {
      if (typeof params !== "object" || params === null) continue;
      configs.push({
        id: crypto.randomUUID(),
        service: key,
        pipeline: pipelineId,
        params: params as Record<string, unknown>,
      });
    }
  }
  return configs;
}
