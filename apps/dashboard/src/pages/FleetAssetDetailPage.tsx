import type { DriverDto, TruckDto } from '@logistics/shared-types';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, CalendarClock, Contact, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/ViewStates';
import { assignmentsForDriver, assignmentsForTruck } from '../features/fleet/assignmentHistory';
import { fleetApi } from '../services/fleet.api';

type Props = { kind: 'truck'; id: string } | { kind: 'driver'; id: string };
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';

export function FleetAssetDetailPage({ kind, id }: Props) {
  // Current status comes only from the snapshot-backed detail endpoint.
  const asset = useQuery<TruckDto | DriverDto>({ queryKey: ['fleet', kind, id], queryFn: async () => kind === 'truck' ? await fleetApi.truck(id) : await fleetApi.driver(id) });
  const assignments = useQuery({ queryKey: ['fleet', 'assignments'], queryFn: fleetApi.assignments });
  if (asset.isLoading || assignments.isLoading) return <LoadingState/>;
  if (asset.isError || assignments.isError || !asset.data) return <ErrorState message={`Could not load ${kind} details.`}/>;

  const data = asset.data as TruckDto | DriverDto;
  const truck = kind === 'truck' ? data as TruckDto : null;
  const driver = kind === 'driver' ? data as DriverDto : null;
  const history = kind === 'truck' ? assignmentsForTruck(assignments.data ?? [], id) : assignmentsForDriver(assignments.data ?? [], id);
  const title = truck?.unitNumber ?? driver!.employeeId;
  const Icon = kind === 'truck' ? Truck : Contact;

  return <div className="mx-auto max-w-6xl">
    <Link to="/fleet" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-brand-700"><ArrowLeft className="h-4 w-4"/>Back to fleet</Link>
    <header className="mt-5 flex items-start justify-between"><div><p className="text-sm font-medium text-brand-600">{kind === 'truck' ? 'Fleet vehicle' : 'Fleet driver'}</p><h2 className="mt-1 flex items-center gap-3 text-2xl font-semibold text-slate-900"><Icon className="h-6 w-6"/>{title}</h2><p className="mt-2 text-slate-500">Snapshot-backed availability and equipment assignment history.</p></div><StatusBadge value={data.snapshot?.currentStatus ?? data.status}/></header>
    <section className="mt-7 grid gap-4 md:grid-cols-3">
      <Detail label={kind === 'truck' ? 'License plate' : 'License number'} value={truck?.licensePlate ?? driver!.licenseNumber}/>
      <Detail label={kind === 'truck' ? 'Vehicle' : 'License class'} value={truck ? [truck.year, truck.make, truck.model].filter(Boolean).join(' ') || '—' : driver!.licenseClass}/>
      <Detail label="Current terminal" value={data.terminal ? `${data.terminal.terminalCode} — ${data.terminal.name}` : 'Unassigned'} icon={<Building2 className="h-4 w-4"/>}/>
      <Detail label="Assigned trip" value={data.snapshot?.assignedTripId ?? 'Unassigned'} link={data.snapshot?.assignedTripId ? `/trips/${data.snapshot.assignedTripId}` : undefined}/>
      <Detail label="Last activity" value={formatDate(data.snapshot?.lastActivityAt)} icon={<CalendarClock className="h-4 w-4"/>}/>
    </section>
    <section className="mt-8 overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b px-6 py-5"><h3 className="font-semibold text-slate-900">Assignment history</h3><p className="mt-1 text-sm text-slate-500">Active and released equipment allocations.</p></div>
      {history.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-6 py-4">Trip</th><th>Truck</th><th>Driver</th><th>Assigned</th><th>Released</th><th>Status</th></tr></thead><tbody className="divide-y">{history.map(item => <tr key={item.id}><td className="px-6 py-4"><Link className="font-semibold text-brand-700 hover:underline" to={`/trips/${item.trip.id}`}>{item.trip.tripNumber}</Link></td><td><Link className="text-brand-700 hover:underline" to={`/fleet/trucks/${item.truck.id}`}>{item.truck.unitNumber}</Link></td><td><Link className="text-brand-700 hover:underline" to={`/fleet/drivers/${item.driver.id}`}>{item.driver.employeeId}</Link></td><td>{formatDate(item.assignedAt)}</td><td>{formatDate(item.releasedAt)}</td><td><StatusBadge value={item.status}/></td></tr>)}</tbody></table></div> : <EmptyState label="No assignment history found"/>}
    </section>
  </div>;
}

function Detail({ label, value, link, icon }: { label: string; value: string; link?: string; icon?: React.ReactNode }) {
  return <div className="rounded-xl border bg-white p-5 shadow-sm"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{icon}{label}</p>{link ? <Link to={link} className="mt-2 block font-semibold text-brand-700 hover:underline">{value}</Link> : <p className="mt-2 font-semibold text-slate-800">{value}</p>}</div>;
}
