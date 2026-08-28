import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { terminalApi } from '../services/terminal.api';
import { TerminalDetailPage } from './TerminalDetailPage';

vi.mock('../services/terminal.api', () => ({ terminalApi: { detail: vi.fn(), inventory: vi.fn(), operations: vi.fn(), history: vi.fn(), employees: vi.fn(), movements: vi.fn(), performance: vi.fn() } }));
const snapshot = { currentStatus: 'ACTIVE', packageCount: 1, containerCount: 1, trailerCount: 1, truckCount: 2, activeTripCount: 3, employeeCount: 4, lastActivityAt: '2026-07-13T12:00:00Z' };
const renderPage = () => render(<MemoryRouter initialEntries={['/terminals/1']}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Routes><Route path="/terminals/:terminalId" element={<TerminalDetailPage/>}/></Routes></QueryClientProvider></MemoryRouter>);

describe('TerminalDetailPage integration', () => {
  beforeEach(() => {
    vi.mocked(terminalApi.detail).mockResolvedValue({ id: 1, terminalCode: 'YYC', name: 'Calgary Terminal', city: 'Calgary', province: 'Alberta', country: 'Canada', timezone: 'America/Edmonton', createdAt: '2026-07-13T10:00:00Z', updatedAt: '2026-07-13T10:00:00Z', snapshot });
    vi.mocked(terminalApi.inventory).mockResolvedValue({ terminalId: 1, terminalCode: 'YYC', snapshot, packages: [{ id: 'package-1', trackingNumber: 'PKG-100', packageType: 'CONVEYABLE', currentStatus: 'RECEIVED', currentTerminalId: 1, currentContainerId: null, currentTrailerId: null, currentRouteId: null, currentTruckId: null, updatedAt: '2026-07-13T12:00:00Z' }], containers: [], trailers: [] });
    vi.mocked(terminalApi.operations).mockResolvedValue({ terminalId: 1, terminalCode: 'YYC', status: 'ACTIVE', activeTripCount: 3, employeeCount: 4, lastActivityAt: '2026-07-13T12:00:00Z', recentEvents: [] });
    vi.mocked(terminalApi.history).mockResolvedValue([{ id: 'event-1', terminalId: 1, eventType: 'PACKAGE_RECEIVED', employeeId: 7, correlationId: 'request-1', createdAt: '2026-07-13T12:00:00Z' }]);
    vi.mocked(terminalApi.employees).mockResolvedValue([{ id: 'user-1', employeeNumber: 'EMP-100', email: 'operator@example.com', firstName: 'Avery', lastName: 'Singh', currentStatus: 'ACTIVE', roleNames: ['OPERATOR'], lastActivityAt: '2026-07-13T12:00:00Z' }]);
    vi.mocked(terminalApi.movements).mockResolvedValue([{ id: 'stop-1:inbound', direction: 'INBOUND', tripId: 'trip-1', tripNumber: 'TRIP-100', trailerBarcode: 'TRL-100', plannedAt: '2026-07-13T11:45:00Z', actualAt: '2026-07-13T12:00:00Z', delayMinutes: 15 }]);
    vi.mocked(terminalApi.performance).mockResolvedValue({ id: 1, terminalCode: 'YYC', name: 'Calgary Terminal', city: 'Calgary', province: 'Alberta', currentStatus: 'ACTIVE', inventory: { packages: 1, containers: 1, trailers: 1, employees: 4 }, metrics: { packagesProcessed: 12, deliveredPackages: 8, committedDeliveries: 8, onTimeDeliveries: 6, deliveryOnTimePerformance: 75, lateDeliveries: 2, deliveryAttempts: 1, totalArrivals: 4, onTimeArrivals: 3, onTimePerformance: 75, lateArrivals: 1, inboundTrailers: 4, outboundTrailers: 3 } });
  });

  it('renders linked terminal tabs for inventory, movements, employees, and performance', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Calgary Terminal' })).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'Packages' }));
    expect(screen.getByRole('link', { name: 'PKG-100' }).getAttribute('href')).toBe('/packages/PKG-100');

    await user.click(screen.getByRole('tab', { name: 'Trailers' }));
    expect(screen.getByText('Inbound trailers')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'TRIP-100' }).getAttribute('href')).toBe('/trips/trip-1');

    await user.click(screen.getByRole('tab', { name: 'Employees' }));
    expect(screen.getByText('Avery Singh')).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'Performance' }));
    expect(screen.getByText('PACKAGE RECEIVED')).toBeTruthy();
    expect(screen.getByText('75%')).toBeTruthy();
    expect(terminalApi.inventory).toHaveBeenCalledWith(1);
  });
});
