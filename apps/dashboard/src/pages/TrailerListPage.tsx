import type { DashboardTrailerDto, TrailerStatus } from '@logistics/shared-types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AssetLaneFilterBar } from '../components/filters/AssetLaneFilterBar';
import { AssetListTable, type AssetListColumn } from '../components/tables/AssetListTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { emptyAssetLaneFilters, toAssetLaneQuery, type AssetLaneFilters } from '../features/assets/assetLaneFilters';
import { dashboardApi } from '../services/dashboard.api';

const trailerStatuses: TrailerStatus[] = ['OPEN', 'CLOSED', 'IN_TRANSIT', 'ARRIVED'];

const columns: AssetListColumn<DashboardTrailerDto>[] = [
  { header: 'Trailer', render: (trailer) => <Link className="font-semibold text-brand-700 hover:text-brand-900" to={`/trailers/${encodeURIComponent(trailer.trailerBarcode)}`}>{trailer.trailerBarcode}</Link> },
  { header: 'Status', render: (trailer) => <StatusBadge value={trailer.status}/> },
  { header: 'Containers', render: (trailer) => trailer.containerCount.toLocaleString() },
  { header: 'Packages', render: (trailer) => trailer.packageCount.toLocaleString() },
];

export function TrailerListPage() {
  const [filters, setFilters] = useState<AssetLaneFilters<TrailerStatus>>(emptyAssetLaneFilters);
  const query = toAssetLaneQuery(filters);
  // Manifest counts are resolved from trailer, container, and package snapshots by the read API.
  const trailers = useQuery({ queryKey: ['dashboard', 'trailers', query], queryFn: () => dashboardApi.trailers(query), placeholderData: keepPreviousData });
  const terminals = useQuery({ queryKey: ['dashboard', 'terminals'], queryFn: dashboardApi.terminals });
  const activeFilters = Object.values(filters).some(Boolean);

  return <AssetListTable
    eyebrow="Yard operations"
    title="Trailer visibility"
    description="Monitor current trailer status and snapshot-derived freight totals. Date filters use the latest snapshot update."
    searchLabel="Filter trailers by barcode or status"
    columns={columns}
    assets={trailers.data ?? []}
    isLoading={trailers.isLoading}
    isError={trailers.isError}
    rowKey={(trailer) => trailer.trailerBarcode}
    searchableValues={(trailer) => [trailer.trailerBarcode, trailer.status]}
    emptyLabel={activeFilters ? 'No trailers match these filters' : 'No trailer snapshots found'}
    errorLabel="Trailer snapshots could not be loaded."
    filters={<AssetLaneFilterBar filters={filters} terminals={terminals.data ?? []} statuses={trailerStatuses} statusLabel="Trailer status" onChange={setFilters} onClear={() => setFilters(emptyAssetLaneFilters())}/>}
  />;
}
