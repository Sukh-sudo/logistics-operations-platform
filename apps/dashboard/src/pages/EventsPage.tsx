import type { RecentEventDto } from '@logistics/shared-types';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/ViewStates';
import { useRecentEvents } from '../hooks/useDashboard';

type EventFilter = 'ALL' | RecentEventDto['assetType'];
const filters: EventFilter[] = ['ALL', 'PACKAGE', 'CONTAINER', 'TRAILER'];
const formatTimestamp = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const assetPath = (event: RecentEventDto) => ({ PACKAGE: 'packages', CONTAINER: 'containers', TRAILER: 'trailers' })[event.assetType];

export function EventsPage() {
  const [filter, setFilter] = useState<EventFilter>('ALL');
  const events = useRecentEvents();
  if (events.isLoading) return <LoadingState/>;
  if (events.isError) return <ErrorState message="Recent operational events could not be loaded."/>;
  const visible = (events.data ?? []).filter(event => filter === 'ALL' || event.assetType === filter);

  return <div className="mx-auto max-w-6xl space-y-6">
    <div><p className="text-sm font-medium text-brand-600">Operational audit</p><h2 className="mt-1 text-2xl font-semibold text-slate-900">Recent events</h2><p className="mt-2 text-slate-500">The latest immutable package, container, and trailer activity across the network.</p></div>
    <div className="flex flex-wrap gap-2" aria-label="Event type filters">{filters.map(value => <button key={value} onClick={() => setFilter(value)} className={`rounded-full border px-4 py-2 text-sm font-medium transition ${filter === value ? 'border-brand-600 bg-brand-50 text-brand-700' : 'bg-white text-slate-500 hover:text-slate-800'}`}>{value === 'ALL' ? 'All events' : value.toLowerCase().replace(/^./, letter => letter.toUpperCase())}</button>)}</div>
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">{visible.length ? <ol className="divide-y">{visible.map((event, index) => <li key={`${event.assetType}-${event.reference}-${event.occurredAt}-${index}`} className="grid gap-3 px-6 py-5 sm:grid-cols-[130px_1fr_auto] sm:items-center"><StatusBadge value={event.assetType}/><div><Link to={`/${assetPath(event)}/${encodeURIComponent(event.reference)}`} className="font-semibold text-brand-700 hover:text-brand-900">{event.reference}</Link><p className="mt-1 text-sm text-slate-600">{event.event.replaceAll('_', ' ')}</p></div><time dateTime={event.occurredAt} className="text-xs text-slate-400">{formatTimestamp(event.occurredAt)}</time></li>)}</ol> : <EmptyState label={filter === 'ALL' ? 'No recent events recorded' : `No recent ${filter.toLowerCase()} events`}/>}</section>
  </div>;
}
