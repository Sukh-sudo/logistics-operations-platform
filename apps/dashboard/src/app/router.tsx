import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { AppLayout } from '../layouts/AppLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
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
import { TruckDetailPage } from '../pages/TruckDetailPage';
import { DriverDetailPage } from '../pages/DriverDetailPage';
import { PackageListPage } from '../pages/PackageListPage';
import { ContainerListPage } from '../pages/ContainerListPage';
import { TrailerListPage } from '../pages/TrailerListPage';
import { TrackingPage } from '../pages/TrackingPage';
import { ReportsPage } from '../pages/ReportsPage';

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
    { path: 'fleet/trucks/:truckId', element: <TruckDetailPage/> },
    { path: 'fleet/drivers/:driverId', element: <DriverDetailPage/> },
    { path: 'search', element: <SearchPage/> },
    // Collection routes use the dashboard's snapshot-backed read APIs.
    { path: 'packages', element: <PackageListPage/> },
    { path: 'containers', element: <ContainerListPage/> },
    { path: 'trailers', element: <TrailerListPage/> },
    { path: 'packages/:trackingNumber', element: <PackageDetailPage/> },
    { path: 'containers/:containerBarcode', element: <ContainerDetailPage/> },
    { path: 'trailers/:trailerBarcode', element: <TrailerDetailPage/> },
    { path: 'analytics', element: <AnalyticsPage/> },
    { path: 'tracking', element: <TrackingPage/> },
    { path: 'tracking/:shipmentNumber', element: <TrackingPage/> },
    { path: 'reports', element: <ReportsPage/> },
    { path: 'events', element: <EventsPage/> },
    { path: 'health', element: <HealthPage/> },
  ] }] },
  { path: '*', element: <NotFoundPage/> },
]);
