import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fleetApi } from '../services/fleet.api';
import { FleetPage } from './FleetPage';

vi.mock('../services/fleet.api', () => ({ fleetApi: { trucks: vi.fn(), drivers: vi.fn(), assignments: vi.fn() } }));

describe('FleetPage', () => {
  beforeEach(() => {
    vi.mocked(fleetApi.trucks).mockResolvedValue([{ id: 'truck-1', unitNumber: 'LMCAL00001', purpose: 'LAST_MILE', licensePlate: 'ABC-123', status: 'ASSIGNED', year: 2025, make: 'Freightliner', model: 'Cascadia', terminal: { id: 1, terminalCode: 'CAL', name: 'Calgary' }, snapshot: { currentStatus: 'ASSIGNED', currentTerminalId: 1, assignedTripId: 'trip-1', lastActivityAt: null } }]);
    vi.mocked(fleetApi.drivers).mockResolvedValue([]);
    vi.mocked(fleetApi.assignments).mockResolvedValue([{ id: 'assignment-1', status: 'ACTIVE', assignedAt: '2026-07-12T12:00:00Z', releasedAt: null, trip: { id: 'trip-1', tripNumber: 'TRIP-100', status: 'CREATED' }, truck: { id: 'truck-1', unitNumber: 'TRK-100', licensePlate: 'ABC-123' }, driver: { id: 'driver-1', employeeId: 'DRV-100', licenseNumber: 'LIC-100' }, trailer: { id: 'trailer-1', trailerBarcode: 'TRL-100', currentStatus: 'OPEN' } }]);
  });

  it('shows snapshot-backed trucks and assignment history', async () => {
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FleetPage/></QueryClientProvider>);
    expect(await screen.findByText('LMCAL00001')).toBeTruthy();
    expect(screen.getByText('LAST MILE')).toBeTruthy();
    expect(screen.getByText('ASSIGNED')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Assignments/ }));
    expect(await screen.findByText('TRIP-100')).toBeTruthy();
    expect(screen.getByText('DRV-100')).toBeTruthy();
  });
});
