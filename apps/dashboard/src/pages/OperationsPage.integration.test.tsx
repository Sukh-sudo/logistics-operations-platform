import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { containerApi } from '../services/container.api';
import { fleetApi } from '../services/fleet.api';
import { packageApi } from '../services/package.api';
import { recoveryApi } from '../services/recovery.api';
import { shipmentApi } from '../services/shipment.api';
import { terminalApi } from '../services/terminal.api';
import { trailerApi } from '../services/trailer.api';
import { transportationApi } from '../services/transportation.api';
import { tripApi } from '../services/trip.api';
import { OperationsPage } from './OperationsPage';

vi.mock('../services/package.api', () => ({ packageApi: { createEvent: vi.fn(), retryProjections: vi.fn() } }));
vi.mock('../services/container.api', () => ({ containerApi: { create: vi.fn(), loadPackage: vi.fn(), unloadPackage: vi.fn() } }));
vi.mock('../services/trailer.api', () => ({ trailerApi: { create: vi.fn(), loadContainer: vi.fn(), unloadContainer: vi.fn(), loadPackage: vi.fn(), unloadPackage: vi.fn() } }));
vi.mock('../services/trip.api', () => ({ tripApi: { start: vi.fn(), arrive: vi.fn(), depart: vi.fn(), complete: vi.fn(), cancel: vi.fn() } }));
vi.mock('../services/fleet.api', () => ({ fleetApi: { assign: vi.fn(), release: vi.fn() } }));
vi.mock('../services/terminal.api', () => ({ terminalApi: { transfer: vi.fn() } }));
vi.mock('../services/shipment.api', () => ({ shipmentApi: { create: vi.fn(), update: vi.fn(), assignPackage: vi.fn(), removePackage: vi.fn(), complete: vi.fn(), cancel: vi.fn() } }));
vi.mock('../services/recovery.api', () => ({ recoveryApi: { rebuildSnapshots: vi.fn() } }));
vi.mock('../services/transportation.api', () => ({ transportationApi: { terminals: vi.fn() } }));

const terminals = [
  { id: 1, terminalCode: 'YYC', name: 'Calgary', city: 'Calgary', province: 'AB', country: 'CA', createdAt: '2026-07-01T00:00:00Z', snapshot: null },
  { id: 2, terminalCode: 'YEG', name: 'Edmonton', city: 'Edmonton', province: 'AB', country: 'CA', createdAt: '2026-07-01T00:00:00Z', snapshot: null },
];

function renderPage() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><OperationsPage/></QueryClientProvider>);
}

describe('OperationsPage integration', () => {
  beforeEach(() => {
    vi.mocked(transportationApi.terminals).mockResolvedValue(terminals);
    vi.mocked(packageApi.createEvent).mockResolvedValue({} as never);
    vi.mocked(packageApi.retryProjections).mockResolvedValue({ processed: 2 });
    vi.mocked(containerApi.create).mockResolvedValue({} as never);
    vi.mocked(containerApi.loadPackage).mockResolvedValue({});
    vi.mocked(trailerApi.loadContainer).mockResolvedValue({});
    vi.mocked(tripApi.arrive).mockResolvedValue({});
    vi.mocked(fleetApi.assign).mockResolvedValue({} as never);
    vi.mocked(terminalApi.transfer).mockResolvedValue({});
    vi.mocked(shipmentApi.create).mockResolvedValue({} as never);
    vi.mocked(shipmentApi.assignPackage).mockResolvedValue({});
    vi.mocked(recoveryApi.rebuildSnapshots).mockResolvedValue({ packages: 3, containers: 2, trailers: 1 });
  });

  it('submits terminal-owned package and asset commands with normalized identifiers', async () => {
    const user = userEvent.setup();
    renderPage();
    expect((await screen.findAllByRole('option', { name: /YYC/ })).length).toBeGreaterThan(0);

    await user.type(screen.getByRole('textbox', { name: 'Package tracking number' }), 'con1234567');
    await user.selectOptions(screen.getByLabelText('Package terminal'), '1');
    await user.type(screen.getByLabelText('Package employee ID'), '17');
    await user.click(screen.getByRole('button', { name: 'Record package event' }));
    await waitFor(() => expect(packageApi.createEvent).toHaveBeenCalledWith({ trackingNumber: 'CON1234567', eventType: 'PACKAGE_RECEIVED', terminalId: 1, employeeId: 17 }));

    await user.type(screen.getByLabelText('New asset identifier'), 'mail123456');
    await user.selectOptions(screen.getByLabelText('Owning terminal'), '2');
    await user.click(screen.getByRole('button', { name: 'Create asset' }));
    await waitFor(() => expect(containerApi.create).toHaveBeenCalledWith({ containerBarcode: 'MAIL123456', terminalId: 2 }));
  });

  it('dispatches freight, trip, fleet, transfer, shipment, and recovery commands', async () => {
    const user = userEvent.setup();
    renderPage();
    expect((await screen.findAllByRole('option', { name: /YYC/ })).length).toBeGreaterThan(0);

    await user.type(screen.getByLabelText('Container aggregate ID'), 'container-1');
    await user.type(screen.getByLabelText('Container package tracking number'), 'con1234567');
    await user.click(screen.getByRole('button', { name: 'Apply container action' }));
    await waitFor(() => expect(containerApi.loadPackage).toHaveBeenCalledWith('container-1', { trackingNumber: 'CON1234567' }));

    await user.type(screen.getByLabelText('Trailer aggregate ID'), 'trailer-1');
    await user.type(screen.getByLabelText('Trailer freight identifier'), 'mail123456');
    await user.click(screen.getByRole('button', { name: 'Apply trailer action' }));
    await waitFor(() => expect(trailerApi.loadContainer).toHaveBeenCalledWith('trailer-1', { containerBarcode: 'MAIL123456' }));

    await user.type(screen.getByRole('textbox', { name: 'Trip ID' }), 'trip-1');
    await user.selectOptions(screen.getByLabelText('Trip action'), 'ARRIVE');
    await user.type(screen.getByLabelText('Trip stop ID'), 'stop-1');
    await user.type(screen.getByLabelText('Trip stop notes'), 'Dock 4');
    await user.click(screen.getByRole('button', { name: 'Apply trip action' }));
    await waitFor(() => expect(tripApi.arrive).toHaveBeenCalledWith('trip-1', 'stop-1', { notes: 'Dock 4' }));

    await user.type(screen.getByLabelText('Fleet trip ID'), 'trip-1');
    await user.type(screen.getByLabelText('Fleet truck ID'), 'truck-1');
    await user.type(screen.getByLabelText('Fleet driver ID'), 'driver-1');
    await user.type(screen.getByLabelText('Fleet trailer ID'), 'trailer-1');
    await user.click(screen.getByRole('button', { name: 'Apply fleet action' }));
    await waitFor(() => expect(fleetApi.assign).toHaveBeenCalledWith({ tripId: 'trip-1', truckId: 'truck-1', driverId: 'driver-1', trailerId: 'trailer-1' }));

    await user.selectOptions(screen.getByLabelText('Origin terminal'), '1');
    await user.selectOptions(screen.getByLabelText('Destination terminal'), '2');
    await user.type(screen.getByLabelText('Transfer asset identifier'), 'con1234567');
    await user.click(screen.getByRole('button', { name: 'Transfer asset' }));
    await waitFor(() => expect(terminalApi.transfer).toHaveBeenCalledWith(1, { destinationTerminalId: 2, assetType: 'PACKAGE', assetIdentifier: 'CON1234567' }));

    await user.type(screen.getByLabelText('New shipment number'), 'SHIP-100');
    await user.selectOptions(screen.getByLabelText('Shipment origin'), '1');
    await user.selectOptions(screen.getByLabelText('Shipment destination'), '2');
    await user.type(screen.getByLabelText('Shipment package numbers'), 'con1234567, mail123456');
    await user.click(screen.getByRole('button', { name: 'Create shipment' }));
    await waitFor(() => expect(shipmentApi.create).toHaveBeenCalledWith({ shipmentNumber: 'SHIP-100', originTerminalId: 1, destinationTerminalId: 2, transitDays: 1, packageTrackingNumbers: ['CON1234567', 'MAIL123456'] }));

    await user.type(screen.getByLabelText('Shipment ID'), 'shipment-1');
    await user.type(screen.getByLabelText('Shipment action value'), 'dg12345678');
    await user.click(screen.getByRole('button', { name: 'Apply shipment action' }));
    await waitFor(() => expect(shipmentApi.assignPackage).toHaveBeenCalledWith('shipment-1', { trackingNumber: 'DG12345678' }));

    await user.click(screen.getByRole('button', { name: 'Retry pending projections' }));
    expect(await screen.findByText('Projection retry processed 2 item(s).')).toBeTruthy();
  });
});
