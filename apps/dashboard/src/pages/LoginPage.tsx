import axios from 'axios';
import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const auth = useAuth(); const navigate = useNavigate(); const location = useLocation();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false);
  if (!auth.isLoading && auth.isAuthenticated) return <Navigate to="/" replace/>;
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(''); setSubmitting(true); try { await auth.login({ email, password }); const from = (location.state as { from?: string } | null)?.from ?? '/'; navigate(from, { replace: true }); } catch (reason) { setError(axios.isAxiosError(reason) ? (reason.response?.data?.message ?? 'Unable to sign in. Check your credentials.') : 'Unable to sign in right now.'); } finally { setSubmitting(false); } };
  return <div className="w-full max-w-md"><div className="mb-9 lg:hidden"><p className="text-sm font-semibold tracking-[.16em] text-brand-700">LOGISTICS CONTROL TOWER</p></div><div className="rounded-2xl border bg-white p-8 shadow-card sm:p-10"><div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700"><ShieldCheck className="h-6 w-6"/></div><h2 className="mt-7 text-3xl font-semibold tracking-tight text-slate-900">Sign in to operations</h2><p className="mt-3 text-sm leading-6 text-slate-500">Use your employee account to access the control tower.</p>
    <form onSubmit={submit} className="mt-8 space-y-5"><label className="block"><span className="text-sm font-medium text-slate-700">Email address</span><div className="relative mt-2"><Mail className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-slate-400"/><input autoFocus required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="operator@example.com" className="focus-ring h-12 w-full rounded-xl border bg-white pl-11 pr-4 text-sm placeholder:text-slate-400"/></div></label>
      <label className="block"><span className="text-sm font-medium text-slate-700">Password</span><div className="relative mt-2"><LockKeyhole className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-slate-400"/><input required minLength={12} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="focus-ring h-12 w-full rounded-xl border bg-white pl-11 pr-4 text-sm placeholder:text-slate-400"/></div></label>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <button disabled={submitting} className="focus-ring flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60">{submitting ? 'Signing in…' : 'Sign in'}{!submitting && <ArrowRight className="h-4 w-4"/>}</button>
    </form><p className="mt-6 text-center text-xs text-slate-400">Authorized employees only · Activity is audited</p></div></div>;
}
