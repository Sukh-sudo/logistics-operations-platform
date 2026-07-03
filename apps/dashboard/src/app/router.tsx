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

export const router = createBrowserRouter([
  { element: <AuthLayout/>, children: [{ path: '/login', element: <LoginPage/> }] },
  { element: <ProtectedRoute/>, children: [{ element: <AppLayout/>, children: [
    { index: true, element: <HomePage/> },
    { path: 'dashboard', element: <DashboardPage/> },
    { path: 'transportation', element: <TransportationPage/> },
    { path: 'analytics', element: <AnalyticsPage/> },
    ...['search', 'packages', 'containers', 'trailers', 'events', 'health'].map((path) => ({ path, element: <PlaceholderPage/> })),
  ] }] },
  { path: '*', element: <NotFoundPage/> },
]);
