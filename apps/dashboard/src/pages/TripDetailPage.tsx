import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { CalendarClock, Gauge, MapPin, Truck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ErrorState, LoadingState } from '../components/ui/ViewStates';
import { clampProgress, tripStopTiming } from '../features/trips/tripProgress';
import { tripApi } from '../services/trip.api';

const timestamp = (value?: string | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';

export function TripDetailPage() {
  const { tripId = '' } = useParams();
  const detail = useQuery({ queryKey: ['trip', tripId], enabled: Boolean(tripId), retry: false, queryFn: () => tripApi.detail(tripId) });
  if (detail.isLoading) return <LoadingState/>;
  if (detail.isError) return <ErrorState message={axios.isAxiosError(detail.error) && detail.error.response?.status === 404 ? 'Trip not found.' : 'The trip execution record could not be loaded.'}/>;
  if (!detail.data) return <ErrorState message="The trip execution record could not be loaded."/>;
  const trip = detail.data;
  const progress = clampProgress(trip.snapshot?.progressPercent);
  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium text-brand-600">Trip execution</p><h2 className="mt-1 text-2xl font-semibold text-slate-900">{trip.tripNumber}</h2><p className="mt-2 text-slate-500">Executing <Link className="font-medium text-brand-700" to={`/routes/${trip.routeId}`}>{trip.route.routeNumber} — {trip.route.name}</Link></p></div><StatusBadge value={trip.snapshot?.currentStatus ?? trip.status}/></div>
    <div className="grid gap-4 sm:grid-cols-3"><Metric icon={Gauge} label="Progress" value={`${progress}%`}/><Metric icon={MapPin} label="Stops completed" value={`${trip.snapshot?.completedStops ?? 0} / ${trip.snapshot?.totalStops ?? trip.stops.length}`}/><Metric icon={CalendarClock} label="Current delay" value={`${trip.snapshot?.delayMinutes ?? 0} min`}/></div>
    <section className="rounded-2xl border bg-white p-6 shadow-sm"><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${progress}%` }}/></div><dl className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><Fact label="Planned departure" value={timestamp(trip.plannedDeparture)}/><Fact label="Actual departure" value={timestamp(trip.actualDeparture)}/><Fact label="Planned arrival" value={timestamp(trip.plannedArrival)}/><Fact label="Actual arrival" value={timestamp(trip.actualArrival)}/></dl></section>
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b px-6 py-5"><h3 className="font-semibold text-slate-900">Stop progression</h3><p className="mt-1 text-xs text-slate-400">Ordered operational stops from the Trip snapshot</p></div><ol className="divide-y">{trip.stops.map(stop => { const timing = tripStopTiming(stop); return <li key={stop.id} className="grid gap-3 px-6 py-5 sm:grid-cols-[48px_1fr_auto] sm:items-center"><div className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">{stop.sequence}</div><div><Link to={`/terminals/${stop.terminalId}`} className="font-semibold text-brand-700 hover:text-brand-900">{stop.terminal.name}</Link><p className="mt-1 text-xs text-slate-400">Arrival {timestamp(timing.arrival)} ({timing.arrivalActual ? 'actual' : 'planned'}) · Departure {timestamp(timing.departure)} ({timing.departureActual ? 'actual' : 'planned'})</p>{stop.notes && <p className="mt-1 text-xs text-slate-500">{stop.notes}</p>}</div><div className="text-right"><StatusBadge value={stop.status}/>{stop.delayMinutes > 0 && <p className="mt-1 text-xs text-rose-600">{stop.delayMinutes} min late</p>}</div></li>; })}</ol></section>
    <section className="rounded-2xl border bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><Truck className="h-5 w-5 text-brand-700"/><h3 className="font-semibold text-slate-900">Equipment assignment</h3></div><p className="mt-4 break-all text-sm text-slate-600">{trip.equipmentAssignmentId ?? 'No active equipment assignment'}</p></section>
  </div>;
}
function Metric({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) { return <section className="rounded-2xl border bg-white p-5 shadow-sm"><Icon className="h-5 w-5 text-brand-700"/><p className="mt-4 text-2xl font-semibold text-slate-900">{value}</p><p className="text-xs text-slate-500">{label}</p></section>; }
function Fact({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{value}</dd></div>; }
