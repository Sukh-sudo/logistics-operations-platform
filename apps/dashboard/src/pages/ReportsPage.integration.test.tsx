import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { reportingApi } from '../services/reporting.api';
import { transportationApi } from '../services/transportation.api';
import { ReportsPage } from './ReportsPage';

vi.mock('../services/reporting.api', () => ({
  reportingApi: { deliveries: vi.fn() },
}));
vi.mock('../services/transportation.api', () => ({
  transportationApi: { terminals: vi.fn() },
}));

const report = {
  filters: {
    fromDate: null,
    toDate: null,
    originTerminalId: null,
    destinationTerminalId: null,
  },
  totals: {
    totalShipments: 3,
    completedShipments: 2,
    activeShipments: 1,
    cancelledShipments: 0,
    totalPackages: 5,
    deliveredPackages: 4,
    completionRate: 67,
  },
  statusBreakdown: {
    CREATED: 0,
    PACKAGES_ASSIGNED: 0,
    IN_TRANSIT: 1,
    PARTIALLY_DELIVERED: 0,
    COMPLETED: 2,
    CANCELLED: 0,
  },
  deliveries: [
    {
      shipmentNumber: 'SHIP-100',
      status: 'COMPLETED',
      packageCount: 2,
      deliveredPackages: 2,
      progressPercent: 100,
      createdAt: '2026-07-20T12:00:00Z',
      completedAt: '2026-07-21T12:00:00Z',
    },
  ],
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false } },
          })
        }
      >
        <ReportsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );

describe('ReportsPage integration', () => {
  beforeEach(() => {
    vi.mocked(reportingApi.deliveries).mockResolvedValue(report);
    vi.mocked(transportationApi.terminals).mockResolvedValue([
      {
        id: 1,
        terminalCode: 'YYC',
        name: 'Calgary-000',
        city: 'Calgary',
        province: 'Alberta',
        country: 'Canada',
        createdAt: '2026-07-01T12:00:00Z',
        snapshot: null,
      },
      {
        id: 2,
        terminalCode: 'YEG',
        name: 'Edmonton-000',
        city: 'Edmonton',
        province: 'Alberta',
        country: 'Canada',
        createdAt: '2026-07-01T12:00:00Z',
        snapshot: null,
      },
    ]);
  });

  it('renders report metrics and sends selected delivery filters', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('67% completion rate')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Report from date'), {
      target: { value: '2026-07-01' },
    });
    fireEvent.change(screen.getByLabelText('Report to date'), {
      target: { value: '2026-07-23' },
    });
    await user.selectOptions(screen.getByLabelText('Report origin'), '1');
    await user.selectOptions(
      screen.getByLabelText('Report destination'),
      '2',
    );
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() =>
      expect(reportingApi.deliveries).toHaveBeenCalledWith({
        fromDate: '2026-07-01',
        toDate: '2026-07-23',
        originTerminalId: 1,
        destinationTerminalId: 2,
      }),
    );
    expect(
      screen.getByRole('link', { name: 'SHIP-100' }).getAttribute('href'),
    ).toBe('/tracking/SHIP-100');
  });

  it('clears active report filters', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Shipment deliveries');

    fireEvent.change(screen.getByLabelText('Report from date'), {
      target: { value: '2026-07-01' },
    });
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() =>
      expect(reportingApi.deliveries).toHaveBeenLastCalledWith({
        fromDate: '2026-07-01',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(
      (screen.getByLabelText('Report from date') as HTMLInputElement).value,
    ).toBe('');
    await waitFor(() =>
      expect(reportingApi.deliveries).toHaveBeenLastCalledWith({}),
    );
  });
});
