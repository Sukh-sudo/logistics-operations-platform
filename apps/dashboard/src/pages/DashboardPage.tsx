import type { PackageStatus, TrailerStatus } from '@logistics/shared-types';
import { Activity, ArrowRight, Box, Building2, Container, PackageCheck, SlidersHorizontal, Truck, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/ViewStates';
import { StatusBadge } from '../components/ui/StatusBadge';
import { emptyDashboardFilters, type DashboardFilters } from '../features/dashboard/dashboardFilters';
import { useDashboardSummary, useDashboardTerminals, useHandheldKpis, useRecentEvents, useTerminalPerformance } from '../hooks/useDashboard';

const packageStatuses: PackageStatus[] = ['RECEIVED', 'SORTED', 'IN_CONTAINER', 'IN_TRAILER', 'DEPARTED', 'ARRIVED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'ATTEMPTED_DELIVERY', 'DAMAGED', 'MISROUTED', 'RETURNED_TO_TERMINAL'];
const trailerStatuses: TrailerStatus[] = ['OPEN', 'CLOSED', 'IN_TRANSIT', 'ARRIVED'];
const total = (values: Record<string, number>) => Object.values(values).reduce((sum, value) => sum + value, 0);
const time = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const label = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/(^|\s)\S/g, character => character.toUpperCase());

export function DashboardPage() {
  const [filters, setFilters] = useState<DashboardFilters>(emptyDashboardFilters);
  const summary = useDashboardSummary(filters);
  const events = useRecentEvents(filters);
  const terminals = useDashboardTerminals();
  const terminalPerformance = useTerminalPerformance(filters);
  const handheld = useHandheldKpis(filters);
  const activeFilters = Object.values(filters).some(Boolean);
  const setFilter = (key: keyof DashboardFilters) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters(current => ({ ...current, [key]: event.target.value }));
  };

  if (summary.isLoading || events.isLoading || handheld.isLoading || terminalPerformance.isLoading) return <LoadingState/>;
  if (summary.isError || events.isError || handheld.isError || terminalPerformance.isError || !summary.data) return <ErrorState/>;

  const cards = [
    { label: 'Packages tracked', value: total(summary.data.packages), detail: `${summary.data.packages.delivered} delivered`, icon: PackageCheck, tone: 'bg-sky-50 text-sky-700' },
    // `loaded` is a subset of open containers, so it is excluded from the total.
    { label: 'Containers', value: summary.data.containers.open + summary.data.containers.closed, detail: `${summary.data.containers.loaded} currently loaded`, icon: Container, tone: 'bg-violet-50 text-violet-700' },
    { label: 'Trailers', value: total(summary.data.trailers), detail: `${summary.data.trailers.inTransit} in transit`, icon: Truck, tone: 'bg-amber-50 text-amber-700' },
    { label: 'Recent events', value: events.data?.length ?? 0, detail: 'Latest matching activity', icon: Activity, tone: 'bg-emerald-50 text-emerald-700' },
  ];

  return <div className="mx-auto max-w-7xl space-y-8">
    <div>
      <h2 className="text-2xl font-semibold text-slate-900">Network at a glance</h2>
      <p className="mt-2 text-slate-500">Live operational totals and the latest asset movements.</p>
      <div className="mt-5 flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4 shadow-sm">
        <div className="mr-1 flex h-10 items-center gap-2 text-sm font-medium text-slate-600"><SlidersHorizontal className="h-4 w-4"/>Filters</div>
        <label className="text-xs font-medium text-slate-500">From<input aria-label="From date" type="date" max={filters.toDate || undefined} value={filters.fromDate} onChange={setFilter('fromDate')} className="mt-1 block h-10 rounded-lg border bg-white px-3 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"/></label>
        <label className="text-xs font-medium text-slate-500">To<input aria-label="To date" type="date" min={filters.fromDate || undefined} value={filters.toDate} onChange={setFilter('toDate')} className="mt-1 block h-10 rounded-lg border bg-white px-3 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"/></label>
        <label className="text-xs font-medium text-slate-500">Terminal<select aria-label="Terminal" value={filters.terminalId} onChange={setFilter('terminalId')} className="mt-1 block h-10 min-w-44 rounded-lg border bg-white px-3 text-sm text-slate-700"><option value="">All terminals</option>{terminals.data?.map(terminal => <option key={terminal.id} value={terminal.id}>{terminal.name}</option>)}</select></label>
        <label className="text-xs font-medium text-slate-500">Trailer status<select aria-label="Trailer status" value={filters.trailerStatus} onChange={setFilter('trailerStatus')} className="mt-1 block h-10 min-w-40 rounded-lg border bg-white px-3 text-sm text-slate-700"><option value="">All trailer statuses</option>{trailerStatuses.map(status => <option key={status} value={status}>{label(status)}</option>)}</select></label>
        <label className="text-xs font-medium text-slate-500">Package status<select aria-label="Package status" value={filters.packageStatus} onChange={setFilter('packageStatus')} className="mt-1 block h-10 min-w-44 rounded-lg border bg-white px-3 text-sm text-slate-700"><option value="">All package statuses</option>{packageStatuses.map(status => <option key={status} value={status}>{label(status)}</option>)}</select></label>
        {activeFilters && <button type="button" onClick={() => setFilters(emptyDashboardFilters)} className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"><X className="h-4 w-4"/>Clear</button>}
      </div>
    </div>

    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-lg font-semibold text-slate-900">Terminal performance</h3><p className="mt-1 text-sm text-slate-500">Package delivery commitments and trip-stop performance for the selected date range.</p></div><p className="text-xs text-slate-400">Select a terminal for its complete operational workspace</p></div>
      {terminalPerformance.data?.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{terminalPerformance.data.map(terminal => {
        const detailQuery = new URLSearchParams({ tab: 'overview' });
        if (filters.fromDate) detailQuery.set('fromDate', filters.fromDate);
        if (filters.toDate) detailQuery.set('toDate', filters.toDate);
        return <Link key={terminal.id} to={`/terminals/${terminal.id}?${detailQuery}`} aria-label={`View ${terminal.name} terminal details`} className="focus-ring group rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
          <div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Building2 className="h-5 w-5"/></div><div className="min-w-0"><p className="text-xs font-semibold text-brand-600">{terminal.terminalCode}</p><h4 className="truncate font-semibold text-slate-900">{terminal.name}</h4><p className="mt-0.5 text-xs text-slate-400">{terminal.city}, {terminal.province}</p></div></div><StatusBadge value={terminal.currentStatus}/></div>
          <div className="mt-5 grid grid-cols-3 gap-3 border-y py-4"><TileMetric label="Total packages" value={terminal.metrics.packagesProcessed.toLocaleString()}/><TileMetric label="On-time delivery" value={terminal.metrics.deliveryOnTimePerformance === null ? '—' : `${terminal.metrics.deliveryOnTimePerformance}%`}/><TileMetric label="Late deliveries" value={terminal.metrics.lateDeliveries.toLocaleString()} alert={terminal.metrics.lateDeliveries > 0}/></div>
          <div className="mt-4 flex items-center justify-between gap-4 text-xs text-slate-500"><div className="flex flex-wrap gap-x-4 gap-y-1"><span>{terminal.metrics.deliveredPackages} delivered</span><span>{terminal.metrics.onTimePerformance === null ? 'No trip arrivals' : `${terminal.metrics.onTimePerformance}% trip arrivals on time`}</span></div><ArrowRight className="h-4 w-4 shrink-0 text-brand-600 transition group-hover:translate-x-1"/></div>
        </Link>;
      })}</div> : <div className="rounded-2xl border bg-white"><EmptyState label="No terminal activity matches this date range"/></div>}
    </section>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label: cardLabel, value, detail, icon: Icon, tone }) => <section key={cardLabel} className="rounded-2xl border bg-white p-5 shadow-sm"><div className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5"/></div><p className="mt-5 text-3xl font-semibold text-slate-900">{value.toLocaleString()}</p><p className="mt-1 text-sm font-medium text-slate-700">{cardLabel}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></section>)}</div>
    {handheld.data && <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <div><h3 className="font-semibold text-slate-900">Handheld operations</h3><p className="mt-1 text-sm text-slate-500">Server-accepted productivity and device exceptions for the selected terminal and period.</p></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="text-2xl font-semibold text-slate-900">{handheld.data.acceptedPackages.toLocaleString()}</p><p className="text-xs text-slate-500">Accepted package scans</p></div>
        <div><p className="text-2xl font-semibold text-slate-900">{handheld.data.terminalPackagesPerHour.toLocaleString()}</p><p className="text-xs text-slate-500">Terminal packages/hour</p></div>
        <div><p className="text-2xl font-semibold text-slate-900">{handheld.data.activeEmployees.toLocaleString()}</p><p className="text-xs text-slate-500">Active employees</p></div>
        <div><p className="text-2xl font-semibold text-slate-900">{handheld.data.operationallyInactiveEmployees.toLocaleString()}</p><p className="text-xs text-slate-500">Operationally inactive</p></div>
        <div><p className="text-xl font-semibold text-rose-700">{handheld.data.rejectedScans.toLocaleString()}</p><p className="text-xs text-slate-500">Rejected scans</p></div>
        <div><p className="text-xl font-semibold text-amber-700">{handheld.data.duplicateScans.toLocaleString()}</p><p className="text-xs text-slate-500">Duplicate retries</p></div>
        <div><p className="text-xl font-semibold text-violet-700">{handheld.data.reversals.toLocaleString()}</p><p className="text-xs text-slate-500">Reversals</p></div>
        <div><p className="text-xl font-semibold text-rose-700">{handheld.data.damagedPackages.toLocaleString()}</p><p className="text-xs text-slate-500">Damaged packages</p></div>
        <div><p className="text-xl font-semibold text-amber-700">{handheld.data.misroutedPackages.toLocaleString()}</p><p className="text-xs text-slate-500">Misrouted packages</p></div>
        <div><p className="text-xl font-semibold text-slate-700">{handheld.data.gpsMissingEvents.toLocaleString()}</p><p className="text-xs text-slate-500">GPS missing</p></div>
        <div><p className="text-xl font-semibold text-slate-700">{handheld.data.closedContainersNotLoaded.toLocaleString()}</p><p className="text-xs text-slate-500">Closed containers not loaded</p></div>
      </div>
    </section>}
    <div className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b px-6 py-5"><h3 className="font-semibold text-slate-900">Recent activity</h3></div>{events.data?.length ? <div className="divide-y">{events.data.slice(0, 10).map((event, index) => <div key={`${event.reference}-${index}`} className="flex items-center gap-4 px-6 py-4"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-50"><Box className="h-4 w-4 text-slate-500"/></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{event.reference}</p><p className="mt-0.5 text-xs text-slate-400">{time(event.occurredAt)}</p></div><StatusBadge value={event.event}/></div>)}</div> : <EmptyState label="No recent activity matches these filters"/>}</section>
      <section className="rounded-2xl border bg-white p-6 shadow-sm"><h3 className="font-semibold text-slate-900">Package flow</h3><div className="mt-6 space-y-5">{Object.entries(summary.data.packages).map(([statusLabel, value]) => { const max = Math.max(...Object.values(summary.data.packages), 1); return <div key={statusLabel}><div className="mb-2 flex justify-between text-sm"><span className="capitalize text-slate-600">{statusLabel.replace(/([A-Z])/g, ' $1')}</span><span className="font-semibold text-slate-800">{value}</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${value / max * 100}%` }}/></div></div>})}</div></section>
    </div>
  </div>;
}

function TileMetric({ label: metricLabel, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return <div><p className={`text-xl font-semibold ${alert ? 'text-rose-700' : 'text-slate-900'}`}>{value}</p><p className="mt-1 text-[11px] leading-tight text-slate-400">{metricLabel}</p></div>;
}
