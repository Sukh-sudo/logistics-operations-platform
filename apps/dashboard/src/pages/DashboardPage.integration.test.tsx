import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dashboardApi } from '../services/dashboard.api';
import { DashboardPage } from './DashboardPage';

vi.mock('../services/dashboard.api', () => ({
  dashboardApi: {
    summary: vi.fn(),
    events: vi.fn(),
    terminals: vi.fn(),
  },
}));

const summary = {
  packages: { received: 2, sorted: 1, inContainer: 0, inTrailer: 0, departed: 0, arrived: 0, outForDelivery: 0, delivered: 1 },
  containers: { open: 2, closed: 1, loaded: 1 },
  trailers: { open: 1, closed: 1, inTransit: 1, arrived: 0 },
};

describe('DashboardPage filtering integration', () => {
  beforeEach(() => {
    vi.mocked(dashboardApi.summary).mockResolvedValue(summary);
    vi.mocked(dashboardApi.events).mockResolvedValue([]);
    vi.mocked(dashboardApi.terminals).mockResolvedValue([
      { id: 1, terminalCode: 'TEST-CODE-ONE', name: 'Calgary-000', city: 'Calgary' },
      { id: 2, terminalCode: 'TEST-CODE-TWO', name: 'Edmonton-000', city: 'Edmonton' },
    ]);
  });

  it('sends the combined date, terminal, trailer, and package filters to both reads', async () => {
    const user = userEvent.setup();
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><DashboardPage/></QueryClientProvider>);
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
  });

  it('clears every active dashboard filter', async () => {
    const user = userEvent.setup();
    render(<QueryClientProvider client={new QueryClient()}><DashboardPage/></QueryClientProvider>);
    await screen.findByText('Packages tracked');
    await user.selectOptions(screen.getByLabelText('Terminal'), '1');
    await user.selectOptions(screen.getByLabelText('Package status'), 'DELIVERED');
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect((screen.getByLabelText('Terminal') as HTMLSelectElement).value).toBe('');
    expect((screen.getByLabelText('Package status') as HTMLSelectElement).value).toBe('');
    await waitFor(() => expect(dashboardApi.summary).toHaveBeenCalledWith({}));
  });
});
