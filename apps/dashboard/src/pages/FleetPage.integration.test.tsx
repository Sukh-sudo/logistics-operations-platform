import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fleetApi } from '../services/fleet.api';
import { FleetPage } from './FleetPage';

vi.mock('../services/fleet.api', () => ({ fleetApi: { trucks: vi.fn(), drivers: vi.fn(), assignments: vi.fn(), terminals: vi.fn() } }));

describe('FleetPage', () => {
  beforeEach(() => {
    vi.mocked(fleetApi.trucks).mockResolvedValue([{ id: 'truck-1', unitNumber: 'LMCAL00001', purpose: 'LAST_MILE', licensePlate: 'ABC-123', status: 'ASSIGNED', year: 2025, make: 'Freightliner', model: 'Cascadia', terminal: { id: 1, terminalCode: 'CAL', name: 'Calgary' }, snapshot: { currentStatus: 'ASSIGNED', currentTerminalId: 1, assignedTripId: 'trip-1', lastActivityAt: null } }]);
    vi.mocked(fleetApi.drivers).mockResolvedValue([]);
    vi.mocked(fleetApi.assignments).mockResolvedValue([{ id: 'assignment-1', status: 'ACTIVE', assignedAt: '2026-07-12T12:00:00Z', releasedAt: null, trip: { id: 'trip-1', tripNumber: 'TRIP-100', status: 'CREATED' }, truck: { id: 'truck-1', unitNumber: 'TRK-100', licensePlate: 'ABC-123' }, driver: { id: 'driver-1', employeeId: 'DRV-100', licenseNumber: 'LIC-100' }, trailer: { id: 'trailer-1', trailerBarcode: 'TRL-100', currentStatus: 'OPEN' } }]);
    vi.mocked(fleetApi.terminals).mockResolvedValue([{ id: 1, terminalCode: 'CAL', name: 'Calgary-000', city: 'Calgary' }]);
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

  it('filters each fleet tab by terminal and its own statuses', async () => {
    const user = userEvent.setup();
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FleetPage/></QueryClientProvider>);
    await screen.findByText('LMCAL00001');

    await user.selectOptions(screen.getByLabelText('Terminal'), '1');
    await user.selectOptions(screen.getByLabelText('Fleet status'), 'MAINTENANCE');
    await waitFor(() => expect(fleetApi.trucks).toHaveBeenLastCalledWith({ terminalId: 1, status: 'MAINTENANCE' }));

    await user.click(screen.getByRole('button', { name: /Drivers/ }));
    expect((screen.getByLabelText('Fleet status') as HTMLSelectElement).value).toBe('');
    await user.selectOptions(screen.getByLabelText('Fleet status'), 'OFF_DUTY');
    await waitFor(() => expect(fleetApi.drivers).toHaveBeenLastCalledWith({ terminalId: 1, status: 'OFF_DUTY' }));

    await user.click(screen.getByRole('button', { name: /Assignments/ }));
    await user.selectOptions(screen.getByLabelText('Fleet status'), 'RELEASED');
    await waitFor(() => expect(fleetApi.assignments).toHaveBeenLastCalledWith({ terminalId: 1, status: 'RELEASED' }));
  });
});
