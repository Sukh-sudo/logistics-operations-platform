import { Boxes, HeartPulse, LogIn, MapPinned } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';
import { PageBackButton } from '../components/navigation/PageBackButton';

/**
 * Public tracking and health endpoints deliberately avoid AuthProvider gates.
 * This layout still gives customers and monitors a clear route back to login.
 */
export function PublicLayout() {
  return <div className="min-h-screen bg-canvas">
    <header className="border-b bg-ink text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
        <Link to="/tracking" className="focus-ring flex items-center gap-3 rounded-lg">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500"><Boxes className="h-5 w-5"/></span>
          <span><span className="block text-sm font-semibold tracking-wide">CONTROL TOWER</span><span className="block text-xs text-slate-400">Public services</span></span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link className="focus-ring flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-white/10" to="/tracking"><MapPinned className="h-4 w-4"/>Tracking</Link>
          <Link className="focus-ring flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-white/10" to="/health"><HeartPulse className="h-4 w-4"/>System health</Link>
          <Link className="focus-ring flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 hover:bg-white/10" to="/login"><LogIn className="h-4 w-4"/>Staff login</Link>
        </nav>
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-6 py-8"><PageBackButton className="mb-5"/><Outlet/></main>
  </div>;
}
