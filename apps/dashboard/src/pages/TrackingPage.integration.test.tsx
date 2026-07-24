import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { trackingApi } from '../services/tracking.api';
import { TrackingPage } from './TrackingPage';

vi.mock('../services/tracking.api', () => ({
  trackingApi: { shipment: vi.fn() },
}));

const response = {
  shipmentNumber: 'SHIP-100',
  referenceNumber: 'ORDER-100',
  status: 'IN_TRANSIT',
  origin: {
    terminalCode: 'YYC',
    name: 'Calgary-000',
    city: 'Calgary',
    province: 'Alberta',
    country: 'Canada',
  },
  destination: {
    terminalCode: 'YEG',
    name: 'Edmonton-000',
    city: 'Edmonton',
    province: 'Alberta',
    country: 'Canada',
  },
  currentTerminal: {
    terminalCode: 'YEG',
    name: 'Edmonton-000',
    city: 'Edmonton',
    province: 'Alberta',
    country: 'Canada',
  },
  progress: {
    packageCount: 2,
    deliveredPackages: 1,
    outForDeliveryPackages: 1,
    remainingPackages: 1,
    progressPercent: 50,
    completedAt: null,
    lastActivityAt: '2026-07-23T12:00:00Z',
  },
  packages: [
    {
      trackingNumber: 'CON1234567',
      status: 'OUT_FOR_DELIVERY',
      lastUpdatedAt: '2026-07-23T12:00:00Z',
    },
  ],
  milestones: [
    {
      type: 'SHIPMENT_OUT_FOR_DELIVERY',
      occurredAt: '2026-07-23T12:00:00Z',
    },
  ],
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/tracking']}>
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false } },
          })
        }
      >
        <Routes>
          <Route path="/tracking" element={<TrackingPage />} />
          <Route
            path="/tracking/:shipmentNumber"
            element={<TrackingPage />}
          />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );

describe('TrackingPage integration', () => {
  beforeEach(() => {
    vi.mocked(trackingApi.shipment).mockResolvedValue(response);
  });

  it('navigates to a shipment and renders its tracking projection', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByLabelText('Shipment number'),
      '  SHIP-100  ',
    );
    await user.click(
      screen.getByRole('button', { name: 'Track shipment' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'SHIP-100' }),
    ).toBeTruthy();
    expect(screen.getByText(/Reference ORDER-100/)).toBeTruthy();
    expect(trackingApi.shipment).toHaveBeenCalledWith('SHIP-100');
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.getByText('CON1234567')).toBeTruthy();
    expect(screen.getByText('SHIPMENT OUT FOR DELIVERY')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'CON1234567' }).getAttribute('href'),
    ).toBe('/packages/CON1234567');
  });
});
