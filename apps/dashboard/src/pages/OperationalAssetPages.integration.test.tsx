import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dashboardApi } from '../services/dashboard.api';
import { ContainerListPage } from './ContainerListPage';
import { PackageListPage } from './PackageListPage';
import { TrailerListPage } from './TrailerListPage';

vi.mock('../services/dashboard.api', () => ({
  dashboardApi: {
    packages: vi.fn(),
    containers: vi.fn(),
    trailers: vi.fn(),
    terminals: vi.fn(),
  },
}));

const renderPage = (page: React.ReactNode) => render(
  <MemoryRouter>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {page}
    </QueryClientProvider>
  </MemoryRouter>,
);

describe('operational asset list pages', () => {
  beforeEach(() => {
    vi.mocked(dashboardApi.packages).mockResolvedValue([
      { trackingNumber: 'PKG000000001', status: 'IN_CONTAINER', containerBarcode: 'CONT000001', trailerBarcode: 'TRLR000001', updatedAt: '2026-07-10T12:00:00.000Z', originTerminalId: 1, destinationTerminalId: 2 },
      { trackingNumber: 'PKG000000002', status: 'DELIVERED', containerBarcode: null, trailerBarcode: null, updatedAt: '2026-07-11T12:00:00.000Z', originTerminalId: 2, destinationTerminalId: 1 },
    ]);
    vi.mocked(dashboardApi.containers).mockResolvedValue([
      { containerBarcode: 'CONT000001', status: 'OPEN', packageCount: 4, assignedTrailer: 'TRLR000001' },
    ]);
    vi.mocked(dashboardApi.trailers).mockResolvedValue([
      { trailerBarcode: 'TRLR000001', status: 'IN_TRANSIT', containerCount: 2, packageCount: 11 },
    ]);
    vi.mocked(dashboardApi.terminals).mockResolvedValue([
      { id: 1, terminalCode: 'CAL', name: 'Calgary-000', city: 'Calgary' },
      { id: 2, terminalCode: 'EDM', name: 'Edmonton-000', city: 'Edmonton' },
    ]);
  });

  it('sends date, lane, and status package filters to the API', async () => {
    const user = userEvent.setup();
    renderPage(<PackageListPage/>);
    await screen.findByRole('link', { name: 'PKG000000001' });

    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-07-31' } });
    await user.selectOptions(screen.getByLabelText('Origin terminal'), '1');
    await user.selectOptions(screen.getByLabelText('Destination terminal'), '2');
    await user.selectOptions(screen.getByLabelText('Package status'), 'IN_TRAILER');

    await waitFor(() => expect(dashboardApi.packages).toHaveBeenLastCalledWith({
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
      originTerminalId: 1,
      destinationTerminalId: 2,
      status: 'IN_TRAILER',
    }));

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(dashboardApi.packages).toHaveBeenLastCalledWith({}));
  });

  it('loads package snapshots and filters the visible rows', async () => {
    const user = userEvent.setup();
    renderPage(<PackageListPage/>);

    expect((await screen.findByRole('link', { name: 'PKG000000001' })).getAttribute('href')).toBe('/packages/PKG000000001');
    expect(dashboardApi.packages).toHaveBeenCalledOnce();

    await user.type(screen.getByRole('textbox', { name: /Filter packages/ }), 'delivered');
    expect(screen.queryByRole('link', { name: 'PKG000000001' })).toBeNull();
    expect(screen.getByRole('link', { name: 'PKG000000002' })).toBeTruthy();
  });

  it('loads container snapshots with trailer assignments', async () => {
    renderPage(<ContainerListPage/>);

    expect((await screen.findByRole('link', { name: 'CONT000001' })).getAttribute('href')).toBe('/containers/CONT000001');
    expect(screen.getByRole('link', { name: 'TRLR000001' }).getAttribute('href')).toBe('/trailers/TRLR000001');
    expect(screen.getByText('4')).toBeTruthy();
    expect(dashboardApi.containers).toHaveBeenCalledOnce();
  });

  it('sends date, lane, and status container filters to the API', async () => {
    const user = userEvent.setup();
    renderPage(<ContainerListPage/>);
    await screen.findByRole('link', { name: 'CONT000001' });

    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-07-31' } });
    await user.selectOptions(screen.getByLabelText('Origin terminal'), '1');
    await user.selectOptions(screen.getByLabelText('Destination terminal'), '2');
    await user.selectOptions(screen.getByLabelText('Container status'), 'CLOSED');

    await waitFor(() => expect(dashboardApi.containers).toHaveBeenLastCalledWith({
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
      originTerminalId: 1,
      destinationTerminalId: 2,
      status: 'CLOSED',
    }));
  });

  it('loads trailer snapshots with current freight totals', async () => {
    renderPage(<TrailerListPage/>);

    expect((await screen.findByRole('link', { name: 'TRLR000001' })).getAttribute('href')).toBe('/trailers/TRLR000001');
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('11')).toBeTruthy();
    expect(dashboardApi.trailers).toHaveBeenCalledOnce();
  });

  it('sends date, lane, and status trailer filters to the API', async () => {
    const user = userEvent.setup();
    renderPage(<TrailerListPage/>);
    await screen.findByRole('link', { name: 'TRLR000001' });

    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-07-31' } });
    await user.selectOptions(screen.getByLabelText('Origin terminal'), '1');
    await user.selectOptions(screen.getByLabelText('Destination terminal'), '2');
    await user.selectOptions(screen.getByLabelText('Trailer status'), 'IN_TRANSIT');

    await waitFor(() => expect(dashboardApi.trailers).toHaveBeenLastCalledWith({
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
      originTerminalId: 1,
      destinationTerminalId: 2,
      status: 'IN_TRANSIT',
    }));
  });
});
