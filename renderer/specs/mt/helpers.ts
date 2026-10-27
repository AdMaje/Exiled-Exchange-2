export type MessageTree = Record<string, unknown>;

function isTree(value: unknown): value is MessageTree {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Flatten nested i18n messages into `dotted.key -> string`. */
export function flattenMessages(
  value: unknown,
  prefix = "",
): Map<string, string> {
  const result = new Map<string, string>();
  if (!isTree(value)) return result;

  for (const [key, entry] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof entry === "string") {
      result.set(path, entry);
    } else {
      for (const [nestedKey, nestedValue] of flattenMessages(entry, path)) {
        result.set(nestedKey, nestedValue);
      }
    }
  }

  return result;
}

export function getMessage(value: unknown, path: string): unknown {
  let current: unknown = value;
  for (const key of path.split(".")) {
    if (!isTree(current)) return undefined;
    current = current[key];
  }
  return current;
}
