import type { DashboardContainerDto } from '@logistics/shared-types';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AssetListTable, type AssetListColumn } from '../components/tables/AssetListTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { dashboardApi } from '../services/dashboard.api';

const columns: AssetListColumn<DashboardContainerDto>[] = [
  { header: 'Container', render: (container) => <Link className="font-semibold text-brand-700 hover:text-brand-900" to={`/containers/${encodeURIComponent(container.containerBarcode)}`}>{container.containerBarcode}</Link> },
  { header: 'Status', render: (container) => <StatusBadge value={container.status}/> },
  { header: 'Packages', render: (container) => container.packageCount.toLocaleString() },
  { header: 'Assigned trailer', render: (container) => container.assignedTrailer ? <Link className="font-medium text-brand-700 hover:text-brand-900" to={`/trailers/${encodeURIComponent(container.assignedTrailer)}`}>{container.assignedTrailer}</Link> : <span className="text-slate-400">Unassigned</span> },
];

export function ContainerListPage() {
  // Container totals and assignments come from disposable ContainerSnapshot read models.
  const containers = useQuery({ queryKey: ['dashboard', 'containers'], queryFn: dashboardApi.containers });

  return <AssetListTable
    eyebrow="Warehouse operations"
    title="Container visibility"
    description="Review current container utilization and trailer assignments."
    searchLabel="Filter containers by barcode, status, or trailer"
    columns={columns}
    assets={containers.data ?? []}
    isLoading={containers.isLoading}
    isError={containers.isError}
    rowKey={(container) => container.containerBarcode}
    searchableValues={(container) => [container.containerBarcode, container.status, container.assignedTrailer]}
    emptyLabel="No container snapshots found"
    errorLabel="Container snapshots could not be loaded."
  />;
}
