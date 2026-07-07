import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { searchApi } from '../services/search.api';
import { SearchPage } from './SearchPage';

vi.mock('../services/search.api', () => ({ searchApi: { findByBarcode: vi.fn() } }));

const renderPage = () => render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><SearchPage/></QueryClientProvider></MemoryRouter>);

describe('SearchPage integration', () => {
  beforeEach(() => vi.mocked(searchApi.findByBarcode).mockResolvedValue({ type: 'TRAILER', data: { id: 'trailer-1', trailerBarcode: 'TRL-100', currentStatus: 'OPEN', currentTerminalId: 1, containerCount: 2, packageCount: 8, updatedAt: '2026-07-07T12:00:00Z' } }));

  it('submits a trimmed identifier and renders its type-specific snapshot', async () => {
    const user = userEvent.setup(); renderPage();
    await user.type(screen.getByLabelText('Barcode or tracking number'), '  TRL-100  ');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('TRL-100')).toBeTruthy();
    expect(searchApi.findByBarcode).toHaveBeenCalledWith('TRL-100');
    expect(screen.getByRole('link', { name: /View details/ }).getAttribute('href')).toBe('/trailers/TRL-100');
  });

  it('does not submit an empty identifier', async () => {
    const user = userEvent.setup(); renderPage();
    await user.type(screen.getByLabelText('Barcode or tracking number'), '   ');
    expect((screen.getByRole('button', { name: 'Search' }) as HTMLButtonElement).disabled).toBe(true);
    expect(searchApi.findByBarcode).not.toHaveBeenCalled();
  });
});
