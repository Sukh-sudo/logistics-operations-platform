import { Activity, BarChart3, Container, FileText, HeartPulse, MapPinned, PackageSearch, Route, Search, TrendingUp, Truck } from 'lucide-react';
import { NavigationCard } from '../components/navigation/NavigationCard';
import { useAuth } from '../hooks/useAuth';
const cards = [
  { to: '/dashboard', title: 'Operational dashboard', description: 'See package, container, and trailer activity at a glance.', icon: BarChart3 },
  { to: '/search', title: 'Global search', description: 'Locate any package, container, or trailer by barcode.', icon: Search, tone: 'bg-violet-50 text-violet-700' },
  { to: '/packages', title: 'Package visibility', description: 'Review package state, location, and lifecycle history.', icon: PackageSearch, tone: 'bg-sky-50 text-sky-700' },
  { to: '/containers', title: 'Container visibility', description: 'Inspect container contents and current assignments.', icon: Container, tone: 'bg-emerald-50 text-emerald-700' },
  { to: '/trailers', title: 'Trailer visibility', description: 'Explore trailer manifests, loads, and movement history.', icon: Truck, tone: 'bg-amber-50 text-amber-700' },
  { to: '/transportation', title: 'Transportation', description: 'Follow terminals, routes, trips, and shipment progress.', icon: Route, tone: 'bg-cyan-50 text-cyan-700' },
  { to: '/fleet', title: 'Fleet visibility', description: 'Monitor trucks, drivers, and trip equipment assignments.', icon: Truck, tone: 'bg-orange-50 text-orange-700' },
  { to: '/tracking', title: 'Customer tracking', description: 'Find a shipment by number and follow delivery milestones.', icon: MapPinned, tone: 'bg-blue-50 text-blue-700' },
  { to: '/reports', title: 'Delivery reports', description: 'Measure shipment completion and delivered package volume.', icon: FileText, tone: 'bg-fuchsia-50 text-fuchsia-700' },
  { to: '/events', title: 'Recent events', description: 'Follow the latest operational activity across the network.', icon: Activity, tone: 'bg-rose-50 text-rose-700' },
  { to: '/analytics', title: 'Analytics', description: 'Understand status distribution and operational trends.', icon: TrendingUp, tone: 'bg-indigo-50 text-indigo-700' },
  { to: '/health', title: 'System health', description: 'Check platform availability and connected services.', icon: HeartPulse, tone: 'bg-teal-50 text-teal-700' },
];
export function HomePage() { const { user } = useAuth(); return <div className="mx-auto max-w-7xl"><div className="mb-9"><p className="text-sm font-medium text-brand-600">Welcome back, {user?.firstName}</p><h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Where do you want to look?</h2><p className="mt-3 max-w-2xl text-base leading-7 text-slate-500">Choose an operational workspace to begin.</p></div><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <NavigationCard key={card.to} {...card}/>)}</div></div>; }
