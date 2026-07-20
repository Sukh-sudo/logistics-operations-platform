import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
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
      { trackingNumber: 'PKG000000001', status: 'IN_CONTAINER', containerBarcode: 'CONT000001', trailerBarcode: 'TRLR000001' },
      { trackingNumber: 'PKG000000002', status: 'DELIVERED', containerBarcode: null, trailerBarcode: null },
    ]);
    vi.mocked(dashboardApi.containers).mockResolvedValue([
      { containerBarcode: 'CONT000001', status: 'OPEN', packageCount: 4, assignedTrailer: 'TRLR000001' },
    ]);
    vi.mocked(dashboardApi.trailers).mockResolvedValue([
      { trailerBarcode: 'TRLR000001', status: 'IN_TRANSIT', containerCount: 2, packageCount: 11 },
    ]);
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

  it('loads trailer snapshots with current freight totals', async () => {
    renderPage(<TrailerListPage/>);

    expect((await screen.findByRole('link', { name: 'TRLR000001' })).getAttribute('href')).toBe('/trailers/TRLR000001');
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('11')).toBeTruthy();
    expect(dashboardApi.trailers).toHaveBeenCalledOnce();
  });
});
