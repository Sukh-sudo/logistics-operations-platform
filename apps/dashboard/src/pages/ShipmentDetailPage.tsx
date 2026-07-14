import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { CheckCircle2, MapPinned, PackageCheck, PackageOpen } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Timeline } from '../components/timeline/Timeline';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/ViewStates';
import { toShipmentTimelineItem } from '../features/shipments/shipmentTimeline';
import { clampProgress } from '../features/trips/tripProgress';
import { shipmentApi } from '../services/shipment.api';

const timestamp = (value?: string | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';

export function ShipmentDetailPage() {
  const { shipmentId = '' } = useParams();
  const detail = useQuery({ queryKey: ['shipment', shipmentId], enabled: Boolean(shipmentId), retry: false, queryFn: async () => {
    // The snapshot supplies progress; package membership and immutable events remain separate reads.
    const [shipment, packages, history] = await Promise.all([shipmentApi.detail(shipmentId), shipmentApi.packages(shipmentId), shipmentApi.history(shipmentId)]);
    return { shipment, packages, history };
  }});
  if (detail.isLoading) return <LoadingState/>;
  if (detail.isError) return <ErrorState message={axios.isAxiosError(detail.error) && detail.error.response?.status === 404 ? 'Shipment not found.' : 'The shipment record could not be loaded.'}/>;
  if (!detail.data) return <ErrorState message="The shipment record could not be loaded."/>;
  const { shipment, packages, history } = detail.data;
  const snapshot = shipment.snapshot;
  const progress = clampProgress(snapshot?.progressPercent);
  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium text-brand-600">Customer shipment</p><h2 className="mt-1 text-2xl font-semibold text-slate-900">{shipment.shipmentNumber}</h2><p className="mt-2 text-slate-500">Reference {shipment.referenceNumber ?? 'not provided'}</p></div><StatusBadge value={snapshot?.currentStatus ?? shipment.status}/></div>
    <div className="grid gap-4 sm:grid-cols-3"><Metric icon={PackageOpen} label="Packages" value={snapshot?.packageCount ?? packages.length}/><Metric icon={CheckCircle2} label="Delivered" value={snapshot?.deliveredPackages ?? 0}/><Metric icon={PackageCheck} label="Remaining" value={snapshot?.remainingPackages ?? packages.length}/></div>
    <section className="rounded-2xl border bg-white p-6 shadow-sm"><div className="flex items-center justify-between text-sm"><span className="font-medium text-slate-700">Delivery progress</span><span className="font-semibold text-brand-700">{progress}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${progress}%` }}/></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><TerminalLink label="Origin terminal" id={shipment.originTerminalId} code={shipment.originTerminal.terminalCode} name={shipment.originTerminal.name}/><TerminalLink label="Destination terminal" id={shipment.destinationTerminalId} code={shipment.destinationTerminal.terminalCode} name={shipment.destinationTerminal.name}/></div><p className="mt-5 text-xs text-slate-400">Last snapshot activity: {timestamp(snapshot?.lastActivityAt)}</p></section>
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><Header title="Shipment packages" subtitle={`${packages.length} assigned packages`}/>{packages.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-6 py-4">Tracking number</th><th>Type</th><th>Current terminal</th><th>Status</th></tr></thead><tbody className="divide-y">{packages.map(item => <tr key={item.id}><td className="px-6 py-4"><Link className="font-semibold text-brand-700 hover:text-brand-900" to={`/packages/${encodeURIComponent(item.trackingNumber)}`}>{item.trackingNumber}</Link></td><td>{item.packageType.replaceAll('_', ' ')}</td><td>{item.currentTerminalId ?? '—'}</td><td><StatusBadge value={item.currentStatus}/></td></tr>)}</tbody></table></div> : <EmptyState label="No packages assigned to this shipment"/>}</section>
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><Header title="Shipment history" subtitle={`Oldest to newest — ${history.length} events`}/>{history.length ? <Timeline entries={history.map(toShipmentTimelineItem)}/> : <EmptyState label="No shipment events recorded"/>}</section>
  </div>;
}
function Metric({ icon: Icon, label, value }: { icon: typeof PackageOpen; label: string; value: number }) { return <section className="rounded-2xl border bg-white p-5 shadow-sm"><Icon className="h-5 w-5 text-brand-700"/><p className="mt-4 text-2xl font-semibold text-slate-900">{value}</p><p className="text-xs text-slate-500">{label}</p></section>; }
function Header({ title, subtitle }: { title: string; subtitle: string }) { return <div className="border-b px-6 py-5"><h3 className="font-semibold text-slate-900">{title}</h3><p className="mt-1 text-xs text-slate-400">{subtitle}</p></div>; }
function TerminalLink({ label, id, code, name }: { label: string; id: number; code: string; name: string }) { return <Link to={`/terminals/${id}`} className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 hover:bg-slate-100"><MapPinned className="h-5 w-5 text-brand-700"/><div><p className="text-xs text-slate-400">{label}</p><p className="mt-0.5 text-sm font-semibold text-slate-800">{code} — {name}</p></div></Link>; }
