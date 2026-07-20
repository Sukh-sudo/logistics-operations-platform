import { Search, X } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../ui/ViewStates';
import { filterAssets } from '../../features/assets/assetFilter';

export interface AssetListColumn<T> {
  header: string;
  render: (asset: T) => ReactNode;
}

interface AssetListTableProps<T> {
  eyebrow: string;
  title: string;
  description: string;
  searchLabel: string;
  columns: AssetListColumn<T>[];
  assets: T[];
  isLoading: boolean;
  isError: boolean;
  rowKey: (asset: T) => string;
  searchableValues: (asset: T) => Array<string | null | undefined>;
  emptyLabel: string;
  errorLabel: string;
}

/** Shared snapshot-list presentation keeps all three operational asset pages consistent. */
export function AssetListTable<T>({
  eyebrow,
  title,
  description,
  searchLabel,
  columns,
  assets,
  isLoading,
  isError,
  rowKey,
  searchableValues,
  emptyLabel,
  errorLabel,
}: AssetListTableProps<T>) {
  const [query, setQuery] = useState('');
  const visibleAssets = useMemo(
    () => filterAssets(assets, query, searchableValues),
    [assets, query, searchableValues],
  );

  return <div className="mx-auto max-w-7xl space-y-6">
    <div>
      <p className="text-sm font-medium text-brand-600">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-slate-500">{description}</p>
    </div>

    <label className="relative block max-w-lg">
      <span className="sr-only">{searchLabel}</span>
      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400"/>
      <input
        aria-label={searchLabel}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={searchLabel}
        className="h-10 w-full rounded-xl border bg-white pl-10 pr-10 text-sm text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      {query && <button type="button" aria-label="Clear asset filter" onClick={() => setQuery('')} className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4"/></button>}
    </label>

    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      {isLoading ? <LoadingState/> : isError ? <ErrorState message={errorLabel}/> : <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{columns.map((column, index) => <th key={column.header} className={index === 0 ? 'px-6 py-4' : 'py-4 pr-6'}>{column.header}</th>)}</tr></thead>
          <tbody className="divide-y">{visibleAssets.map((asset) => <tr key={rowKey(asset)}>{columns.map((column, index) => <td key={column.header} className={index === 0 ? 'px-6 py-4' : 'py-4 pr-6'}>{column.render(asset)}</td>)}</tr>)}</tbody>
        </table>
        {visibleAssets.length === 0 && <EmptyState label={query ? 'No assets match this filter' : emptyLabel}/>} 
      </div>}
    </section>
  </div>;
}
