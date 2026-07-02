import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
interface Props { to: string; title: string; description: string; icon: LucideIcon; tone?: string; }
export function NavigationCard({ to, title, description, icon: Icon, tone = 'bg-brand-50 text-brand-700' }: Props) {
  return <Link to={to} className="focus-ring group flex min-h-52 flex-col rounded-2xl border bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg">
    <div className={`mb-8 grid h-11 w-11 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5"/></div>
    <div className="mt-auto flex items-end gap-4"><div><h2 className="text-base font-semibold text-slate-900">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p></div><ArrowUpRight className="mb-1 ml-auto h-5 w-5 shrink-0 text-slate-300 transition group-hover:text-brand-600"/></div>
  </Link>;
}
