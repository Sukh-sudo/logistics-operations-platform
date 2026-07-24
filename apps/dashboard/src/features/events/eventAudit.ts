/**
 * Event payloads are intentionally schema-flexible. Keep the audit rendering
 * compact while preserving the immutable data support teams need to inspect.
 */
export function formatEventData(label: string, value: unknown) {
  if (value == null) return null;
  try {
    const serialized = JSON.stringify(value);
    return `${label} ${serialized.length > 180 ? `${serialized.slice(0, 177)}...` : serialized}`;
  } catch {
    return `${label} unavailable`;
  }
}
