import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PageBackButton } from './PageBackButton';

const routes = (
  <Routes>
    <Route path="/" element={<><PageBackButton/><p>Home screen</p></>} />
    <Route path="/dashboard" element={<><PageBackButton/><p>Dashboard screen</p></>} />
  </Routes>
);

describe('PageBackButton', () => {
  it('returns to the previous dashboard page', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/', '/dashboard']} initialIndex={1}>{routes}</MemoryRouter>);

    await user.click(screen.getByRole('button', { name: 'Go back' }));

    expect(await screen.findByText('Home screen')).toBeTruthy();
  });

  it('falls back to home when a page was opened directly', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/dashboard']}>{routes}</MemoryRouter>);

    await user.click(screen.getByRole('button', { name: 'Go back' }));

    expect(await screen.findByText('Home screen')).toBeTruthy();
  });

  it('does not render on the home screen', () => {
    render(<MemoryRouter initialEntries={['/']}>{routes}</MemoryRouter>);

    expect(screen.queryByRole('button', { name: 'Go back' })).toBeNull();
  });
});
