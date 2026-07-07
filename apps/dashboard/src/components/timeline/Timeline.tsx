import { Check } from 'lucide-react';

export interface TimelineEntry { id: string; title: string; occurredAt: string; details: string[]; }

const formatTimestamp = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return <ol className="divide-y">{entries.map((entry, index) => <li key={entry.id} className="relative flex gap-4 px-6 py-5">
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Check className="h-4 w-4"/></div>
    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-800">{entry.title}</p><time className="text-xs text-slate-400" dateTime={entry.occurredAt}>{formatTimestamp(entry.occurredAt)}</time></div>{entry.details.length > 0 && <p className="mt-1 text-xs text-slate-500">{entry.details.join(' · ')}</p>}</div>
    {index < entries.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-[41px] top-14 w-px bg-slate-200"/>}
  </li>)}</ol>;
}
