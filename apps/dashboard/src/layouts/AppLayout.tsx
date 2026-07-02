import { Activity, BarChart3, Boxes, Container, HeartPulse, Home, LogOut, PackageSearch, Search, Truck } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const links = [
  { to: '/', label: 'Home', icon: Home }, { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/search', label: 'Global search', icon: Search }, { to: '/packages', label: 'Packages', icon: PackageSearch },
  { to: '/containers', label: 'Containers', icon: Container }, { to: '/trailers', label: 'Trailers', icon: Truck },
  { to: '/events', label: 'Recent events', icon: Activity }, { to: '/analytics', label: 'Analytics', icon: Boxes },
  { to: '/health', label: 'System health', icon: HeartPulse },
];
const titles: Record<string, string> = { '/': 'Operations hub', '/dashboard': 'Operational dashboard', '/search': 'Global search', '/packages': 'Package visibility', '/containers': 'Container visibility', '/trailers': 'Trailer visibility', '/events': 'Recent events', '/analytics': 'Analytics', '/health': 'System health' };

export function AppLayout() {
  const { user, logout } = useAuth(); const navigate = useNavigate(); const location = useLocation();
  const signOut = async () => { await logout(); navigate('/login', { replace: true }); };
  return <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[264px_1fr]">
    <aside className="flex border-r border-slate-800 bg-ink px-4 py-6 text-slate-300 lg:fixed lg:inset-y-0 lg:w-[264px] lg:flex-col">
      <div className="flex items-center gap-3 px-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500 text-white"><Boxes className="h-5 w-5"/></div><div><p className="text-sm font-semibold tracking-wide text-white">CONTROL TOWER</p><p className="text-xs text-slate-400">Logistics operations</p></div></div>
      <nav className="mt-9 hidden space-y-1 lg:block">{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `focus-ring flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${isActive ? 'bg-white/10 font-medium text-white' : 'hover:bg-white/5 hover:text-white'}`}><Icon className="h-[18px] w-[18px]"/>{label}</NavLink>)}</nav>
      <div className="mt-auto hidden border-t border-white/10 pt-4 lg:block"><button onClick={signOut} className="focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-white/5 hover:text-white"><LogOut className="h-[18px] w-[18px]"/>Sign out</button></div>
    </aside>
    <div className="lg:col-start-2"><header className="sticky top-0 z-10 flex h-20 items-center justify-between border-b bg-white/90 px-6 backdrop-blur lg:px-10"><div><p className="text-xs font-medium uppercase tracking-[.16em] text-slate-400">Logistics operations</p><h1 className="mt-1 text-lg font-semibold text-slate-900">{titles[location.pathname] ?? 'Operations'}</h1></div><div className="flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-sm font-medium text-slate-800">{user?.firstName} {user?.lastName}</p><p className="text-xs text-slate-500">{user?.roleNames.join(', ') || 'Operations user'}</p></div><div className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">{user?.firstName?.[0]}{user?.lastName?.[0]}</div></div></header><main className="px-6 py-8 lg:px-10 lg:py-10"><Outlet/></main></div>
  </div>;
}
