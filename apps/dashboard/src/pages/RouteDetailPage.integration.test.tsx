import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routeApi } from '../services/route.api';
import { RouteDetailPage } from './RouteDetailPage';

vi.mock('../services/route.api', () => ({ routeApi: { detail: vi.fn() } }));
const terminal = (id: number, code: string, name: string) => ({ id, terminalCode: code, name, city: name, province: 'Alberta', country: 'Canada', timezone: 'America/Edmonton', createdAt: '', updatedAt: '', snapshot: null });

describe('RouteDetailPage integration', () => {
  beforeEach(() => vi.mocked(routeApi.detail).mockResolvedValue({ id: 'route-1', routeNumber: 'R-YYC-YEG', name: 'Calgary to Edmonton', status: 'ACTIVE', estimatedDistance: 300, estimatedDuration: 180, createdAt: '', updatedAt: '', originTerminalId: 1, destinationTerminalId: 3, originTerminal: terminal(1, 'YYC', 'Calgary'), destinationTerminal: terminal(3, 'YEG', 'Edmonton'), stops: [{ id: 'stop-1', terminalId: 2, sequence: 1, estimatedArrivalOffset: 75, estimatedDepartureOffset: 90, terminal: terminal(2, 'YQF', 'Red Deer') }], snapshot: { currentStatus: 'ACTIVE', stopCount: 1, estimatedDistance: 300, estimatedDuration: 180, lastActivityAt: null } }));
  it('renders snapshot metrics and links the ordered terminal itinerary', async () => {
    render(<MemoryRouter initialEntries={['/routes/route-1']}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Routes><Route path="/routes/:routeId" element={<RouteDetailPage/>}/></Routes></QueryClientProvider></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Calgary to Edmonton' })).toBeTruthy();
    expect(screen.getByText('300 km')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Red Deer' }).getAttribute('href')).toBe('/terminals/2');
    expect(routeApi.detail).toHaveBeenCalledWith('route-1');
  });
});
