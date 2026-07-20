import type { DashboardTrailerDto } from '@logistics/shared-types';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AssetListTable, type AssetListColumn } from '../components/tables/AssetListTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { dashboardApi } from '../services/dashboard.api';

const columns: AssetListColumn<DashboardTrailerDto>[] = [
  { header: 'Trailer', render: (trailer) => <Link className="font-semibold text-brand-700 hover:text-brand-900" to={`/trailers/${encodeURIComponent(trailer.trailerBarcode)}`}>{trailer.trailerBarcode}</Link> },
  { header: 'Status', render: (trailer) => <StatusBadge value={trailer.status}/> },
  { header: 'Containers', render: (trailer) => trailer.containerCount.toLocaleString() },
  { header: 'Packages', render: (trailer) => trailer.packageCount.toLocaleString() },
];

export function TrailerListPage() {
  // Manifest counts are resolved from trailer, container, and package snapshots by the read API.
  const trailers = useQuery({ queryKey: ['dashboard', 'trailers'], queryFn: dashboardApi.trailers });

  return <AssetListTable
    eyebrow="Yard operations"
    title="Trailer visibility"
    description="Monitor current trailer status and snapshot-derived freight totals."
    searchLabel="Filter trailers by barcode or status"
    columns={columns}
    assets={trailers.data ?? []}
    isLoading={trailers.isLoading}
    isError={trailers.isError}
    rowKey={(trailer) => trailer.trailerBarcode}
    searchableValues={(trailer) => [trailer.trailerBarcode, trailer.status]}
    emptyLabel="No trailer snapshots found"
    errorLabel="Trailer snapshots could not be loaded."
  />;
}
