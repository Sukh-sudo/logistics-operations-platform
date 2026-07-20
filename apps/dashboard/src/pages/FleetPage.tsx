import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Contact, Truck } from 'lucide-react';
import { useState } from 'react';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/ViewStates';
import { fleetApi } from '../services/fleet.api';

type Tab = 'trucks' | 'drivers' | 'assignments';
const tabs: { id: Tab; label: string; icon: typeof Truck }[] = [
  { id: 'trucks', label: 'Trucks', icon: Truck },
  { id: 'drivers', label: 'Drivers', icon: Contact },
  { id: 'assignments', label: 'Assignments', icon: BadgeCheck },
];
const dateTime = (value?: string | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';

export function FleetPage() {
  const [tab, setTab] = useState<Tab>('trucks');
  const trucks = useQuery({ queryKey: ['fleet', 'trucks'], queryFn: fleetApi.trucks });
  const drivers = useQuery({ queryKey: ['fleet', 'drivers'], queryFn: fleetApi.drivers });
  const assignments = useQuery({ queryKey: ['fleet', 'assignments'], queryFn: fleetApi.assignments });
  const query = { trucks, drivers, assignments }[tab];
  const counts = { trucks: trucks.data?.length ?? 0, drivers: drivers.data?.length ?? 0, assignments: assignments.data?.length ?? 0 };

  return <div className="mx-auto max-w-7xl"><div><p className="text-sm font-medium text-brand-600">Transportation resources</p><h2 className="mt-1 text-2xl font-semibold text-slate-900">Fleet visibility</h2><p className="mt-2 text-slate-500">Monitor truck and driver availability, active allocations, and assignment history.</p></div>
    <div className="mt-7 flex gap-2 border-b">{tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium ${tab === id ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500'}`}><Icon className="h-4 w-4"/>{label}<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{counts[id]}</span></button>)}</div>
    <div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">{query.isLoading ? <LoadingState/> : query.isError ? <ErrorState message={`Could not load fleet ${tab}.`}/> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{tab === 'trucks' ? <><th className="px-6 py-4">Unit</th><th>Purpose</th><th>Vehicle</th><th>Terminal</th><th>Assigned trip</th><th>Status</th></> : tab === 'drivers' ? <><th className="px-6 py-4">Employee</th><th>License</th><th>Terminal</th><th>Assigned trip</th><th>Status</th></> : <><th className="px-6 py-4">Trip</th><th>Truck</th><th>Driver</th><th>Assigned</th><th>Status</th></>}</tr></thead><tbody className="divide-y">{tab === 'trucks' ? trucks.data?.map(item => <tr key={item.id}><td className="px-6 py-4"><b>{item.unitNumber}</b><p className="text-xs text-slate-400">{item.licensePlate}</p></td><td>{item.purpose?.replaceAll('_', ' ') ?? 'Legacy unit'}</td><td>{[item.year, item.make, item.model].filter(Boolean).join(' ') || '—'}</td><td>{item.terminal?.terminalCode ?? 'Unassigned'}</td><td>{item.snapshot?.assignedTripId ?? '—'}</td><td><StatusBadge value={item.snapshot?.currentStatus ?? item.status}/></td></tr>) : tab === 'drivers' ? drivers.data?.map(item => <tr key={item.id}><td className="px-6 py-4"><b>{item.employeeId}</b></td><td>{item.licenseNumber}<p className="text-xs text-slate-400">{item.licenseClass}</p></td><td>{item.terminal?.terminalCode ?? 'Unassigned'}</td><td>{item.snapshot?.assignedTripId ?? '—'}</td><td><StatusBadge value={item.snapshot?.currentStatus ?? item.status}/></td></tr>) : assignments.data?.map(item => <tr key={item.id}><td className="px-6 py-4"><b>{item.trip.tripNumber}</b></td><td>{item.truck.unitNumber}<p className="text-xs text-slate-400">{item.truck.licensePlate}</p></td><td>{item.driver.employeeId}</td><td>{dateTime(item.assignedAt)}{item.releasedAt && <p className="text-xs text-slate-400">Released {dateTime(item.releasedAt)}</p>}</td><td><StatusBadge value={item.status}/></td></tr>)}</tbody></table>{counts[tab] === 0 && <EmptyState label={`No fleet ${tab} found`}/>}</div>}</div>
  </div>;
}
