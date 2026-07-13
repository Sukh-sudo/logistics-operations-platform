import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { healthApi } from '../services/health.api';
import { HealthPage } from './HealthPage';

vi.mock('../services/health.api', () => ({ healthApi: { status: vi.fn() } }));

describe('HealthPage integration', () => {
  beforeEach(() => vi.mocked(healthApi.status).mockResolvedValue({ status: 'ok', database: 'connected', kafka: 'unavailable', uptime: 90061, timestamp: '2026-07-12T12:00:00Z' }));
  it('displays service states and formatted runtime information', async () => {
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><HealthPage/></QueryClientProvider>);
    expect(await screen.findByText('Database')).toBeTruthy();
    expect(screen.getByText('connected')).toBeTruthy();
    expect(screen.getByText('unavailable')).toBeTruthy();
    expect(screen.getByText('1d 1h 1m')).toBeTruthy();
  });
});
