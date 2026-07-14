import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { terminalApi } from '../services/terminal.api';
import { TerminalDetailPage } from './TerminalDetailPage';

vi.mock('../services/terminal.api', () => ({ terminalApi: { detail: vi.fn(), inventory: vi.fn(), operations: vi.fn(), history: vi.fn() } }));
const snapshot = { currentStatus: 'ACTIVE', packageCount: 1, containerCount: 1, trailerCount: 1, truckCount: 2, activeTripCount: 3, employeeCount: 4, lastActivityAt: '2026-07-13T12:00:00Z' };
const renderPage = () => render(<MemoryRouter initialEntries={['/terminals/1']}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Routes><Route path="/terminals/:terminalId" element={<TerminalDetailPage/>}/></Routes></QueryClientProvider></MemoryRouter>);

describe('TerminalDetailPage integration', () => {
  beforeEach(() => {
    vi.mocked(terminalApi.detail).mockResolvedValue({ id: 1, terminalCode: 'YYC', name: 'Calgary Terminal', city: 'Calgary', province: 'Alberta', country: 'Canada', timezone: 'America/Edmonton', createdAt: '2026-07-13T10:00:00Z', updatedAt: '2026-07-13T10:00:00Z', snapshot });
    vi.mocked(terminalApi.inventory).mockResolvedValue({ terminalId: 1, terminalCode: 'YYC', snapshot, packages: [{ id: 'package-1', trackingNumber: 'PKG-100', packageType: 'CONVEYABLE', currentStatus: 'RECEIVED', currentTerminalId: 1, currentContainerId: null, currentTrailerId: null, updatedAt: '2026-07-13T12:00:00Z' }], containers: [], trailers: [] });
    vi.mocked(terminalApi.operations).mockResolvedValue({ terminalId: 1, terminalCode: 'YYC', status: 'ACTIVE', activeTripCount: 3, employeeCount: 4, lastActivityAt: '2026-07-13T12:00:00Z', recentEvents: [] });
    vi.mocked(terminalApi.history).mockResolvedValue([{ id: 'event-1', terminalId: 1, eventType: 'PACKAGE_RECEIVED', employeeId: 7, correlationId: 'request-1', createdAt: '2026-07-13T12:00:00Z' }]);
  });

  it('renders snapshot metrics, linked inventory, operations, and history', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Calgary Terminal' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'PKG-100' }).getAttribute('href')).toBe('/packages/PKG-100');
    expect(screen.getByText('PACKAGE RECEIVED')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(terminalApi.inventory).toHaveBeenCalledWith(1);
  });
});
