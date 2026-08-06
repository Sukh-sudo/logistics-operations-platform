import type { DashboardPackageDto, PackageStatus } from '@logistics/shared-types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AssetListTable, type AssetListColumn } from '../components/tables/AssetListTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { emptyPackageListFilters, toPackageListQuery, type PackageListFilters } from '../features/packages/packageListFilters';
import { dashboardApi } from '../services/dashboard.api';

const packageStatuses: PackageStatus[] = ['RECEIVED', 'SORTED', 'IN_CONTAINER', 'IN_TRAILER', 'DEPARTED', 'ARRIVED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'ATTEMPTED_DELIVERY', 'DAMAGED', 'MISROUTED', 'RETURNED_TO_TERMINAL'];
const label = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/(^|\s)\S/g, character => character.toUpperCase());

const locationLink = (path: string, value: string | null) => value
  ? <Link className="font-medium text-brand-700 hover:text-brand-900" to={`/${path}/${encodeURIComponent(value)}`}>{value}</Link>
  : <span className="text-slate-400">Unassigned</span>;

const columns: AssetListColumn<DashboardPackageDto>[] = [
  { header: 'Tracking number', render: (pkg) => <Link className="font-semibold text-brand-700 hover:text-brand-900" to={`/packages/${encodeURIComponent(pkg.trackingNumber)}`}>{pkg.trackingNumber}</Link> },
  { header: 'Status', render: (pkg) => <StatusBadge value={pkg.status}/> },
  { header: 'Container', render: (pkg) => locationLink('containers', pkg.containerBarcode) },
  { header: 'Trailer', render: (pkg) => locationLink('trailers', pkg.trailerBarcode) },
];

export function PackageListPage() {
  const [filters, setFilters] = useState<PackageListFilters>(emptyPackageListFilters);
  const query = toPackageListQuery(filters);
  // This endpoint reads PackageSnapshot records; lifecycle history remains in immutable events.
  const packages = useQuery({ queryKey: ['dashboard', 'packages', query], queryFn: () => dashboardApi.packages(query), placeholderData: keepPreviousData });
  const terminals = useQuery({ queryKey: ['dashboard', 'terminals'], queryFn: dashboardApi.terminals });
  const activeFilters = Object.values(filters).some(Boolean);
  const setFilter = (key: keyof PackageListFilters) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters(current => ({ ...current, [key]: event.target.value }));
  };

  const filterControls = <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4 shadow-sm">
    <div className="mr-1 flex h-10 items-center gap-2 text-sm font-medium text-slate-600"><SlidersHorizontal className="h-4 w-4"/>Filters</div>
    <label className="text-xs font-medium text-slate-500">From<input aria-label="From date" type="date" max={filters.toDate || undefined} value={filters.fromDate} onChange={setFilter('fromDate')} className="mt-1 block h-10 rounded-lg border bg-white px-3 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"/></label>
    <label className="text-xs font-medium text-slate-500">To<input aria-label="To date" type="date" min={filters.fromDate || undefined} value={filters.toDate} onChange={setFilter('toDate')} className="mt-1 block h-10 rounded-lg border bg-white px-3 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"/></label>
    <label className="text-xs font-medium text-slate-500">Origin<select aria-label="Origin terminal" value={filters.originTerminalId} onChange={setFilter('originTerminalId')} className="mt-1 block h-10 min-w-44 rounded-lg border bg-white px-3 text-sm text-slate-700"><option value="">All origins</option>{terminals.data?.map(terminal => <option key={terminal.id} value={terminal.id}>{terminal.name}</option>)}</select></label>
    <label className="text-xs font-medium text-slate-500">Destination<select aria-label="Destination terminal" value={filters.destinationTerminalId} onChange={setFilter('destinationTerminalId')} className="mt-1 block h-10 min-w-44 rounded-lg border bg-white px-3 text-sm text-slate-700"><option value="">All destinations</option>{terminals.data?.map(terminal => <option key={terminal.id} value={terminal.id}>{terminal.name}</option>)}</select></label>
    <label className="text-xs font-medium text-slate-500">Status<select aria-label="Package status" value={filters.status} onChange={setFilter('status')} className="mt-1 block h-10 min-w-44 rounded-lg border bg-white px-3 text-sm text-slate-700"><option value="">All statuses</option>{packageStatuses.map(status => <option key={status} value={status}>{label(status)}</option>)}</select></label>
    {activeFilters && <button type="button" onClick={() => setFilters(emptyPackageListFilters)} className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"><X className="h-4 w-4"/>Clear</button>}
  </div>;

  return <AssetListTable
    eyebrow="Warehouse operations"
    title="Package visibility"
    description="Find each package's current status and snapshot-derived location. Date filters use the latest snapshot update."
    searchLabel="Filter packages by tracking number, status, container, or trailer"
    columns={columns}
    assets={packages.data ?? []}
    isLoading={packages.isLoading}
    isError={packages.isError}
    rowKey={(pkg) => pkg.trackingNumber}
    searchableValues={(pkg) => [pkg.trackingNumber, pkg.status, pkg.containerBarcode, pkg.trailerBarcode]}
    emptyLabel={activeFilters ? 'No packages match these filters' : 'No package snapshots found'}
    errorLabel="Package snapshots could not be loaded."
    filters={filterControls}
  />;
}
