import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransportationPage } from './TransportationPage';
import { transportationApi } from '../services/transportation.api';

vi.mock('../services/transportation.api', () => ({ transportationApi: { terminals: vi.fn(), routes: vi.fn(), trips: vi.fn(), shipments: vi.fn() } }));
const terminals = [
  { id: 1, terminalCode: 'TEST-CODE-ONE', name: 'Calgary-000', city: 'Calgary', province: 'AB', country: 'CA', createdAt: '2026-07-01T10:00:00Z', snapshot: null },
  { id: 2, terminalCode: 'TEST-CODE-TWO', name: 'Edmonton-000', city: 'Edmonton', province: 'AB', country: 'CA', createdAt: '2026-07-02T10:00:00Z', snapshot: null },
  { id: 3, terminalCode: 'TEST-CODE-THREE', name: 'Vancouver-000', city: 'Vancouver', province: 'BC', country: 'CA', createdAt: '2026-07-02T10:00:00Z', snapshot: null },
];
const route = (id: string, origin: number, destination: number, createdAt: string) => ({ id, routeNumber: id, name: id, status: 'ACTIVE', estimatedDistance: 300, estimatedDuration: 200, createdAt, originTerminalId: origin, destinationTerminalId: destination, originTerminal: terminals.find(t => t.id === origin), destinationTerminal: terminals.find(t => t.id === destination), stops: [], snapshot: null });
describe('TransportationPage filtering integration', () => {
  beforeEach(() => { vi.mocked(transportationApi.terminals).mockResolvedValue(terminals); vi.mocked(transportationApi.routes).mockResolvedValue([route('R-YYC-YEG', 1, 2, '2026-07-02T10:00:00Z'), route('R-YYC-YVR', 1, 3, '2026-07-03T10:00:00Z')] as never); vi.mocked(transportationApi.trips).mockResolvedValue([]); vi.mocked(transportationApi.shipments).mockResolvedValue([]); });
  it('loads read models and applies date and lane filters across a tab', async () => {
    const user = userEvent.setup();
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><TransportationPage/></QueryClientProvider>);
    await user.click(screen.getByRole('button', { name: /Routes/ }));
    expect(screen.getAllByRole('option', { name: 'Calgary-000' })).toHaveLength(2);
    expect(screen.queryByRole('option', { name: /TEST-CODE/ })).toBeNull();
    await screen.findAllByText('R-YYC-YEG'); expect(screen.getAllByText('R-YYC-YVR')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-07-02' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-07-02' } });
    await user.selectOptions(screen.getByLabelText('Origin'), '1');
    await user.selectOptions(screen.getByLabelText('Destination'), '2');
    await waitFor(() => expect(screen.queryByText('R-YYC-YVR')).toBeNull()); expect(screen.getAllByText('R-YYC-YEG')).toHaveLength(2);
  });
  it('clears active filters', async () => {
    const user = userEvent.setup();
    render(<QueryClientProvider client={new QueryClient()}><TransportationPage/></QueryClientProvider>);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-07-03' } });
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect((screen.getByLabelText('From') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('To') as HTMLInputElement).value).toBe('');
  });
});
