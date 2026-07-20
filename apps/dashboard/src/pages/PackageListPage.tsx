import type { DashboardPackageDto } from '@logistics/shared-types';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AssetListTable, type AssetListColumn } from '../components/tables/AssetListTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { dashboardApi } from '../services/dashboard.api';

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
  // This endpoint reads PackageSnapshot records; lifecycle history remains in immutable events.
  const packages = useQuery({ queryKey: ['dashboard', 'packages'], queryFn: dashboardApi.packages });

  return <AssetListTable
    eyebrow="Warehouse operations"
    title="Package visibility"
    description="Find each package's current status and snapshot-derived location."
    searchLabel="Filter packages by tracking number, status, container, or trailer"
    columns={columns}
    assets={packages.data ?? []}
    isLoading={packages.isLoading}
    isError={packages.isError}
    rowKey={(pkg) => pkg.trackingNumber}
    searchableValues={(pkg) => [pkg.trackingNumber, pkg.status, pkg.containerBarcode, pkg.trailerBarcode]}
    emptyLabel="No package snapshots found"
    errorLabel="Package snapshots could not be loaded."
  />;
}
