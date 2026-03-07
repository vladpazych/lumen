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

/** Assign slug ids to configs missing an id. Returns true if any were assigned. */
export function ensureIds(configs: LumenConfig[]): boolean {
  let assigned = false;
  const existingIds = new Set(configs.map((c) => c.id).filter(Boolean));
  for (const config of configs) {
    if (!config.id) {
      config.id = generateSlugId(config.pipeline, existingIds);
      existingIds.add(config.id);
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
  return configs.map((c) => (c.id === configId ? { ...c, name } : c));
}

/** Create a new config with auto-generated slug id and name */
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

  const existingIds = new Set(existingConfigs.map((c) => c.id));
  return {
    id: generateSlugId(pipeline, existingIds),
    name,
    service,
    pipeline,
    params: {},
  };
}

/** Generate a kebab-case slug id unique within the given set */
export function generateSlugId(base: string, existingIds: Set<string>): string {
  const slug = toKebab(base);
  if (!existingIds.has(slug)) return slug;
  for (let i = 2; ; i++) {
    const candidate = `${slug}-${i}`;
    if (!existingIds.has(candidate)) return candidate;
  }
}

function toKebab(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Old nested format: { "serverUrl": { "pipelineId": { params } } }
function migrateOldFormat(raw: Record<string, unknown>): LumenConfig[] {
  const configs: LumenConfig[] = [];
  const existingIds = new Set<string>();
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith("_") || typeof value !== "object" || value === null)
      continue;
    const pipelines = value as Record<string, unknown>;
    for (const [pipelineId, params] of Object.entries(pipelines)) {
      if (typeof params !== "object" || params === null) continue;
      const id = generateSlugId(pipelineId, existingIds);
      existingIds.add(id);
      configs.push({
        id,
        service: key,
        pipeline: pipelineId,
        params: params as Record<string, unknown>,
      });
    }
  }
  return configs;
}
