import {
  Bell,
  ClipboardList,
  History,
  Home,
  LogOut,
  RefreshCcw,
  Signal,
  SignalZero,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { HistoryScreen } from './components/HistoryScreen';
import { HomeScreen } from './components/HomeScreen';
import { LoginScreen } from './components/LoginScreen';
import { WorkScreen } from './components/WorkScreen';
import type {
  Bootstrap,
  HandheldAction,
  OperationalContext,
  OutboxEvent,
  ScanCommand,
  ScanResult,
  TaskType,
  WorkSession,
} from './domain/types';
import { ApiError, handheldApi } from './services/handheldApi';
import {
  bootstrapStorage,
  clearAuthentication,
  contextStorage,
  deviceCredentialStorage,
  installationId,
  outboxStorage,
  tokenStorage,
} from './storage/deviceStorage';
import {
  applyResult,
  isPending,
  purgeResolvedEvents,
  replaceEvent,
} from './storage/outbox';

type View = 'home' | 'work' | 'history';

export function App() {
  const deviceId = useMemo(() => installationId(), []);
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(() => bootstrapStorage.get());
  const [outbox, setOutbox] = useState<OutboxEvent[]>(() => {
    const retained = purgeResolvedEvents(outboxStorage.get(), Date.now(), 8);
    outboxStorage.set(retained);
    return retained;
  });
  const [context, setContext] = useState<OperationalContext>(() => contextStorage.get());
  const [activeSession, setActiveSession] = useState<WorkSession | null>(null);
  const [view, setView] = useState<View>('home');
  const [online, setOnline] = useState(() => navigator.onLine);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deviceEnrolled, setDeviceEnrolled] = useState(
    () => deviceCredentialStorage.get() !== null,
  );

  useEffect(() => {
    const wentOnline = () => setOnline(true);
    const wentOffline = () => setOnline(false);
    window.addEventListener('online', wentOnline);
    window.addEventListener('offline', wentOffline);
    return () => {
      window.removeEventListener('online', wentOnline);
      window.removeEventListener('offline', wentOffline);
    };
  }, []);

  useEffect(() => {
    // Cached bootstrap data lets an authenticated shift reopen without a network.
    if (!online || !tokenStorage.get() || !bootstrap) return;
    void handheldApi.bootstrap().then((fresh) => {
      setBootstrap(fresh);
      bootstrapStorage.set(fresh);
    }).catch(() => undefined);
  }, [online]); 
  // Bootstrap deliberately refreshes only when connectivity changes.

  const updateOutbox = (transform: (events: OutboxEvent[]) => OutboxEvent[]) => {
    setOutbox((current) => {
      const updated = transform(current);
      outboxStorage.set(updated);
      return updated;
    });
  };

  const updateContext = (next: OperationalContext) => {
    setContext(next);
    contextStorage.set(next);
  };

  const login = async (badgeBarcode: string, employeeId: string) => {
    setBusy(true);
    setError('');
    try {
      const deviceCredential = deviceCredentialStorage.get();
      if (!deviceCredential) throw new Error('Enroll this simulator before signing in.');
      const response = await handheldApi.login(
        badgeBarcode,
        employeeId,
        deviceId,
        deviceCredential,
      );
      tokenStorage.set({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        expiresIn: response.expiresIn,
        tokenType: response.tokenType,
      });
      const loaded = await handheldApi.bootstrap();
      bootstrapStorage.set(loaded);
      setBootstrap(loaded);
      setNotice(`Signed in at ${loaded.terminal.terminalCode}`);
    } catch (reason) {
      clearAuthentication();
      setError(messageOf(reason, 'Unable to authenticate this employee.'));
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    if (outbox.some(isPending)) {
      setError('Synchronize pending work before signing out.');
      setView('history');
      return;
    }
    setBusy(true);
    const tokens = tokenStorage.get();
    try {
      if (online && tokens) await handheldApi.logout();
    } catch {
      // Local sign-out still protects cached credentials if the API is unavailable.
    } finally {
      clearAuthentication();
      setBootstrap(null);
      setActiveSession(null);
      setView('home');
      setBusy(false);
    }
  };

  const openTask = async (taskType: TaskType) => {
    if (!bootstrap) return;
    setError('');
    const existing = bootstrap.activeSessions.find(
      (session) =>
        session.taskType === taskType &&
        session.deviceId === deviceId &&
        session.snapshot.currentState !== 'COMPLETED',
    );
    if (existing) {
      setActiveSession(existing);
      setView('work');
      return;
    }
    if (!online) {
      setError('A new task session must be started online. Reconnect or resume an open session.');
      return;
    }
    setBusy(true);
    try {
      const created = await handheldApi.startSession(taskType, deviceId, online);
      const session = { ...created.session, snapshot: created.snapshot };
      const updated = { ...bootstrap, activeSessions: [session, ...bootstrap.activeSessions] };
      setBootstrap(updated);
      bootstrapStorage.set(updated);
      setActiveSession(session);
      setView('work');
    } catch (reason) {
      setError(messageOf(reason, 'Unable to start the task session.'));
    } finally {
      setBusy(false);
    }
  };

  const transitionSession = async (transition: 'pause' | 'resume' | 'complete') => {
    if (!activeSession || !bootstrap) return;
    if (!online) {
      setError('Session controls require a network connection. Scans can continue offline.');
      return;
    }
    if (
      transition === 'complete' &&
      outbox.some((event) => event.taskSessionId === activeSession.id && isPending(event))
    ) {
      setError('Synchronize pending scans before completing this task.');
      setView('history');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await handheldApi.transitionSession(activeSession.id, transition);
      const updatedSession = { ...activeSession, snapshot: result.snapshot };
      const sessions = bootstrap.activeSessions
        .map((session) => session.id === updatedSession.id ? updatedSession : session)
        .filter((session) => session.snapshot.currentState !== 'COMPLETED');
      const updatedBootstrap = { ...bootstrap, activeSessions: sessions };
      setBootstrap(updatedBootstrap);
      bootstrapStorage.set(updatedBootstrap);
      if (transition === 'complete') {
        setActiveSession(null);
        setView('home');
        setNotice('Task session completed.');
      } else {
        setActiveSession(updatedSession);
      }
    } catch (reason) {
      setError(messageOf(reason, `Unable to ${transition} this task.`));
    } finally {
      setBusy(false);
    }
  };

  const capture = async (
    action: HandheldAction,
    identifier: string,
    containerBarcode: string,
    captureGps: boolean,
  ) => {
    if (!activeSession) return;
    setBusy(true);
    setError('');
    const location = captureGps && action.startsWith('PACKAGE_')
      ? await currentLocation()
      : undefined;
    const command = buildCommand(
      activeSession.id,
      deviceId,
      online,
      action,
      identifier,
      containerBarcode,
      context,
      location,
    );
    const event: OutboxEvent = {
      ...command,
      syncState: online ? 'PENDING' : 'PENDING_VALIDATION',
      message: online ? 'Sending to operations…' : 'Saved locally; awaiting validation.',
      exceptionFlags: [],
      retryCount: 0,
      createdAt: command.deviceTimestamp,
    };
    // Persist-before-send is the simulator equivalent of the Android Room outbox.
    updateOutbox((events) => [event, ...events]);

    if (!online) {
      feedback('pending');
      setNotice('Scan saved offline.');
      setBusy(false);
      return;
    }
    try {
      const result = await handheldApi.scan(command);
      updateOutbox((events) => replaceEvent(events, applyResult(event, result)));
      feedback(result.status === 'REJECTED' ? 'error' : 'success');
      setNotice(result.message);
    } catch (reason) {
      const failed = failedTransport(event, reason);
      updateOutbox((events) => replaceEvent(events, failed));
      feedback(reason instanceof ApiError && reason.status < 500 ? 'error' : 'pending');
      setError(failed.message);
    } finally {
      setBusy(false);
    }
  };

  const reverse = async (original: OutboxEvent) => {
    if (!activeSession || !original.receiptId) {
      setError('This event does not have a reversible server receipt.');
      return;
    }
    const command: ScanCommand = {
      ...toCommand(original),
      clientEventId: crypto.randomUUID(),
      taskSessionId: activeSession.id,
      action: 'REVERSE_EVENT',
      deviceId,
      deviceTimestamp: new Date().toISOString(),
      networkStateAtCapture: online ? 'ONLINE' : 'OFFLINE_NETWORK',
    };
    const reversal: OutboxEvent = {
      ...command,
      syncState: online ? 'PENDING' : 'PENDING_VALIDATION',
      message: online ? 'Submitting reversal…' : 'Reversal queued until reconnection.',
      exceptionFlags: [],
      retryCount: 0,
      createdAt: command.deviceTimestamp,
      originalClientEventId: original.clientEventId,
    };
    updateOutbox((events) => [reversal, ...events]);
    if (!online) {
      setNotice('Reversal saved offline.');
      return;
    }
    setBusy(true);
    try {
      const result = await handheldApi.reverse(original.receiptId, command);
      applyReversal(reversal, original, result, updateOutbox);
      feedback(result.status === 'REVERSED' ? 'success' : 'error');
    } catch (reason) {
      updateOutbox((events) => replaceEvent(events, failedTransport(reversal, reason)));
      setError(messageOf(reason, 'The reversal could not be submitted.'));
    } finally {
      setBusy(false);
    }
  };

  const sync = async () => {
    if (!online || syncing) return;
    const pending = outbox.filter(isPending).sort(
      (left, right) => new Date(left.deviceTimestamp).getTime() - new Date(right.deviceTimestamp).getTime(),
    );
    if (pending.length === 0) return;
    setSyncing(true);
    setError('');
    updateOutbox((events) =>
      events.map((event) => isPending(event) ? { ...event, syncState: 'SYNCING' } : event),
    );
    try {
      const reversals = pending.filter((event) => event.action === 'REVERSE_EVENT');
      const normal = pending.filter((event) => event.action !== 'REVERSE_EVENT');
      for (const [sessionId, events] of groupBySession(normal)) {
        // The server accepts at most 100 commands, so large shifts are
        // synchronized as ordered chunks without leaving events in SYNCING.
        for (let index = 0; index < events.length; index += 100) {
          const chunk = events.slice(index, index + 100);
          const response = await handheldApi.sync(sessionId, chunk.map(toCommand));
          updateOutbox((current) =>
            response.results.reduce((next, result) => {
              const local = next.find((event) => event.clientEventId === result.clientEventId);
              return local ? replaceEvent(next, applyResult(local, result)) : next;
            }, current),
          );
        }
      }
      for (const reversal of reversals) {
        const original = outbox.find((event) => event.clientEventId === reversal.originalClientEventId);
        if (!original?.receiptId) throw new Error('Original reversal receipt is unavailable.');
        const result = await handheldApi.reverse(original.receiptId, toCommand(reversal));
        applyReversal(reversal, original, result, updateOutbox);
      }
      setNotice(`${pending.length} queued ${pending.length === 1 ? 'event' : 'events'} synchronized.`);
      feedback('success');
    } catch (reason) {
      updateOutbox((events) =>
        events.map((event) =>
          event.syncState === 'SYNCING'
            ? {
                ...event,
                syncState: 'PENDING_VALIDATION',
                retryCount: event.retryCount + 1,
                message: 'Synchronization interrupted; queued for retry.',
              }
            : event,
        ),
      );
      setError(messageOf(reason, 'Synchronization was interrupted. Pending work is safe locally.'));
    } finally {
      setSyncing(false);
    }
  };

  if (!bootstrap || !tokenStorage.get()) {
    return (
      <LoginScreen
        online={online}
        submitting={busy}
        error={error}
        deviceId={deviceId}
        deviceEnrolled={deviceEnrolled}
        onEnroll={(credential) => {
          deviceCredentialStorage.set(credential);
          setDeviceEnrolled(true);
          setError('');
        }}
        onSubmit={login}
      />
    );
  }

  const sessionEvents = activeSession
    ? outbox.filter((event) => event.taskSessionId === activeSession.id)
    : outbox;
  const pendingCount = outbox.filter(isPending).length;
  const currentDeviceSessions = bootstrap.activeSessions.filter(
    (session) => session.deviceId === deviceId,
  );

  return (
    <div className="app-background">
      <div className="device">
        <header className="topbar">
          <button
            className="connection-button"
            data-online={online}
            onClick={() => setOnline((current) => !current)}
            title="Toggle simulated connectivity"
          >
            {online ? <Signal /> : <SignalZero />}
            <span>{online ? 'Online' : 'Offline'}</span>
          </button>
          <div className="topbar-brand"><span>LO</span><strong>Handheld</strong></div>
          <div className="topbar-actions">
            <button aria-label="Notifications"><Bell /></button>
            <button aria-label="Sign out" onClick={() => void logout()}><LogOut /></button>
          </div>
        </header>

        {(error || notice) && (
          <div className={`toast ${error ? 'error' : 'success'}`} role={error ? 'alert' : 'status'}>
            <span>{error || notice}</span>
            <button onClick={() => { setError(''); setNotice(''); }}>×</button>
          </div>
        )}

        <main className="viewport">
          {view === 'home' && (
            <HomeScreen
              bootstrap={bootstrap}
              activeSessions={currentDeviceSessions}
              busy={busy}
              online={online}
              onOpenTask={openTask}
              onLookup={handheldApi.packageLookup}
            />
          )}
          {view === 'work' && activeSession && (
            <WorkScreen
              session={activeSession}
              context={context}
              recentEvents={sessionEvents}
              busy={busy}
              online={online}
              onBack={() => setView('home')}
              onContextChange={updateContext}
              onCapture={capture}
              onTransition={transitionSession}
            />
          )}
          {view === 'history' && (
            <HistoryScreen
              events={outbox}
              online={online}
              syncing={syncing}
              onSync={sync}
              onReverse={reverse}
              onDismiss={(event) =>
                updateOutbox((events) =>
                  replaceEvent(events, {
                    ...event,
                    syncState: 'DISMISSED_LOCAL',
                    resolvedAt: new Date().toISOString(),
                  }),
                )
              }
            />
          )}
        </main>

        <nav className="bottom-nav" aria-label="Handheld navigation">
          <button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}>
            <Home /><span>Home</span>
          </button>
          <button
            className={view === 'work' ? 'active' : ''}
            disabled={!activeSession}
            onClick={() => setView('work')}
          >
            <ClipboardList /><span>Current task</span>
          </button>
          <button className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}>
            <span className="nav-icon"><History />{pendingCount > 0 && <em>{pendingCount}</em>}</span>
            <span>History</span>
          </button>
          <button className="sync-nav" disabled={!online || syncing || pendingCount === 0} onClick={() => void sync()}>
            <RefreshCcw className={syncing ? 'spin' : ''} /><span>Sync</span>
          </button>
        </nav>
      </div>
    </div>
  );
}

function buildCommand(
  sessionId: string,
  deviceId: string,
  online: boolean,
  action: HandheldAction,
  identifier: string,
  pairedContainer: string,
  context: OperationalContext,
  location?: GeolocationCoordinates,
): ScanCommand {
  const isContainerIdentifier =
    action.includes('CONTAINER_TO_TRAILER') ||
    action === 'UNLOAD_CONTAINER_FROM_TRAILER' ||
    action === 'CLOSE_CONTAINER';
  const command: ScanCommand = {
    taskSessionId: sessionId,
    clientEventId: crypto.randomUUID(),
    action,
    deviceId,
    deviceTimestamp: new Date().toISOString(),
    networkStateAtCapture: online ? 'ONLINE' : 'OFFLINE_NETWORK',
    ...(isContainerIdentifier
      ? { containerBarcode: identifier.trim().toUpperCase() }
      : identifier
        ? { trackingNumber: identifier.trim().toUpperCase() }
        : {}),
    ...(pairedContainer && { containerBarcode: pairedContainer.trim().toUpperCase() }),
    ...(context.trailerBarcode && { trailerBarcode: context.trailerBarcode.trim().toUpperCase() }),
    ...(context.routeCode && { routeCode: context.routeCode.trim().toUpperCase() }),
    ...(context.truckUnitNumber && { truckUnitNumber: context.truckUnitNumber.trim().toUpperCase() }),
  };
  if (location) {
    command.latitude = location.latitude;
    command.longitude = location.longitude;
    command.gpsAccuracyMetres = location.accuracy;
    command.gpsCapturedAt = new Date().toISOString();
  }
  return command;
}

function toCommand(event: OutboxEvent): ScanCommand {
  return {
    taskSessionId: event.taskSessionId,
    clientEventId: event.clientEventId,
    action: event.action,
    deviceId: event.deviceId,
    deviceTimestamp: event.deviceTimestamp,
    networkStateAtCapture: event.networkStateAtCapture,
    ...(event.trackingNumber && { trackingNumber: event.trackingNumber }),
    ...(event.containerBarcode && { containerBarcode: event.containerBarcode }),
    ...(event.trailerBarcode && { trailerBarcode: event.trailerBarcode }),
    ...(event.routeCode && { routeCode: event.routeCode }),
    ...(event.truckUnitNumber && { truckUnitNumber: event.truckUnitNumber }),
    ...(event.latitude !== undefined && { latitude: event.latitude }),
    ...(event.longitude !== undefined && { longitude: event.longitude }),
    ...(event.gpsAccuracyMetres !== undefined && { gpsAccuracyMetres: event.gpsAccuracyMetres }),
    ...(event.gpsCapturedAt && { gpsCapturedAt: event.gpsCapturedAt }),
    ...(event.exceptionFlags.length > 0 && { exceptionFlags: event.exceptionFlags }),
  };
}

function failedTransport(event: OutboxEvent, reason: unknown): OutboxEvent {
  const actionable = reason instanceof ApiError && reason.status >= 400 && reason.status < 500;
  return {
    ...event,
    syncState: actionable ? 'REJECTED_ACTION_REQUIRED' : 'PENDING_VALIDATION',
    code: reason instanceof ApiError ? reason.code : undefined,
    message: actionable
      ? messageOf(reason, 'The command needs correction.')
      : 'Connection interrupted; the command is safe and queued for retry.',
    retryCount: event.retryCount + 1,
    ...(actionable && { resolvedAt: new Date().toISOString() }),
  };
}

function applyReversal(
  reversal: OutboxEvent,
  original: OutboxEvent,
  result: ScanResult,
  update: (transform: (events: OutboxEvent[]) => OutboxEvent[]) => void,
) {
  update((events) => {
    let next = replaceEvent(events, applyResult(reversal, result));
    if (result.status === 'REVERSED') {
      next = replaceEvent(next, {
        ...original,
        syncState: 'REVERSED',
        message: 'Original accepted event was reversed.',
        resolvedAt: new Date().toISOString(),
      });
    }
    return next;
  });
}

function groupBySession(events: OutboxEvent[]) {
  const groups = new Map<string, OutboxEvent[]>();
  for (const event of events) {
    groups.set(event.taskSessionId, [...(groups.get(event.taskSessionId) ?? []), event]);
  }
  return groups;
}

function messageOf(reason: unknown, fallback: string) {
  return reason instanceof Error && reason.message ? reason.message : fallback;
}

function currentLocation(): Promise<GeolocationCoordinates | undefined> {
  if (!navigator.geolocation) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 4_000, maximumAge: 30_000 },
    );
  });
}

function feedback(kind: 'success' | 'error' | 'pending') {
  navigator.vibrate?.(kind === 'success' ? 70 : kind === 'error' ? [120, 60, 120] : 40);
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return;
  const audio = new AudioContextClass();
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.frequency.value = kind === 'success' ? 880 : kind === 'error' ? 220 : 520;
  gain.gain.value = 0.035;
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.08);
}
