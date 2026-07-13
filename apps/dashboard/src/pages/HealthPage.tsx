import { useQuery } from '@tanstack/react-query';
import { Activity, Database, HeartPulse, RadioTower } from 'lucide-react';
import { ErrorState, LoadingState } from '../components/ui/ViewStates';
import { formatUptime, isHealthyStatus } from '../features/health/healthFormat';
import { healthApi } from '../services/health.api';

export function HealthPage() {
  const health = useQuery({ queryKey: ['health'], queryFn: healthApi.status, refetchInterval: 30_000 });
  if (health.isLoading) return <LoadingState/>;
  if (health.isError || !health.data) return <ErrorState message="The platform health endpoint is unavailable."/>;
  const data = health.data;
  const services = [
    { label: 'API', value: data.status, icon: HeartPulse },
    { label: 'Database', value: data.database ?? 'not reported', icon: Database },
    { label: 'Kafka', value: data.kafka ?? 'not reported', icon: RadioTower },
  ];
  const timestamp = data.timestamp && !Number.isNaN(Date.parse(data.timestamp)) ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'long' }).format(new Date(data.timestamp)) : 'Not reported';

  return <div className="mx-auto max-w-6xl space-y-7">
    <div><p className="text-sm font-medium text-brand-600">Platform operations</p><h2 className="mt-1 text-2xl font-semibold text-slate-900">System health</h2><p className="mt-2 text-slate-500">Current API and infrastructure availability, refreshed every 30 seconds.</p></div>
    <div className="grid gap-5 md:grid-cols-3">{services.map(({ label, value, icon: Icon }) => { const healthy = isHealthyStatus(value); return <section key={label} className="rounded-2xl border bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div className={`grid h-11 w-11 place-items-center rounded-xl ${healthy ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}><Icon className="h-5 w-5"/></div><span className={`h-2.5 w-2.5 rounded-full ${healthy ? 'bg-emerald-500' : 'bg-rose-500'}`} aria-label={`${label} ${healthy ? 'healthy' : 'attention required'}`}/></div><h3 className="mt-5 font-semibold text-slate-900">{label}</h3><p className={`mt-1 text-sm font-medium capitalize ${healthy ? 'text-emerald-700' : 'text-rose-700'}`}>{value}</p></section>; })}</div>
    <section className="rounded-2xl border bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><Activity className="h-5 w-5 text-brand-700"/><h3 className="font-semibold text-slate-900">Runtime information</h3></div><dl className="mt-6 grid gap-6 sm:grid-cols-2"><div><dt className="text-xs uppercase tracking-wide text-slate-400">Uptime</dt><dd className="mt-1 font-semibold text-slate-800">{formatUptime(data.uptime)}</dd></div><div><dt className="text-xs uppercase tracking-wide text-slate-400">Reported at</dt><dd className="mt-1 font-semibold text-slate-800">{timestamp}</dd></div></dl></section>
  </div>;
}
