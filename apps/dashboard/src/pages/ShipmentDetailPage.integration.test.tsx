import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shipmentApi } from '../services/shipment.api';
import { ShipmentDetailPage } from './ShipmentDetailPage';

vi.mock('../services/shipment.api', () => ({ shipmentApi: { detail: vi.fn(), packages: vi.fn(), history: vi.fn() } }));
const terminal = (id: number, code: string) => ({ id, terminalCode: code, name: `${code} Terminal`, city: 'Calgary', province: 'Alberta', country: 'Canada', timezone: 'America/Edmonton', createdAt: '', updatedAt: '', snapshot: null });

describe('ShipmentDetailPage integration', () => {
  beforeEach(() => {
    vi.mocked(shipmentApi.detail).mockResolvedValue({ id: 'shipment-1', shipmentNumber: 'SHIP-100', referenceNumber: 'ORDER-100', status: 'PARTIALLY_DELIVERED', originTerminalId: 1, destinationTerminalId: 2, createdAt: '', updatedAt: '', originTerminal: terminal(1, 'YYC'), destinationTerminal: terminal(2, 'YEG'), packages: [], snapshot: { currentStatus: 'PARTIALLY_DELIVERED', currentTerminalId: 2, packageCount: 2, deliveredPackages: 1, outForDeliveryPackages: 0, remainingPackages: 1, progressPercent: 50, completedAt: null, lastActivityAt: '2026-07-13T12:00:00Z' } });
    vi.mocked(shipmentApi.packages).mockResolvedValue([{ id: 'package-1', trackingNumber: 'PKG-100', packageType: 'CONVEYABLE', currentStatus: 'DELIVERED', currentTerminalId: 2, currentContainerId: null, currentTrailerId: null, updatedAt: '2026-07-13T12:00:00Z' }]);
    vi.mocked(shipmentApi.history).mockResolvedValue([{ id: 'event-1', shipmentId: 'shipment-1', eventType: 'PACKAGE_ASSIGNED', correlationId: 'request-1', createdAt: '2026-07-13T11:00:00Z' }]);
  });
  it('renders snapshot progress, linked terminals and packages, and immutable history', async () => {
    render(<MemoryRouter initialEntries={['/shipments/shipment-1']}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Routes><Route path="/shipments/:shipmentId" element={<ShipmentDetailPage/>}/></Routes></QueryClientProvider></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'SHIP-100' })).toBeTruthy();
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'PKG-100' }).getAttribute('href')).toBe('/packages/PKG-100');
    expect(screen.getByRole('link', { name: /YYC/ }).getAttribute('href')).toBe('/terminals/1');
    expect(screen.getByText('PACKAGE ASSIGNED')).toBeTruthy();
  });
});
