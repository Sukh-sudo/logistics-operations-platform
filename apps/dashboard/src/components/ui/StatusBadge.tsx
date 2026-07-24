const tones: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700', DELIVERED: 'bg-emerald-50 text-emerald-700', COMPLETED: 'bg-emerald-50 text-emerald-700',
  IN_TRANSIT: 'bg-sky-50 text-sky-700', IN_PROGRESS: 'bg-sky-50 text-sky-700', OUT_FOR_DELIVERY: 'bg-sky-50 text-sky-700', ARRIVED: 'bg-indigo-50 text-indigo-700',
  PARTIALLY_DELIVERED: 'bg-indigo-50 text-indigo-700', PACKAGES_ASSIGNED: 'bg-violet-50 text-violet-700',
  DELAYED: 'bg-rose-50 text-rose-700', CANCELLED: 'bg-rose-50 text-rose-700', RETIRED: 'bg-slate-100 text-slate-600',
  CREATED: 'bg-amber-50 text-amber-700', OPEN: 'bg-amber-50 text-amber-700', CLOSED: 'bg-violet-50 text-violet-700',
};
export function StatusBadge({ value }: { value?: string | null }) { const label = value?.replaceAll('_', ' ') ?? 'Unknown'; return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[value ?? ''] ?? 'bg-slate-100 text-slate-600'}`}>{label}</span>; }
