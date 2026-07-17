import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fleetApi } from '../services/fleet.api';
import { FleetAssetDetailPage } from './FleetAssetDetailPage';

vi.mock('../services/fleet.api', () => ({ fleetApi: { truck: vi.fn(), driver: vi.fn(), assignments: vi.fn() } }));

const renderPage = (page: React.ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter>{page}</MemoryRouter></QueryClientProvider>);

describe('FleetAssetDetailPage', () => {
  beforeEach(() => {
    vi.mocked(fleetApi.assignments).mockResolvedValue([{ id: 'assignment-1', status: 'ACTIVE', assignedAt: '2026-07-12T12:00:00Z', releasedAt: null, trip: { id: 'trip-1', tripNumber: 'TRIP-100', status: 'CREATED' }, truck: { id: 'truck-1', unitNumber: 'TRK-100', licensePlate: 'ABC-123' }, driver: { id: 'driver-1', employeeId: 'DRV-100', licenseNumber: 'LIC-100' } }]);
  });

  it('renders a truck snapshot and its immutable assignment history', async () => {
    vi.mocked(fleetApi.truck).mockResolvedValue({ id: 'truck-1', unitNumber: 'TRK-100', licensePlate: 'ABC-123', status: 'ASSIGNED', year: 2025, make: 'Freightliner', model: 'Cascadia', terminal: { id: 1, terminalCode: 'YYC', name: 'Calgary' }, snapshot: { currentStatus: 'ASSIGNED', currentTerminalId: 1, assignedTripId: 'trip-1', lastActivityAt: '2026-07-12T12:00:00Z' } });
    renderPage(<FleetAssetDetailPage kind="truck" id="truck-1"/>);
    expect(await screen.findByRole('heading', { name: /TRK-100/ })).toBeTruthy();
    expect(screen.getByText('2025 Freightliner Cascadia')).toBeTruthy();
    expect(screen.getByText('TRIP-100')).toBeTruthy();
  });

  it('renders a driver snapshot', async () => {
    vi.mocked(fleetApi.driver).mockResolvedValue({ id: 'driver-1', employeeId: 'DRV-100', licenseNumber: 'LIC-100', licenseClass: 'Class 1', status: 'AVAILABLE', terminal: null, snapshot: { currentStatus: 'AVAILABLE', currentTerminalId: null, assignedTripId: null, lastActivityAt: null } });
    renderPage(<FleetAssetDetailPage kind="driver" id="driver-1"/>);
    expect(await screen.findByRole('heading', { name: /DRV-100/ })).toBeTruthy();
    expect(screen.getByText('Class 1')).toBeTruthy();
  });
});
