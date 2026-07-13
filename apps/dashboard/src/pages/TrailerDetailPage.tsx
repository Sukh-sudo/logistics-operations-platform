import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Container, Package, Truck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Timeline } from '../components/timeline/Timeline';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/ViewStates';
import { toTrailerTimelineItem } from '../features/trailers/trailerTimeline';
import { trailerApi } from '../services/trailer.api';

const formatTimestamp = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export function TrailerDetailPage() {
  const { trailerBarcode = '' } = useParams();
  const detail = useQuery({ queryKey: ['trailer', trailerBarcode], enabled: Boolean(trailerBarcode), retry: false, queryFn: async () => {
    // Compose snapshot read models and immutable history without deriving current state in the UI.
    const [snapshot, containers, packages, history] = await Promise.all([trailerApi.snapshot(trailerBarcode), trailerApi.containers(trailerBarcode), trailerApi.packages(trailerBarcode), trailerApi.history(trailerBarcode)]);
    return { snapshot, containers, packages, history };
  }});
  if (detail.isLoading) return <LoadingState/>;
  if (detail.isError) return <ErrorState message={axios.isAxiosError(detail.error) && detail.error.response?.status === 404 ? 'Trailer not found.' : 'The trailer record could not be loaded.'}/>;
  if (!detail.data) return <ErrorState message="The trailer record could not be loaded."/>;
  const { snapshot, containers, packages, history } = detail.data;
  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-brand-600">Trailer visibility</p><h2 className="mt-1 text-2xl font-semibold text-slate-900">{snapshot.trailerBarcode}</h2><p className="mt-2 text-sm text-slate-500">Current load, manifest, location, and immutable trailer history.</p></div><StatusBadge value={snapshot.currentStatus}/></div>
    <section className="rounded-2xl border bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><Truck className="h-5 w-5 text-brand-700"/><h3 className="font-semibold">Trailer snapshot</h3></div><dl className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><Fact label="Containers" value={snapshot.containerCount}/><Fact label="Loose packages" value={snapshot.packageCount}/><Fact label="Current terminal" value={snapshot.currentTerminalId ?? '—'}/><Fact label="Last updated" value={formatTimestamp(snapshot.updatedAt)}/></dl></section>
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><Header title="Containers" subtitle={`${containers.containerCount} currently assigned`}/>{containers.containers.length ? <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-6 py-4">Barcode</th><th>Packages</th><th>Status</th></tr></thead><tbody className="divide-y">{containers.containers.map(item => <tr key={item.id}><td className="px-6 py-4"><Link className="font-semibold text-brand-700" to={`/containers/${encodeURIComponent(item.containerBarcode)}`}>{item.containerBarcode}</Link></td><td>{item.packageCount}</td><td><StatusBadge value={item.currentStatus}/></td></tr>)}</tbody></table> : <EmptyState label="No containers assigned"/>}</section>
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><Header title="Package manifest" subtitle={`${packages.packageCount} packages across the trailer load`}/>{packages.packages.length ? <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-6 py-4">Tracking number</th><th>Location</th><th>Container</th><th>Status</th></tr></thead><tbody className="divide-y">{packages.packages.map(item => <tr key={item.trackingNumber}><td className="px-6 py-4"><Link className="font-semibold text-brand-700" to={`/packages/${encodeURIComponent(item.trackingNumber)}`}>{item.trackingNumber}</Link></td><td className="inline-flex items-center gap-2 py-4">{item.location === 'LOOSE' ? <Package className="h-4 w-4"/> : <Container className="h-4 w-4"/>}{item.location}</td><td>{item.containerBarcode ?? '—'}</td><td><StatusBadge value={item.currentStatus}/></td></tr>)}</tbody></table> : <EmptyState label="No packages assigned"/>}</section>
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><Header title="Trailer history" subtitle={`Oldest to newest — ${history.length} events`}/>{history.length ? <Timeline entries={history.map(toTrailerTimelineItem)}/> : <EmptyState label="No trailer events recorded"/>}</section>
  </div>;
}
function Header({ title, subtitle }: { title: string; subtitle: string }) { return <div className="border-b px-6 py-5"><h3 className="font-semibold text-slate-900">{title}</h3><p className="mt-1 text-xs text-slate-400">{subtitle}</p></div>; }
function Fact({ label, value }: { label: string; value: string | number }) { return <div><dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{value}</dd></div>; }
