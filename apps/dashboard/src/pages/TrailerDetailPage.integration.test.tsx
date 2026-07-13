import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trailerApi } from '../services/trailer.api';
import { TrailerDetailPage } from './TrailerDetailPage';

vi.mock('../services/trailer.api', () => ({ trailerApi: { snapshot: vi.fn(), containers: vi.fn(), packages: vi.fn(), history: vi.fn() } }));
const barcode = 'TRL-100';
const renderPage = () => render(<MemoryRouter initialEntries={[`/trailers/${barcode}`]}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Routes><Route path="/trailers/:trailerBarcode" element={<TrailerDetailPage/>}/></Routes></QueryClientProvider></MemoryRouter>);

describe('TrailerDetailPage integration', () => {
  beforeEach(() => {
    vi.mocked(trailerApi.snapshot).mockResolvedValue({ id: 'trailer-1', trailerBarcode: barcode, currentStatus: 'OPEN', currentTerminalId: 1, containerCount: 1, packageCount: 1, updatedAt: '2026-07-12T12:00:00Z' });
    vi.mocked(trailerApi.containers).mockResolvedValue({ trailerBarcode: barcode, containerCount: 1, containers: [{ id: 'container-1', containerBarcode: 'CNT-100', packageType: 'CONVEYABLE', currentStatus: 'OPEN', currentTrailerId: 'trailer-1', currentTerminalId: 1, packageCount: 1, updatedAt: '2026-07-12T12:00:00Z' }] });
    vi.mocked(trailerApi.packages).mockResolvedValue({ trailerBarcode: barcode, packageCount: 1, packages: [{ trackingNumber: 'PKG-100', currentStatus: 'IN_TRAILER', location: 'CONTAINER', containerBarcode: 'CNT-100' }] });
    vi.mocked(trailerApi.history).mockResolvedValue([{ id: 'event-1', trailerId: 'trailer-1', eventType: 'TRAILER_CREATED', createdAt: '2026-07-12T11:00:00Z' }]);
  });

  it('renders snapshot, manifest links, and immutable history', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: barcode })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'CNT-100' }).getAttribute('href')).toBe('/containers/CNT-100');
    expect(screen.getByRole('link', { name: 'PKG-100' }).getAttribute('href')).toBe('/packages/PKG-100');
    expect(screen.getByText('TRAILER CREATED')).toBeTruthy();
    expect(trailerApi.history).toHaveBeenCalledWith(barcode);
  });
});
