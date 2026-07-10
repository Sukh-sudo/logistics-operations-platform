import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { containerApi } from '../services/container.api';
import { ContainerDetailPage } from './ContainerDetailPage';

vi.mock('../services/container.api', () => ({ containerApi: { snapshot: vi.fn(), packages: vi.fn(), history: vi.fn() } }));
const containerBarcode = 'CONTAINER-10';
const renderPage = () => render(<MemoryRouter initialEntries={[`/containers/${containerBarcode}`]}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Routes><Route path="/containers/:containerBarcode" element={<ContainerDetailPage/>}/></Routes></QueryClientProvider></MemoryRouter>);

describe('ContainerDetailPage integration', () => {
  beforeEach(() => {
    vi.mocked(containerApi.snapshot).mockResolvedValue({ id: 'container-1', containerBarcode, packageType: 'CONVEYABLE', currentStatus: 'OPEN', currentTrailerId: 'TRAILER-9', currentTerminalId: 2, packageCount: 1, updatedAt: '2026-07-08T12:00:00Z' });
    vi.mocked(containerApi.packages).mockResolvedValue({ containerBarcode, packageCount: 1, packages: [{ id: 'package-1', trackingNumber: 'PKG-100', packageType: 'CONVEYABLE', currentStatus: 'IN_CONTAINER', currentTerminalId: 2, currentContainerId: 'container-1', currentTrailerId: null, updatedAt: '2026-07-08T12:15:00Z' }] });
    vi.mocked(containerApi.history).mockResolvedValue([{ id: 'event-1', containerId: 'container-1', eventType: 'CONTAINER_CREATED', employeeId: 7, metadata: null, createdAt: '2026-07-08T11:00:00Z' }]);
  });

  it('loads the container snapshot, assigned packages, and immutable history', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: containerBarcode })).toBeTruthy();
    expect(screen.getByText('PKG-100')).toBeTruthy();
    expect(screen.getByText('CONTAINER CREATED')).toBeTruthy();
    expect(containerApi.snapshot).toHaveBeenCalledWith(containerBarcode);
    expect(containerApi.packages).toHaveBeenCalledWith(containerBarcode);
    expect(containerApi.history).toHaveBeenCalledWith(containerBarcode);
  });

  it('links packages while displaying the trailer snapshot assignment', async () => {
    renderPage();
    expect((await screen.findByRole('link', { name: 'PKG-100' })).getAttribute('href')).toBe('/packages/PKG-100');
    expect(screen.getByText('TRAILER-9')).toBeTruthy();
  });
});
