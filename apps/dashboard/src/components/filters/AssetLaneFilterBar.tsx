import type { DashboardTerminalOptionDto } from '@logistics/shared-types';
import { SlidersHorizontal, X } from 'lucide-react';
import type { AssetLaneFilters } from '../../features/assets/assetLaneFilters';

interface AssetLaneFilterBarProps<S extends string> {
  filters: AssetLaneFilters<S>;
  terminals: DashboardTerminalOptionDto[];
  statuses: readonly S[];
  statusLabel: string;
  onChange: (filters: AssetLaneFilters<S>) => void;
  onClear: () => void;
}

const label = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/(^|\s)\S/g, character => character.toUpperCase());

export function AssetLaneFilterBar<S extends string>({ filters, terminals, statuses, statusLabel, onChange, onClear }: AssetLaneFilterBarProps<S>) {
  const active = Object.values(filters).some(Boolean);
  const setFilter = (key: keyof AssetLaneFilters<S>) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    onChange({ ...filters, [key]: event.target.value });
  };

  return <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4 shadow-sm">
    <div className="mr-1 flex h-10 items-center gap-2 text-sm font-medium text-slate-600"><SlidersHorizontal className="h-4 w-4"/>Filters</div>
    <label className="text-xs font-medium text-slate-500">From<input aria-label="From date" type="date" max={filters.toDate || undefined} value={filters.fromDate} onChange={setFilter('fromDate')} className="mt-1 block h-10 rounded-lg border bg-white px-3 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"/></label>
    <label className="text-xs font-medium text-slate-500">To<input aria-label="To date" type="date" min={filters.fromDate || undefined} value={filters.toDate} onChange={setFilter('toDate')} className="mt-1 block h-10 rounded-lg border bg-white px-3 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"/></label>
    <label className="text-xs font-medium text-slate-500">Origin<select aria-label="Origin terminal" value={filters.originTerminalId} onChange={setFilter('originTerminalId')} className="mt-1 block h-10 min-w-44 rounded-lg border bg-white px-3 text-sm text-slate-700"><option value="">All origins</option>{terminals.map(terminal => <option key={terminal.id} value={terminal.id}>{terminal.name}</option>)}</select></label>
    <label className="text-xs font-medium text-slate-500">Destination<select aria-label="Destination terminal" value={filters.destinationTerminalId} onChange={setFilter('destinationTerminalId')} className="mt-1 block h-10 min-w-44 rounded-lg border bg-white px-3 text-sm text-slate-700"><option value="">All destinations</option>{terminals.map(terminal => <option key={terminal.id} value={terminal.id}>{terminal.name}</option>)}</select></label>
    <label className="text-xs font-medium text-slate-500">Status<select aria-label={statusLabel} value={filters.status} onChange={setFilter('status')} className="mt-1 block h-10 min-w-44 rounded-lg border bg-white px-3 text-sm text-slate-700"><option value="">All statuses</option>{statuses.map(status => <option key={status} value={status}>{label(status)}</option>)}</select></label>
    {active && <button type="button" onClick={onClear} className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"><X className="h-4 w-4"/>Clear</button>}
  </div>;
}
