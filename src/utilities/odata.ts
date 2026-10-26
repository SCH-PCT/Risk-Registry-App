/**
 * OData value escaping and small query-fragment builders.
 *
 * Every raw value placed into a `$filter` must pass through here. A single
 * unescaped quote in a value that reaches `$filter` unmodified is a query
 * injection — low-severity against SharePoint's own OData parser, but still
 * a correctness and security bug worth eliminating at one chokepoint.
 */

/**
 * Escapes a string for safe use inside an OData `$filter` string literal.
 *
 * OData escapes a single quote by doubling it (`'` → `''`), the same rule
 * SQL uses for string literals. This is the only transformation needed;
 * nothing here attempts to strip or reinterpret the value.
 */
export function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

/** Wraps an already-escaped string in the quotes OData string literals require. */
export function toODataStringLiteral(value: string): string {
  return `'${escapeODataString(value)}'`;
}

/**
 * Builds an `Id eq A or Id eq B or ...` fragment for a batch of numeric IDs.
 *
 * Numeric IDs never need quoting or escaping — `Number.isInteger` is the
 * validation, not string escaping — but the fragment still has to be built
 * safely, since a caller passing a non-integer here (a bug, not user input)
 * must fail loudly rather than produce a malformed filter silently accepted
 * by the server.
 */
export function buildIdInFilter(fieldInternalName: string, ids: readonly number[]): string {
  if (ids.length === 0) {
    throw new Error('buildIdInFilter requires at least one id.');
  }

  const clauses = ids.map((id) => {
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(`buildIdInFilter received a non-positive-integer id: ${String(id)}`);
    }
    return `${fieldInternalName} eq ${id}`;
  });

  return clauses.join(' or ');
}

/**
 * Splits an array of IDs into chunks no larger than `chunkSize`, for batched
 * hydration requests that stay under SharePoint's filter-complexity limits.
 */
export function chunkIds(ids: readonly number[], chunkSize: number): number[][] {
  if (chunkSize <= 0) {
    throw new Error('chunkIds requires a positive chunkSize.');
  }

  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize));
  }
  return chunks;
}
