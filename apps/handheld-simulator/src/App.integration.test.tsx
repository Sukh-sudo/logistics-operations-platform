import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

const session = {
  id: 'session-100',
  taskType: 'TRAILER_LOAD',
  deviceId: 'device-100',
  terminalId: 1,
  createdAt: '2026-07-28T10:00:00.000Z',
  snapshot: {
    currentState: 'ACTIVE',
    networkState: 'ONLINE',
    lastAcceptedActivityAt: '2026-07-28T10:00:00.000Z',
  },
};

const bootstrap = {
  employee: {
    id: 'employee-1',
    employeeNumber: 'EMP-1001',
    firstName: 'Alex',
    lastName: 'Morgan',
    roles: ['EMPLOYEE'],
  },
  terminal: { id: 1, terminalCode: 'CAL', name: 'Calgary-000' },
  authorizedTasks: ['TRAILER_OPERATIONS', 'LAST_MILE_LOADING'],
  activeSessions: [],
  serverTime: '2026-07-28T10:00:00.000Z',
  apiVersion: 'mobile-v1',
  configuration: {
    inactivityMinutes: 15,
    gpsLowAccuracyThresholdMetres: 50,
    localHistoryRetentionHours: 8,
  },
};

describe('handheld simulator workflow', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    let id = 0;
    vi.spyOn(crypto, 'randomUUID').mockImplementation(
      () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`,
    );
  });

  it('authenticates, starts trailer work, and shows the accepted backend outcome', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresIn: 900,
        tokenType: 'Bearer',
        employee: bootstrap.employee,
        terminal: bootstrap.terminal,
      }))
      .mockResolvedValueOnce(response(bootstrap))
      .mockResolvedValueOnce(response({ session, snapshot: session.snapshot }))
      .mockResolvedValueOnce(response({
        id: 'receipt-1',
        clientEventId: '00000000-0000-4000-8000-000000000002',
        status: 'ACCEPTED',
        resultStatus: 'ACCEPTED',
        serverEventId: 'package-event-1',
        code: 'SCAN_ACCEPTED',
        message: 'Package loaded to trailer TRL-1002',
        exceptionFlags: [],
      }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/badge barcode/i), 'EMP-BADGE-1');
    await user.type(screen.getByLabelText(/employee id/i), 'EMP-1001');
    await user.click(screen.getByRole('button', { name: /authenticate/i }));
    expect(await screen.findByText(/good shift, alex/i)).toBeTruthy();

    await user.click(screen.getByText(/^Load trailer$/).closest('button')!);
    await user.click(await screen.findByRole('button', { name: /main menu/i }));
    expect(await screen.findByText(/good shift, alex/i)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /current task/i }));
    await user.type(await screen.findByLabelText(/trailer barcode/i), 'TRL-1002');
    await user.type(screen.getByLabelText(/package tracking number/i), 'PKG-100');
    await user.click(screen.getByRole('button', { name: /record scan/i }));

    expect(await screen.findAllByText('Package loaded to trailer TRL-1002')).toHaveLength(2);
    const scanRequest = JSON.parse(fetchMock.mock.calls[3][1].body as string);
    expect(scanRequest).toMatchObject({
      action: 'LOAD_PACKAGE_TO_TRAILER',
      trackingNumber: 'PKG-100',
      trailerBarcode: 'TRL-1002',
      networkStateAtCapture: 'ONLINE',
    });
    // Persist-before-send leaves the authoritative result available after reload.
    expect(localStorage.getItem('handheld.outbox')).toContain('"syncState":"ACCEPTED"');
  });

  it('captures work offline and later batch-syncs the original command', async () => {
    const offlineBootstrap = { ...bootstrap, activeSessions: [session] };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresIn: 900,
        tokenType: 'Bearer',
        employee: bootstrap.employee,
        terminal: bootstrap.terminal,
      }))
      .mockResolvedValueOnce(response(offlineBootstrap))
      .mockResolvedValueOnce(response(offlineBootstrap))
      .mockResolvedValueOnce(response({
        batchId: 'batch-1',
        results: [{
          id: 'receipt-offline',
          clientEventId: '00000000-0000-4000-8000-000000000002',
          status: 'ACCEPTED',
          resultStatus: 'ACCEPTED',
          serverEventId: 'package-event-offline',
          code: 'SCAN_ACCEPTED',
          message: 'Offline package accepted',
          exceptionFlags: [],
        }],
      }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/badge barcode/i), 'EMP-BADGE-1');
    await user.type(screen.getByLabelText(/employee id/i), 'EMP-1001');
    await user.click(screen.getByRole('button', { name: /authenticate/i }));
    await screen.findByText(/good shift, alex/i);
    await user.click(screen.getByRole('button', { name: /online/i }));
    await user.click(screen.getByText(/^Load trailer$/).closest('button')!);
    await user.type(await screen.findByLabelText(/trailer barcode/i), 'TRL-1002');
    await user.type(screen.getByLabelText(/package tracking number/i), 'PKG-OFFLINE');
    await user.click(screen.getByRole('button', { name: /record scan/i }));

    expect(await screen.findByText(/scan saved offline/i)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole('button', { name: /history/i }));
    expect(await screen.findByText('PKG-OFFLINE')).toBeTruthy();
    expect(screen.getByText(/pending validation/i)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /offline/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    await user.click(screen.getByRole('button', { name: /sync 1/i }));
    expect(await screen.findByText('Offline package accepted')).toBeTruthy();
    const syncBody = JSON.parse(fetchMock.mock.calls[3][1].body as string);
    expect(syncBody.events[0]).toMatchObject({
      trackingNumber: 'PKG-OFFLINE',
      networkStateAtCapture: 'OFFLINE_NETWORK',
    });
  });
});

function response(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}
