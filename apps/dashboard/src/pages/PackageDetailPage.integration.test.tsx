import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { packageApi } from '../services/package.api';
import { PackageDetailPage } from './PackageDetailPage';

vi.mock('../services/package.api', () => ({ packageApi: { snapshot: vi.fn(), location: vi.fn(), history: vi.fn() } }));
const trackingNumber = 'CON1234567';
const renderPage = () => render(<MemoryRouter initialEntries={[`/packages/${trackingNumber}`]}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Routes><Route path="/packages/:trackingNumber" element={<PackageDetailPage/>}/></Routes></QueryClientProvider></MemoryRouter>);

describe('PackageDetailPage integration', () => {
  beforeEach(() => {
    vi.mocked(packageApi.snapshot).mockResolvedValue({ id: 'package-1', trackingNumber, packageType: 'CONVEYABLE', currentStatus: 'IN_CONTAINER', currentTerminalId: 2, currentContainerId: 'container-1', currentTrailerId: null, updatedAt: '2026-07-07T12:00:00Z' });
    vi.mocked(packageApi.location).mockResolvedValue({ trackingNumber, currentStatus: 'IN_CONTAINER', containerBarcode: 'CONTAINER-10', trailerBarcode: null });
    vi.mocked(packageApi.history).mockResolvedValue([{ id: 'event-1', packageId: 'package-1', eventType: 'PACKAGE_RECEIVED', terminalId: 1, employeeId: 9, metadata: null, createdAt: '2026-07-06T12:00:00Z' }]);
  });

  it('loads and combines the snapshot, resolved location, and immutable history', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: trackingNumber })).toBeTruthy();
    expect(screen.getByText('CONTAINER-10')).toBeTruthy();
    expect(screen.getByText('PACKAGE RECEIVED')).toBeTruthy();
    expect(packageApi.snapshot).toHaveBeenCalledWith(trackingNumber);
    expect(packageApi.location).toHaveBeenCalledWith(trackingNumber);
    expect(packageApi.history).toHaveBeenCalledWith(trackingNumber);
  });

  it('links resolved assignments to their future detail workspace', async () => {
    renderPage();
    expect((await screen.findByRole('link', { name: 'Open' })).getAttribute('href')).toBe('/containers/CONTAINER-10');
  });
});
