import type { TerminalMovementDto, TerminalPerformanceDto } from '@logistics/shared-types';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Activity, Building2, Container, Gauge, Package, Truck, Users, type LucideIcon } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Timeline } from '../components/timeline/Timeline';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/ViewStates';
import { toTerminalTimelineItem } from '../features/terminals/terminalTimeline';
import { terminalApi } from '../services/terminal.api';

type Tab = 'overview' | 'packages' | 'containers' | 'trailers' | 'employees' | 'performance';
const tabs: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: 'overview', label: 'Overview', icon: Building2 },
  { id: 'packages', label: 'Packages', icon: Package },
  { id: 'containers', label: 'Containers', icon: Container },
  { id: 'trailers', label: 'Trailers', icon: Truck },
  { id: 'employees', label: 'Employees', icon: Users },
  { id: 'performance', label: 'Performance', icon: Gauge },
];
const timestamp = (value?: string | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';

export function TerminalDetailPage() {
  const terminalId = Number(useParams().terminalId);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const tab: Tab = tabs.some(item => item.id === requestedTab) ? requestedTab as Tab : 'overview';
  const period = {
    ...(searchParams.get('fromDate') && { fromDate: searchParams.get('fromDate')! }),
    ...(searchParams.get('toDate') && { toDate: searchParams.get('toDate')! }),
  };
  const detail = useQuery({
    queryKey: ['terminal', terminalId, period],
    enabled: Number.isInteger(terminalId) && terminalId > 0,
    retry: false,
    queryFn: async () => {
      const [terminal, inventory, operations, history, employees, movements, performance] = await Promise.all([
        terminalApi.detail(terminalId),
        terminalApi.inventory(terminalId),
        terminalApi.operations(terminalId),
        terminalApi.history(terminalId),
        terminalApi.employees(terminalId),
        terminalApi.movements(terminalId, period),
        terminalApi.performance(terminalId, period),
      ]);
      return { terminal, inventory, operations, history, employees, movements, performance };
    },
  });
  const selectTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params);
  };

  if (!Number.isInteger(terminalId) || terminalId < 1) return <ErrorState message="Terminal identifier is invalid."/>;
  if (detail.isLoading) return <LoadingState/>;
  if (detail.isError) return <ErrorState message={axios.isAxiosError(detail.error) && detail.error.response?.status === 404 ? 'Terminal not found.' : 'The terminal workspace could not be loaded.'}/>;
  if (!detail.data?.performance) return <ErrorState message="The terminal workspace could not be loaded."/>;

  const { terminal, inventory, operations, history, employees, movements, performance } = detail.data;
  const snapshot = terminal.snapshot;
  const periodLabel = period.fromDate || period.toDate
    ? `${period.fromDate ?? 'Beginning'} to ${period.toDate ?? 'Today'}`
    : 'All available activity';

  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><Link to="/dashboard" className="text-xs font-semibold text-brand-600 hover:text-brand-800">Dashboard / Terminals</Link><p className="mt-3 text-sm font-medium text-brand-600">{terminal.terminalCode}</p><h2 className="mt-1 text-2xl font-semibold text-slate-900">{terminal.name}</h2><p className="mt-2 text-slate-500">{terminal.city}, {terminal.province}, {terminal.country} · {terminal.timezone}</p></div>
      <div className="text-right"><StatusBadge value={snapshot?.currentStatus}/><p className="mt-3 text-xs text-slate-400">{periodLabel}</p></div>
    </div>

    <div className="overflow-x-auto rounded-xl border bg-white p-1 shadow-sm" role="tablist" aria-label="Terminal information">
      <div className="flex min-w-max gap-1">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => selectTab(id)} className={`focus-ring flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${tab === id ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}><Icon className="h-4 w-4"/>{label}</button>)}</div>
    </div>

    {tab === 'overview' && <Overview snapshot={snapshot} operations={operations} performance={performance}/>}
    {tab === 'packages' && <InventorySection title="Terminal packages" empty="No packages currently owned by this terminal">{inventory.packages.map(item => <AssetRow key={item.id} to={`/packages/${encodeURIComponent(item.trackingNumber)}`} identifier={item.trackingNumber} status={item.currentStatus} detail={item.packageType.replaceAll('_', ' ')}/>)}</InventorySection>}
    {tab === 'containers' && <InventorySection title="Terminal containers" empty="No containers currently owned by this terminal">{inventory.containers.map(item => <AssetRow key={item.id} to={`/containers/${encodeURIComponent(item.containerBarcode)}`} identifier={item.containerBarcode} status={item.currentStatus} detail={`${item.packageCount} packages`}/>)}</InventorySection>}
    {tab === 'trailers' && <TrailersTab trailers={inventory.trailers} movements={movements}/>}
    {tab === 'employees' && <EmployeesTab employees={employees}/>}
    {tab === 'performance' && <PerformanceTab performance={performance} history={history}/>}
  </div>;
}

function Overview({ snapshot, operations, performance }: { snapshot: Awaited<ReturnType<typeof terminalApi.detail>>['snapshot']; operations: Awaited<ReturnType<typeof terminalApi.operations>>; performance: TerminalPerformanceDto }) {
  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6"><Metric icon={Package} label="Current packages" value={snapshot?.packageCount ?? 0}/><Metric icon={Container} label="Containers" value={snapshot?.containerCount ?? 0}/><Metric icon={Truck} label="Trailers" value={snapshot?.trailerCount ?? 0}/><Metric icon={Truck} label="Trucks" value={snapshot?.truckCount ?? 0}/><Metric icon={Building2} label="Active trips" value={operations.activeTripCount}/><Metric icon={Users} label="Employees" value={operations.employeeCount}/></div>
    <section className="rounded-2xl border bg-white p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="font-semibold text-slate-900">Selected-period performance</h3><p className="mt-1 text-sm text-slate-500">Event-backed package delivery commitments and scheduled trip-stop arrivals.</p></div><Activity className="h-5 w-5 text-brand-600"/></div><div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><Fact label="Packages processed" value={String(performance.metrics.packagesProcessed)}/><Fact label="Delivered packages" value={String(performance.metrics.deliveredPackages)}/><Fact label="On-time delivery" value={performance.metrics.deliveryOnTimePerformance === null ? 'No committed deliveries' : `${performance.metrics.deliveryOnTimePerformance}%`}/><Fact label="Late deliveries" value={String(performance.metrics.lateDeliveries)}/></div></section>
    <section className="rounded-2xl border bg-white p-6 shadow-sm"><h3 className="font-semibold text-slate-900">Operational status</h3><dl className="mt-5 grid gap-5 sm:grid-cols-3"><Fact label="Last snapshot activity" value={timestamp(snapshot?.lastActivityAt)}/><Fact label="Operations activity" value={timestamp(operations.lastActivityAt)}/><Fact label="Terminal ID" value={String(operations.terminalId)}/></dl></section>
  </div>;
}

function TrailersTab({ trailers, movements }: { trailers: Awaited<ReturnType<typeof terminalApi.inventory>>['trailers']; movements: TerminalMovementDto[] }) {
  const inbound = movements.filter(item => item.direction === 'INBOUND');
  const outbound = movements.filter(item => item.direction === 'OUTBOUND');
  return <div className="space-y-6">
    <InventorySection title="Current yard trailers" empty="No trailers currently owned by this terminal">{trailers.map(item => <AssetRow key={item.id} to={`/trailers/${encodeURIComponent(item.trailerBarcode)}`} identifier={item.trailerBarcode} status={item.currentStatus} detail={`${item.containerCount} containers · ${item.packageCount} loose packages`}/>)}</InventorySection>
    <div className="grid gap-6 xl:grid-cols-2"><MovementSection title="Inbound trailers" movements={inbound}/><MovementSection title="Outbound trailers" movements={outbound}/></div>
  </div>;
}

function MovementSection({ title, movements }: { title: string; movements: TerminalMovementDto[] }) {
  return <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><Header title={title} subtitle={`${movements.length} movements in the selected period`}/>{movements.length ? <div className="divide-y">{movements.map(item => <div key={item.id} className="grid gap-3 px-6 py-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><Link to={`/trips/${item.tripId}`} className="font-semibold text-brand-700 hover:text-brand-900">{item.tripNumber}</Link><p className="mt-1 text-xs text-slate-400">{item.trailerBarcode ?? 'Trailer not assigned'} · Actual {timestamp(item.actualAt)}</p></div><div className="text-left sm:text-right"><StatusBadge value={item.delayMinutes > 0 ? 'LATE' : 'ON_TIME'}/>{item.delayMinutes > 0 && <p className="mt-1 text-xs text-rose-600">{item.delayMinutes} min late</p>}</div></div>)}</div> : <EmptyState label={`No ${title.toLowerCase()} in this period`}/>}</section>;
}

function EmployeesTab({ employees }: { employees: Awaited<ReturnType<typeof terminalApi.employees>> }) {
  return <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><Header title="Terminal employees" subtitle={`${employees.length} currently assigned employees`}/>{employees.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-6 py-4">Employee</th><th>Number</th><th>Roles</th><th>Status</th><th className="pr-6">Last activity</th></tr></thead><tbody className="divide-y">{employees.map(employee => <tr key={employee.id}><td className="px-6 py-4"><p className="font-semibold text-slate-800">{employee.firstName} {employee.lastName}</p><p className="text-xs text-slate-400">{employee.email}</p></td><td>{employee.employeeNumber}</td><td>{employee.roleNames.join(', ') || '—'}</td><td><StatusBadge value={employee.currentStatus}/></td><td className="pr-6 text-slate-500">{timestamp(employee.lastActivityAt)}</td></tr>)}</tbody></table></div> : <EmptyState label="No employees are currently assigned to this terminal"/>}</section>;
}

function PerformanceTab({ performance, history }: { performance: TerminalPerformanceDto; history: Awaited<ReturnType<typeof terminalApi.history>> }) {
  const metrics = performance.metrics;
  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={Package} label="Packages processed" value={metrics.packagesProcessed}/><Metric icon={Package} label="Delivered packages" value={metrics.deliveredPackages}/><Metric icon={Gauge} label="On-time delivery" value={metrics.deliveryOnTimePerformance === null ? '—' : `${metrics.deliveryOnTimePerformance}%`}/><Metric icon={Activity} label="Late deliveries" value={metrics.lateDeliveries}/></div>
    <section className="rounded-2xl border bg-white p-6 shadow-sm"><h3 className="font-semibold text-slate-900">Movement and delivery outcomes</h3><dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><Fact label="Committed deliveries" value={String(metrics.committedDeliveries)}/><Fact label="On-time / committed" value={`${metrics.onTimeDeliveries} / ${metrics.committedDeliveries}`}/><Fact label="On-time / total arrivals" value={`${metrics.onTimeArrivals} / ${metrics.totalArrivals}`}/><Fact label="Delivery attempts" value={String(metrics.deliveryAttempts)}/></dl><p className="mt-5 border-t pt-4 text-xs leading-5 text-slate-400">Delivery performance compares each delivered package event with its shipment's fixed estimated-delivery timestamp. Trip arrival performance remains a separate planned-versus-actual movement measure.</p></section>
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><Header title="Terminal history" subtitle={`Oldest to newest — ${history.length} events`}/>{history.length ? <Timeline entries={history.map(toTerminalTimelineItem)}/> : <EmptyState label="No terminal events recorded"/>}</section>
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number | string }) { return <section className="rounded-2xl border bg-white p-5 shadow-sm"><Icon className="h-5 w-5 text-brand-700"/><p className="mt-4 text-2xl font-semibold text-slate-900">{value}</p><p className="text-xs text-slate-500">{label}</p></section>; }
function Fact({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{value}</dd></div>; }
function Header({ title, subtitle }: { title: string; subtitle: string }) { return <div className="border-b px-6 py-5"><h3 className="font-semibold text-slate-900">{title}</h3><p className="mt-1 text-xs text-slate-400">{subtitle}</p></div>; }
function InventorySection({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) { return <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><Header title={title} subtitle={`${children.length} current assets`}/>{children.length ? <div className="divide-y">{children}</div> : <EmptyState label={empty}/>}</section>; }
function AssetRow({ to, identifier, detail, status }: { to: string; identifier: string; detail: string; status: string }) { return <div className="flex items-center justify-between gap-4 px-6 py-4"><div><Link to={to} className="font-semibold text-brand-700 hover:text-brand-900">{identifier}</Link><p className="mt-1 text-xs text-slate-400">{detail}</p></div><StatusBadge value={status}/></div>; }
