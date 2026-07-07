import type { SearchResultDto } from '@logistics/shared-types';
import { ArrowRight, Box, Container, PackageSearch, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { toSearchResultView } from './searchResult';

const icons = { PACKAGE: PackageSearch, CONTAINER: Container, TRAILER: Truck };

export function SearchResultCard({ result }: { result: SearchResultDto }) {
  const view = toSearchResultView(result); const Icon = icons[result.type];
  return <section aria-live="polite" className="overflow-hidden rounded-2xl border bg-white shadow-sm">
    <div className="flex items-start justify-between border-b bg-slate-50/70 px-6 py-5"><div className="flex gap-4"><div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5"/></div><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{view.typeLabel}</p><h3 className="mt-1 text-lg font-semibold text-slate-900">{view.identifier}</h3></div></div><StatusBadge value={view.status}/></div>
    <dl className="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">{view.facts.map((fact) => <div key={fact.label} className="bg-white px-6 py-5"><dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{fact.label}</dt><dd className="mt-2 text-sm font-semibold text-slate-800">{fact.value}</dd></div>)}</dl>
    <div className="flex items-center justify-between px-6 py-4"><span className="flex items-center gap-2 text-xs text-slate-400"><Box className="h-4 w-4"/>Snapshot-backed operational record</span><Link to={view.detailPath} className="focus-ring inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">View details <ArrowRight className="h-4 w-4"/></Link></div>
  </section>;
}
