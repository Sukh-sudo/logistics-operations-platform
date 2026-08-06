import type { ContainerStatus, DashboardContainerDto } from '@logistics/shared-types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AssetLaneFilterBar } from '../components/filters/AssetLaneFilterBar';
import { AssetListTable, type AssetListColumn } from '../components/tables/AssetListTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { emptyAssetLaneFilters, toAssetLaneQuery, type AssetLaneFilters } from '../features/assets/assetLaneFilters';
import { dashboardApi } from '../services/dashboard.api';

const containerStatuses: ContainerStatus[] = ['OPEN', 'CLOSED'];

const columns: AssetListColumn<DashboardContainerDto>[] = [
  { header: 'Container', render: (container) => <Link className="font-semibold text-brand-700 hover:text-brand-900" to={`/containers/${encodeURIComponent(container.containerBarcode)}`}>{container.containerBarcode}</Link> },
  { header: 'Status', render: (container) => <StatusBadge value={container.status}/> },
  { header: 'Packages', render: (container) => container.packageCount.toLocaleString() },
  { header: 'Assigned trailer', render: (container) => container.assignedTrailer ? <Link className="font-medium text-brand-700 hover:text-brand-900" to={`/trailers/${encodeURIComponent(container.assignedTrailer)}`}>{container.assignedTrailer}</Link> : <span className="text-slate-400">Unassigned</span> },
];

export function ContainerListPage() {
  const [filters, setFilters] = useState<AssetLaneFilters<ContainerStatus>>(emptyAssetLaneFilters);
  const query = toAssetLaneQuery(filters);
  // Container totals and assignments come from disposable ContainerSnapshot read models.
  const containers = useQuery({ queryKey: ['dashboard', 'containers', query], queryFn: () => dashboardApi.containers(query), placeholderData: keepPreviousData });
  const terminals = useQuery({ queryKey: ['dashboard', 'terminals'], queryFn: dashboardApi.terminals });
  const activeFilters = Object.values(filters).some(Boolean);

  return <AssetListTable
    eyebrow="Warehouse operations"
    title="Container visibility"
    description="Review current container utilization and trailer assignments. Date filters use the latest snapshot update."
    searchLabel="Filter containers by barcode, status, or trailer"
    columns={columns}
    assets={containers.data ?? []}
    isLoading={containers.isLoading}
    isError={containers.isError}
    rowKey={(container) => container.containerBarcode}
    searchableValues={(container) => [container.containerBarcode, container.status, container.assignedTrailer]}
    emptyLabel={activeFilters ? 'No containers match these filters' : 'No container snapshots found'}
    errorLabel="Container snapshots could not be loaded."
    filters={<AssetLaneFilterBar filters={filters} terminals={terminals.data ?? []} statuses={containerStatuses} statusLabel="Container status" onChange={setFilters} onClear={() => setFilters(emptyAssetLaneFilters())}/>}
  />;
}
