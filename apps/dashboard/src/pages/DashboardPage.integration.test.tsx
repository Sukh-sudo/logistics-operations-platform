import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dashboardApi } from '../services/dashboard.api';
import { DashboardPage } from './DashboardPage';

vi.mock('../services/dashboard.api', () => ({
  dashboardApi: {
    summary: vi.fn(),
    events: vi.fn(),
    terminals: vi.fn(),
    handheldKpis: vi.fn(),
    terminalPerformance: vi.fn(),
  },
}));

const summary = {
  packages: { received: 2, sorted: 1, inContainer: 0, inTrailer: 0, departed: 0, arrived: 0, outForDelivery: 0, delivered: 1, attemptedDelivery: 0, damaged: 0, misrouted: 0, returnedToTerminal: 0 },
  containers: { open: 2, closed: 1, loaded: 1 },
  trailers: { open: 1, closed: 1, inTransit: 1, arrived: 0 },
};
const renderPage = () => render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><DashboardPage/></QueryClientProvider></MemoryRouter>);

describe('DashboardPage filtering integration', () => {
  beforeEach(() => {
    vi.mocked(dashboardApi.summary).mockResolvedValue(summary);
    vi.mocked(dashboardApi.events).mockResolvedValue([]);
    vi.mocked(dashboardApi.terminals).mockResolvedValue([
      { id: 1, terminalCode: 'TEST-CODE-ONE', name: 'Calgary-000', city: 'Calgary' },
      { id: 2, terminalCode: 'TEST-CODE-TWO', name: 'Edmonton-000', city: 'Edmonton' },
    ]);
    vi.mocked(dashboardApi.handheldKpis).mockResolvedValue({
      acceptedPackages: 12,
      rejectedScans: 1,
      duplicateScans: 2,
      reversals: 1,
      damagedPackages: 1,
      misroutedPackages: 1,
      gpsMissingEvents: 2,
      synchronizationFailures: 0,
      closedContainersNotLoaded: 1,
      activeEmployees: 3,
      operationallyInactiveEmployees: 1,
      activeSeconds: 3600,
      terminalPackagesPerHour: 12,
    });
    vi.mocked(dashboardApi.terminalPerformance).mockResolvedValue([
      { id: 1, terminalCode: 'TEST-CODE-ONE', name: 'Calgary-000', city: 'Calgary', province: 'AB', currentStatus: 'ACTIVE', inventory: { packages: 10, containers: 2, trailers: 1, employees: 3 }, metrics: { packagesProcessed: 15, deliveredPackages: 9, committedDeliveries: 8, onTimeDeliveries: 6, deliveryOnTimePerformance: 75, lateDeliveries: 2, deliveryAttempts: 1, totalArrivals: 4, onTimeArrivals: 3, onTimePerformance: 75, lateArrivals: 1, inboundTrailers: 4, outboundTrailers: 3 } },
      { id: 2, terminalCode: 'TEST-CODE-TWO', name: 'Edmonton-000', city: 'Edmonton', province: 'AB', currentStatus: 'ACTIVE', inventory: { packages: 8, containers: 1, trailers: 2, employees: 2 }, metrics: { packagesProcessed: 11, deliveredPackages: 7, committedDeliveries: 7, onTimeDeliveries: 7, deliveryOnTimePerformance: 100, lateDeliveries: 0, deliveryAttempts: 0, totalArrivals: 2, onTimeArrivals: 2, onTimePerformance: 100, lateArrivals: 0, inboundTrailers: 2, outboundTrailers: 2 } },
    ]);
  });

  it('sends the combined date, terminal, trailer, and package filters to both reads', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Packages tracked');

    expect(screen.getByRole('option', { name: 'Calgary-000' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /TEST-CODE/ })).toBeNull();

    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-07-22' } });
    await user.selectOptions(screen.getByLabelText('Terminal'), '2');
    await user.selectOptions(screen.getByLabelText('Trailer status'), 'IN_TRANSIT');
    await user.selectOptions(screen.getByLabelText('Package status'), 'OUT_FOR_DELIVERY');

    const expected = {
      fromDate: '2026-07-01',
      toDate: '2026-07-22',
      terminalId: 2,
      trailerStatus: 'IN_TRANSIT',
      packageStatus: 'OUT_FOR_DELIVERY',
    };
    await waitFor(() => expect(dashboardApi.summary).toHaveBeenCalledWith(expected));
    expect(dashboardApi.events).toHaveBeenCalledWith(expected);
    await waitFor(() => expect(dashboardApi.handheldKpis).toHaveBeenCalledWith({
      from: '2026-07-01T00:00:00.000Z',
      to: '2026-07-22T23:59:59.999Z',
      terminalId: 2,
    }));
    await waitFor(() => expect(dashboardApi.terminalPerformance).toHaveBeenCalledWith({
      fromDate: '2026-07-01',
      toDate: '2026-07-22',
      terminalId: 2,
    }));
  });

  it('clears every active dashboard filter', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Packages tracked');
    await user.selectOptions(screen.getByLabelText('Terminal'), '1');
    await user.selectOptions(screen.getByLabelText('Package status'), 'DELIVERED');
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect((screen.getByLabelText('Terminal') as HTMLSelectElement).value).toBe('');
    expect((screen.getByLabelText('Package status') as HTMLSelectElement).value).toBe('');
    await waitFor(() => expect(dashboardApi.summary).toHaveBeenCalledWith({}));
  });

  it('links terminal tiles to the tabbed workspace with the selected dates', async () => {
    renderPage();
    await screen.findByText('Terminal performance');
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-07-22' } });

    await waitFor(() => expect(screen.getByRole('link', { name: 'View Calgary-000 terminal details' }).getAttribute('href'))
      .toBe('/terminals/1?tab=overview&fromDate=2026-07-01&toDate=2026-07-22'));
    expect(screen.getByText('75%')).toBeTruthy();
  });
});
