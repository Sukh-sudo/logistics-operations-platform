import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tripApi } from '../services/trip.api';
import { TripDetailPage } from './TripDetailPage';

vi.mock('../services/trip.api', () => ({ tripApi: { detail: vi.fn() } }));

describe('TripDetailPage integration', () => {
  beforeEach(() => vi.mocked(tripApi.detail).mockResolvedValue({ id: 'trip-1', tripNumber: 'TRIP-100', routeId: 'route-1', equipmentAssignmentId: 'assignment-1', status: 'IN_PROGRESS', plannedDeparture: '2026-07-13T10:00:00Z', actualDeparture: '2026-07-13T10:05:00Z', plannedArrival: '2026-07-13T13:00:00Z', actualArrival: null, createdAt: '', updatedAt: '', route: { id: 'route-1', routeNumber: 'R-100', name: 'Calgary to Edmonton', originTerminalId: 1, destinationTerminalId: 2, estimatedDistance: 300, estimatedDuration: 180, status: 'ACTIVE' }, stops: [{ id: 'stop-1', tripId: 'trip-1', terminalId: 1, sequence: 1, plannedArrival: '2026-07-13T10:00:00Z', actualArrival: '2026-07-13T10:05:00Z', plannedDeparture: '2026-07-13T10:10:00Z', actualDeparture: null, status: 'ARRIVED', delayMinutes: 5, notes: null, terminal: { id: 1, terminalCode: 'YYC', name: 'Calgary', city: 'Calgary', province: 'Alberta', country: 'Canada', timezone: 'America/Edmonton', createdAt: '', updatedAt: '', snapshot: null } }], snapshot: { currentStatus: 'IN_PROGRESS', currentStopId: 'stop-1', nextStopId: 'stop-1', currentTerminalId: 1, completedStops: 0, totalStops: 1, progressPercent: 40, delayMinutes: 5, lastActivityAt: '2026-07-13T10:05:00Z' } }));
  it('renders snapshot progress, route and terminal links, and stop timing', async () => {
    render(<MemoryRouter initialEntries={['/trips/trip-1']}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Routes><Route path="/trips/:tripId" element={<TripDetailPage/>}/></Routes></QueryClientProvider></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'TRIP-100' })).toBeTruthy();
    expect(screen.getByText('40%')).toBeTruthy();
    expect(screen.getByRole('link', { name: /R-100/ }).getAttribute('href')).toBe('/routes/route-1');
    expect(screen.getByRole('link', { name: 'Calgary' }).getAttribute('href')).toBe('/terminals/1');
    expect(screen.getByText('assignment-1')).toBeTruthy();
  });
});
