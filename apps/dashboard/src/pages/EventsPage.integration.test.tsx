import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dashboardApi } from '../services/dashboard.api';
import { EventsPage } from './EventsPage';

vi.mock('../services/dashboard.api', () => ({ dashboardApi: { events: vi.fn() } }));
const renderPage = () => render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><EventsPage/></QueryClientProvider></MemoryRouter>);

describe('EventsPage integration', () => {
  beforeEach(() => vi.mocked(dashboardApi.events).mockResolvedValue([
    { assetType: 'PACKAGE', reference: 'PKG-100', event: 'PACKAGE_SORTED', occurredAt: '2026-07-12T12:00:00Z' },
    { assetType: 'TRAILER', reference: 'TRL-100', event: 'TRAILER_CREATED', occurredAt: '2026-07-12T11:00:00Z' },
  ]));

  it('links recent events to asset details and filters by asset type', async () => {
    renderPage();
    expect((await screen.findByRole('link', { name: 'PKG-100' })).getAttribute('href')).toBe('/packages/PKG-100');
    expect(screen.getByRole('link', { name: 'TRL-100' }).getAttribute('href')).toBe('/trailers/TRL-100');
    fireEvent.click(screen.getByRole('button', { name: 'Package' }));
    expect(screen.getByText('PKG-100')).toBeTruthy();
    expect(screen.queryByText('TRL-100')).toBeNull();
  });
});
