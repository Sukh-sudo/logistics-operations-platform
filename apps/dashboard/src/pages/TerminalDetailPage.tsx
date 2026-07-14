import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Building2, Container, Package, Truck, Users } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Timeline } from '../components/timeline/Timeline';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/ViewStates';
import { toTerminalTimelineItem } from '../features/terminals/terminalTimeline';
import { terminalApi } from '../services/terminal.api';

const timestamp = (value?: string | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';

export function TerminalDetailPage() {
  const terminalId = Number(useParams().terminalId);
  const detail = useQuery({ queryKey: ['terminal', terminalId], enabled: Number.isInteger(terminalId) && terminalId > 0, retry: false, queryFn: async () => {
    // Compose snapshot read models and immutable history without recalculating ownership.
    const [terminal, inventory, operations, history] = await Promise.all([terminalApi.detail(terminalId), terminalApi.inventory(terminalId), terminalApi.operations(terminalId), terminalApi.history(terminalId)]);
    return { terminal, inventory, operations, history };
  }});
  if (!Number.isInteger(terminalId) || terminalId < 1) return <ErrorState message="Terminal identifier is invalid."/>;
  if (detail.isLoading) return <LoadingState/>;
  if (detail.isError) return <ErrorState message={axios.isAxiosError(detail.error) && detail.error.response?.status === 404 ? 'Terminal not found.' : 'The terminal workspace could not be loaded.'}/>;
  if (!detail.data) return <ErrorState message="The terminal workspace could not be loaded."/>;
  const { terminal, inventory, operations, history } = detail.data;
  const snapshot = terminal.snapshot;
  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium text-brand-600">{terminal.terminalCode}</p><h2 className="mt-1 text-2xl font-semibold text-slate-900">{terminal.name}</h2><p className="mt-2 text-slate-500">{terminal.city}, {terminal.province}, {terminal.country} · {terminal.timezone}</p></div><StatusBadge value={snapshot?.currentStatus}/></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6"><Metric icon={Package} label="Packages" value={snapshot?.packageCount ?? 0}/><Metric icon={Container} label="Containers" value={snapshot?.containerCount ?? 0}/><Metric icon={Truck} label="Trailers" value={snapshot?.trailerCount ?? 0}/><Metric icon={Truck} label="Trucks" value={snapshot?.truckCount ?? 0}/><Metric icon={Building2} label="Active trips" value={operations.activeTripCount}/><Metric icon={Users} label="Employees" value={operations.employeeCount}/></div>
    <section className="rounded-2xl border bg-white p-6 shadow-sm"><h3 className="font-semibold text-slate-900">Operational status</h3><dl className="mt-5 grid gap-5 sm:grid-cols-3"><Fact label="Last snapshot activity" value={timestamp(snapshot?.lastActivityAt)}/><Fact label="Operations activity" value={timestamp(operations.lastActivityAt)}/><Fact label="Terminal ID" value={String(terminal.id)}/></dl></section>
    <InventorySection title="Warehouse packages" empty="No packages currently owned by this terminal">{inventory.packages.map(item => <AssetRow key={item.id} to={`/packages/${encodeURIComponent(item.trackingNumber)}`} identifier={item.trackingNumber} status={item.currentStatus} detail={item.packageType.replaceAll('_', ' ')}/>)}</InventorySection>
    <InventorySection title="Warehouse containers" empty="No containers currently owned by this terminal">{inventory.containers.map(item => <AssetRow key={item.id} to={`/containers/${encodeURIComponent(item.containerBarcode)}`} identifier={item.containerBarcode} status={item.currentStatus} detail={`${item.packageCount} packages`}/>)}</InventorySection>
    <InventorySection title="Yard trailers" empty="No trailers currently owned by this terminal">{inventory.trailers.map(item => <AssetRow key={item.id} to={`/trailers/${encodeURIComponent(item.trailerBarcode)}`} identifier={item.trailerBarcode} status={item.currentStatus} detail={`${item.containerCount} containers · ${item.packageCount} loose packages`}/>)}</InventorySection>
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><Header title="Terminal history" subtitle={`Oldest to newest — ${history.length} events`}/>{history.length ? <Timeline entries={history.map(toTerminalTimelineItem)}/> : <EmptyState label="No terminal events recorded"/>}</section>
  </div>;
}
function Metric({ icon: Icon, label, value }: { icon: typeof Package; label: string; value: number }) { return <section className="rounded-2xl border bg-white p-5 shadow-sm"><Icon className="h-5 w-5 text-brand-700"/><p className="mt-4 text-2xl font-semibold text-slate-900">{value}</p><p className="text-xs text-slate-500">{label}</p></section>; }
function Fact({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{value}</dd></div>; }
function Header({ title, subtitle }: { title: string; subtitle: string }) { return <div className="border-b px-6 py-5"><h3 className="font-semibold text-slate-900">{title}</h3><p className="mt-1 text-xs text-slate-400">{subtitle}</p></div>; }
function InventorySection({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) { return <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><Header title={title} subtitle={`${children.length} current assets`}/>{children.length ? <div className="divide-y">{children}</div> : <EmptyState label={empty}/>}</section>; }
function AssetRow({ to, identifier, detail, status }: { to: string; identifier: string; detail: string; status: string }) { return <div className="flex items-center justify-between gap-4 px-6 py-4"><div><Link to={to} className="font-semibold text-brand-700 hover:text-brand-900">{identifier}</Link><p className="mt-1 text-xs text-slate-400">{detail}</p></div><StatusBadge value={status}/></div>; }
