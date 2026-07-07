import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Box, Container, MapPin, PackageSearch, Truck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Timeline } from '../components/timeline/Timeline';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/ViewStates';
import { toPackageTimelineItem } from '../features/packages/packageTimeline';
import { packageApi } from '../services/package.api';

export function PackageDetailPage() {
  const { trackingNumber = '' } = useParams();
  const detail = useQuery({
    queryKey: ['package', trackingNumber], enabled: Boolean(trackingNumber), retry: false,
    // These independent read endpoints describe one event-derived package projection.
    queryFn: async () => { const [snapshot, location, history] = await Promise.all([packageApi.snapshot(trackingNumber), packageApi.location(trackingNumber), packageApi.history(trackingNumber)]); return { snapshot, location, history }; },
  });

  if (detail.isLoading) return <LoadingState/>;
  if (detail.isError) return <ErrorState message={axios.isAxiosError(detail.error) && detail.error.response?.status === 404 ? 'Package not found.' : 'The package record could not be loaded.'}/>;
  if (!detail.data) return <ErrorState message="The package record could not be loaded."/>;
  const { snapshot, location, history } = detail.data;

  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium text-brand-600">Package visibility</p><h2 className="mt-1 text-2xl font-semibold text-slate-900">{snapshot.trackingNumber}</h2><p className="mt-2 text-sm text-slate-500">Current snapshot, resolved location, and immutable lifecycle history.</p></div><StatusBadge value={snapshot.currentStatus}/></div>
    <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
      <section className="rounded-2xl border bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><PackageSearch className="h-5 w-5"/></div><h3 className="font-semibold text-slate-900">Package snapshot</h3></div><dl className="mt-6 grid gap-5 sm:grid-cols-2"><Fact label="Package type" value={snapshot.packageType.replaceAll('_', ' ')}/><Fact label="Current terminal" value={snapshot.currentTerminalId == null ? '—' : String(snapshot.currentTerminalId)}/><Fact label="Last updated" value={new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(snapshot.updatedAt))}/><Fact label="Snapshot ID" value={snapshot.id}/></dl></section>
      <section className="rounded-2xl border bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-sky-700"><MapPin className="h-5 w-5"/></div><div><h3 className="font-semibold text-slate-900">Current location</h3><p className="text-xs text-slate-400">Where this package is right now</p></div></div><div className="mt-6 space-y-3"><LocationRow icon={Container} label="Container" value={location.containerBarcode} path="containers"/><LocationRow icon={Truck} label="Trailer" value={location.trailerBarcode} path="trailers"/><div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4"><Box className="h-5 w-5 text-slate-400"/><div><p className="text-xs text-slate-400">Operational status</p><p className="mt-0.5 text-sm font-medium text-slate-700">{location.currentStatus.replaceAll('_', ' ')}</p></div></div></div></section>
    </div>
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b px-6 py-5"><h3 className="font-semibold text-slate-900">Lifecycle history</h3><p className="mt-1 text-xs text-slate-400">Oldest to newest · {history.length} events</p></div>{history.length ? <Timeline entries={history.map(toPackageTimelineItem)}/> : <EmptyState label="No lifecycle events recorded"/>}</section>
  </div>;
}

function Fact({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 break-all text-sm font-semibold text-slate-800">{value}</dd></div>; }
function LocationRow({ icon: Icon, label, value, path }: { icon: typeof Container; label: string; value: string | null; path: string }) { return <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-4"><div className="flex items-center gap-3"><Icon className="h-5 w-5 text-slate-400"/><div><p className="text-xs text-slate-400">{label}</p><p className="mt-0.5 text-sm font-medium text-slate-700">{value ?? 'Not assigned'}</p></div></div>{value && <Link className="focus-ring rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-white" to={`/${path}/${encodeURIComponent(value)}`}>Open</Link>}</div>; }
