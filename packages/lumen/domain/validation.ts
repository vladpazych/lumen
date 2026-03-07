import type { ParamDefinition } from "../types";

/** Validate a single param value against its schema. Returns error message or null. */
export function validateParam(
  param: ParamDefinition,
  value: unknown,
): string | null {
  if (param.hidden) return null;

  const empty = value === undefined || value === null || value === "";
  if (param.required && empty) {
    return `${param.label ?? param.name} is required`;
  }
  if (empty) return null;

  switch (param.type) {
    case "number": {
      const n = value as number;
      if (typeof n !== "number" || isNaN(n)) return "Must be a number";
      if (param.min !== undefined && n < param.min) return `Min ${param.min}`;
      if (param.max !== undefined && n > param.max) return `Max ${param.max}`;
      return null;
    }
    case "integer": {
      const n = value as number;
      if (typeof n !== "number" || isNaN(n)) return "Must be a number";
      if (!Number.isInteger(n)) return "Must be a whole number";
      if (param.min !== undefined && n < param.min) return `Min ${param.min}`;
      if (param.max !== undefined && n > param.max) return `Max ${param.max}`;
      return null;
    }
    case "select": {
      if (param.allowCustom) return null;
      const v = value as string;
      const valid = param.options.some((o) => o.value === v);
      if (!valid) return "Invalid selection";
      return null;
    }
    case "tags": {
      if (!Array.isArray(value)) return null;
      if (param.max !== undefined && value.length > param.max) {
        return `Max ${param.max} tags`;
      }
      return null;
    }
    default:
      return null;
  }
}

/** Validate all params against a schema. Returns map of paramName -> error. */
export function validateParams(
  params: ParamDefinition[],
  values: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const param of params) {
    const error = validateParam(param, values[param.name]);
    if (error) errors[param.name] = error;
  }
  return errors;
}
