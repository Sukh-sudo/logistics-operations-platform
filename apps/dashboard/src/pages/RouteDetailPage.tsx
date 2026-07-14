import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Clock3, MapPin, Route as RouteIcon, Ruler } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ErrorState, LoadingState } from '../components/ui/ViewStates';
import { buildRouteStops } from '../features/routes/routeStops';
import { routeApi } from '../services/route.api';

const duration = (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
const offset = (minutes: number) => minutes === 0 ? 'Departure' : `+${duration(minutes)}`;

export function RouteDetailPage() {
  const { routeId = '' } = useParams();
  const detail = useQuery({ queryKey: ['route', routeId], enabled: Boolean(routeId), retry: false, queryFn: () => routeApi.detail(routeId) });
  if (detail.isLoading) return <LoadingState/>;
  if (detail.isError) return <ErrorState message={axios.isAxiosError(detail.error) && detail.error.response?.status === 404 ? 'Route not found.' : 'The route template could not be loaded.'}/>;
  if (!detail.data) return <ErrorState message="The route template could not be loaded."/>;
  const route = detail.data;
  const stops = buildRouteStops(route);
  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium text-brand-600">{route.routeNumber}</p><h2 className="mt-1 text-2xl font-semibold text-slate-900">{route.name}</h2><p className="mt-2 text-slate-500">Reusable transportation template from {route.originTerminal.terminalCode} to {route.destinationTerminal.terminalCode}.</p></div><StatusBadge value={route.snapshot?.currentStatus ?? route.status}/></div>
    <div className="grid gap-4 sm:grid-cols-3"><Metric icon={Ruler} label="Estimated distance" value={`${route.snapshot?.estimatedDistance ?? route.estimatedDistance} km`}/><Metric icon={Clock3} label="Estimated duration" value={duration(route.snapshot?.estimatedDuration ?? route.estimatedDuration)}/><Metric icon={MapPin} label="Intermediate stops" value={String(route.snapshot?.stopCount ?? route.stops.length)}/></div>
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b px-6 py-5"><div className="flex items-center gap-3"><RouteIcon className="h-5 w-5 text-brand-700"/><h3 className="font-semibold text-slate-900">Ordered itinerary</h3></div><p className="mt-1 text-xs text-slate-400">Endpoints and current snapshot stop sequence</p></div><ol className="divide-y">{stops.map((stop, index) => <li key={stop.key} className="grid gap-3 px-6 py-5 sm:grid-cols-[48px_1fr_auto] sm:items-center"><div className={`grid h-9 w-9 place-items-center rounded-full text-sm font-semibold ${stop.endpoint ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600'}`}>{index + 1}</div><div><Link to={`/terminals/${stop.terminalId}`} className="font-semibold text-brand-700 hover:text-brand-900">{stop.label}</Link><p className="mt-1 text-xs text-slate-400">{stop.endpoint ? index === 0 ? 'Origin terminal' : 'Destination terminal' : `Intermediate stop ${stop.sequence}`}</p></div><div className="text-left text-xs text-slate-500 sm:text-right"><p>Arrive {offset(stop.arrivalOffset)}</p><p className="mt-1">Depart {offset(stop.departureOffset)}</p></div></li>)}</ol></section>
    <section className="rounded-2xl border bg-white p-6 shadow-sm"><h3 className="font-semibold text-slate-900">Snapshot information</h3><dl className="mt-5 grid gap-5 sm:grid-cols-3"><Fact label="Route ID" value={route.id}/><Fact label="Origin" value={route.originTerminal.terminalCode}/><Fact label="Destination" value={route.destinationTerminal.terminalCode}/></dl></section>
  </div>;
}
function Metric({ icon: Icon, label, value }: { icon: typeof Ruler; label: string; value: string }) { return <section className="rounded-2xl border bg-white p-5 shadow-sm"><Icon className="h-5 w-5 text-brand-700"/><p className="mt-4 text-2xl font-semibold text-slate-900">{value}</p><p className="text-xs text-slate-500">{label}</p></section>; }
function Fact({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 break-all text-sm font-semibold text-slate-800">{value}</dd></div>; }
