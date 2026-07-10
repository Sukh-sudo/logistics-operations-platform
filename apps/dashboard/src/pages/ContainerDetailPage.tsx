import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Boxes, Container, MapPin, Truck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Timeline } from '../components/timeline/Timeline';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/ViewStates';
import { toContainerTimelineItem } from '../features/containers/containerTimeline';
import { containerApi } from '../services/container.api';

const formatTimestamp = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const valueOrDash = (value: string | number | null) => value == null ? '-' : String(value);

export function ContainerDetailPage() {
  const { containerBarcode = '' } = useParams();
  const detail = useQuery({
    queryKey: ['container', containerBarcode], enabled: Boolean(containerBarcode), retry: false,
    // These reads compose the current snapshot, contained packages, and immutable event history.
    queryFn: async () => { const [snapshot, packageList, history] = await Promise.all([containerApi.snapshot(containerBarcode), containerApi.packages(containerBarcode), containerApi.history(containerBarcode)]); return { snapshot, packageList, history }; },
  });

  if (detail.isLoading) return <LoadingState/>;
  if (detail.isError) return <ErrorState message={axios.isAxiosError(detail.error) && detail.error.response?.status === 404 ? 'Container not found.' : 'The container record could not be loaded.'}/>;
  if (!detail.data) return <ErrorState message="The container record could not be loaded."/>;
  const { snapshot, packageList, history } = detail.data;

  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium text-brand-600">Container visibility</p><h2 className="mt-1 text-2xl font-semibold text-slate-900">{snapshot.containerBarcode}</h2><p className="mt-2 text-sm text-slate-500">Current snapshot, assigned packages, trailer assignment, and immutable container history.</p></div><StatusBadge value={snapshot.currentStatus}/></div>
    <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
      <section className="rounded-2xl border bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Container className="h-5 w-5"/></div><h3 className="font-semibold text-slate-900">Container snapshot</h3></div><dl className="mt-6 grid gap-5 sm:grid-cols-2"><Fact label="Package type" value={snapshot.packageType.replaceAll('_', ' ')}/><Fact label="Package count" value={String(snapshot.packageCount)}/><Fact label="Current terminal" value={valueOrDash(snapshot.currentTerminalId)}/><Fact label="Last updated" value={formatTimestamp(snapshot.updatedAt)}/><Fact label="Snapshot ID" value={snapshot.id}/></dl></section>
      <section className="rounded-2xl border bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-sky-700"><MapPin className="h-5 w-5"/></div><div><h3 className="font-semibold text-slate-900">Assignment</h3><p className="text-xs text-slate-400">Where this container is staged or moving</p></div></div><div className="mt-6 space-y-3"><AssignmentRow icon={Truck} label="Trailer snapshot" value={snapshot.currentTrailerId}/><div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4"><Boxes className="h-5 w-5 text-slate-400"/><div><p className="text-xs text-slate-400">Contained packages</p><p className="mt-0.5 text-sm font-medium text-slate-700">{packageList.packageCount} package{packageList.packageCount === 1 ? '' : 's'}</p></div></div></div></section>
    </div>
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b px-6 py-5"><h3 className="font-semibold text-slate-900">Packages</h3><p className="mt-1 text-xs text-slate-400">Snapshot read model sorted by tracking number</p></div>{packageList.packages.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-6 py-4">Tracking number</th><th>Type</th><th>Status</th><th>Terminal</th><th>Trailer</th></tr></thead><tbody className="divide-y">{packageList.packages.map((pkg) => <tr key={pkg.id}><td className="px-6 py-4"><Link className="font-semibold text-brand-700 hover:text-brand-900" to={`/packages/${encodeURIComponent(pkg.trackingNumber)}`}>{pkg.trackingNumber}</Link></td><td>{pkg.packageType.replaceAll('_', ' ')}</td><td><StatusBadge value={pkg.currentStatus}/></td><td>{valueOrDash(pkg.currentTerminalId)}</td><td>{valueOrDash(pkg.currentTrailerId)}</td></tr>)}</tbody></table></div> : <EmptyState label="No packages are currently assigned to this container"/>}</section>
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b px-6 py-5"><h3 className="font-semibold text-slate-900">Container history</h3><p className="mt-1 text-xs text-slate-400">Oldest to newest - {history.length} events</p></div>{history.length ? <Timeline entries={history.map(toContainerTimelineItem)}/> : <EmptyState label="No container events recorded"/>}</section>
  </div>;
}

function Fact({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 break-all text-sm font-semibold text-slate-800">{value}</dd></div>; }
function AssignmentRow({ icon: Icon, label, value }: { icon: typeof Truck; label: string; value: string | null }) { return <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4"><Icon className="h-5 w-5 text-slate-400"/><div><p className="text-xs text-slate-400">{label}</p><p className="mt-0.5 break-all text-sm font-medium text-slate-700">{value ?? 'Not assigned'}</p></div></div>; }
