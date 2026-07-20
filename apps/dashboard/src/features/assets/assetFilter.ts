/**
 * Filters snapshot-backed asset rows using the text operators see in the table.
 * Keeping this logic independent from React makes the matching rules easy to test.
 */
export function filterAssets<T>(
  assets: T[],
  query: string,
  searchableValues: (asset: T) => Array<string | null | undefined>,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (!normalizedQuery) {
    return assets;
  }

  return assets.filter((asset) =>
    searchableValues(asset).some((value) =>
      value?.toLocaleLowerCase().includes(normalizedQuery),
    ),
  );
}
