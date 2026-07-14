import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { AppLayout } from '../layouts/AppLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { PlaceholderPage } from '../pages/PlaceholderPage';
import { AnalyticsPage } from '../pages/AnalyticsPage';
import { DashboardPage } from '../pages/DashboardPage';
import { TransportationPage } from '../pages/TransportationPage';
import { SearchPage } from '../pages/SearchPage';
import { PackageDetailPage } from '../pages/PackageDetailPage';
import { ContainerDetailPage } from '../pages/ContainerDetailPage';
import { FleetPage } from '../pages/FleetPage';
import { TrailerDetailPage } from '../pages/TrailerDetailPage';
import { EventsPage } from '../pages/EventsPage';
import { HealthPage } from '../pages/HealthPage';
import { TerminalDetailPage } from '../pages/TerminalDetailPage';
import { RouteDetailPage } from '../pages/RouteDetailPage';
import { TripDetailPage } from '../pages/TripDetailPage';
import { ShipmentDetailPage } from '../pages/ShipmentDetailPage';

export const router = createBrowserRouter([
  { element: <AuthLayout/>, children: [{ path: '/login', element: <LoginPage/> }] },
  { element: <ProtectedRoute/>, children: [{ element: <AppLayout/>, children: [
    { index: true, element: <HomePage/> },
    { path: 'dashboard', element: <DashboardPage/> },
    { path: 'transportation', element: <TransportationPage/> },
    { path: 'terminals/:terminalId', element: <TerminalDetailPage/> },
    { path: 'routes/:routeId', element: <RouteDetailPage/> },
    { path: 'trips/:tripId', element: <TripDetailPage/> },
    { path: 'shipments/:shipmentId', element: <ShipmentDetailPage/> },
    { path: 'fleet', element: <FleetPage/> },
    { path: 'search', element: <SearchPage/> },
    { path: 'packages/:trackingNumber', element: <PackageDetailPage/> },
    { path: 'containers/:containerBarcode', element: <ContainerDetailPage/> },
    { path: 'trailers/:trailerBarcode', element: <TrailerDetailPage/> },
    { path: 'analytics', element: <AnalyticsPage/> },
    { path: 'events', element: <EventsPage/> },
    { path: 'health', element: <HealthPage/> },
    ...['packages', 'containers', 'trailers'].map((path) => ({ path, element: <PlaceholderPage/> })),
  ] }] },
  { path: '*', element: <NotFoundPage/> },
]);
