import { Search } from 'lucide-react';
import type { FormEvent } from 'react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isSearching: boolean;
}

export function SearchInput({ value, onChange, onSubmit, isSearching }: SearchInputProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (value.trim()) onSubmit();
  };

  return <form onSubmit={submit} className="rounded-2xl border bg-white p-5 shadow-sm">
    <label htmlFor="asset-barcode" className="text-sm font-semibold text-slate-800">Barcode or tracking number</label>
    <div className="mt-3 flex gap-3">
      <div className="relative flex-1"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"/><input id="asset-barcode" autoComplete="off" autoFocus value={value} onChange={(event) => onChange(event.target.value)} placeholder="Enter a package, container, or trailer identifier" className="focus-ring h-12 w-full rounded-xl border bg-slate-50 pl-12 pr-4 text-sm text-slate-900 placeholder:text-slate-400"/></div>
      <button type="submit" disabled={!value.trim() || isSearching} className="focus-ring rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">{isSearching ? 'Searching…' : 'Search'}</button>
    </div>
  </form>;
}
