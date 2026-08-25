import {
  ArrowRight,
  Box,
  PackageSearch,
  Route,
  ScanBarcode,
  Truck,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { IDENTIFIER_EXAMPLES } from '../domain/identifierExamples';
import type { Bootstrap, PackageLookup, TaskType, WorkSession } from '../domain/types';
import { visibleTasks } from '../domain/workflows';

interface HomeScreenProps {
  bootstrap: Bootstrap;
  activeSessions: WorkSession[];
  online: boolean;
  busy: boolean;
  onOpenTask: (task: TaskType) => Promise<void>;
  onLookup: (trackingNumber: string) => Promise<PackageLookup>;
}

const icons = {
  TRAILER_OPERATIONS: Truck,
  LAST_MILE_LOADING: Route,
  COURIER_DELIVERY: ScanBarcode,
};

export function HomeScreen({
  bootstrap,
  activeSessions,
  online,
  busy,
  onOpenTask,
  onLookup,
}: HomeScreenProps) {
  const [lookup, setLookup] = useState('');
  const [lookupResult, setLookupResult] = useState<PackageLookup | null>(null);
  const [lookupError, setLookupError] = useState('');

  const submitLookup = async (event: FormEvent) => {
    event.preventDefault();
    setLookupError('');
    try {
      setLookupResult(await onLookup(lookup.trim().toUpperCase()));
    } catch (reason) {
      setLookupResult(null);
      setLookupError(reason instanceof Error ? reason.message : 'Package lookup failed.');
    }
  };

  return (
    <div className="screen-content home-screen">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">READY FOR WORK</p>
          <h2>Good shift, {bootstrap.employee.firstName}.</h2>
          <p>{bootstrap.terminal.name} · {bootstrap.terminal.terminalCode}</p>
        </div>
        <div className="employee-avatar" aria-hidden="true">
          {bootstrap.employee.firstName[0]}{bootstrap.employee.lastName[0]}
        </div>
      </section>

      {activeSessions.length > 0 && (
        <div className="info-banner">
          <span>{activeSessions.length}</span>
          <div><strong>Open task {activeSessions.length === 1 ? 'session' : 'sessions'}</strong>
            <p>Select the matching task below to continue.</p>
          </div>
        </div>
      )}

      <section>
        <div className="section-heading">
          <div><p className="eyebrow">SELECT A TASK</p><h3>What are you working on?</h3></div>
          <span>{visibleTasks(bootstrap.authorizedTasks).length} available</span>
        </div>
        <div className="task-grid">
          {visibleTasks(bootstrap.authorizedTasks).map((task) => {
            const Icon = icons[task.category];
            const open = activeSessions.some(
              (session) => session.taskType === task.type && session.snapshot.currentState !== 'COMPLETED',
            );
            return (
              <button
                key={task.type}
                className="task-card"
                onClick={() => void onOpenTask(task.type)}
                disabled={busy}
              >
                <span className="task-icon"><Icon /></span>
                <span className="task-card-copy">
                  <strong>{task.label}</strong>
                  <small>{task.description}</small>
                  {open && <em>Resume open session</em>}
                </span>
                <ArrowRight className="task-arrow" />
              </button>
            );
          })}
        </div>
      </section>

      <section className="lookup-card">
        <div className="lookup-title">
          <span><PackageSearch /></span>
          <div><h3>Package snapshot lookup</h3><p>Read current server state without replaying history.</p></div>
        </div>
        <form onSubmit={submitLookup} className="inline-form">
          <input
            aria-label="Tracking number lookup"
            value={lookup}
            onChange={(event) => setLookup(event.target.value)}
            placeholder={IDENTIFIER_EXAMPLES.packageTrackingNumber}
            required
          />
          <button disabled={!online}>Look up</button>
        </form>
        {!online && <p className="field-hint">Lookups require a network connection.</p>}
        {lookupError && <div className="alert error" role="alert">{lookupError}</div>}
        {lookupResult && (
          <div className="lookup-result">
            <Box />
            <div><strong>{lookupResult.trackingNumber}</strong>
              <p>{lookupResult.currentStatus ?? 'Status unavailable'} · {lookupResult.postalCode ?? 'No postal code'}</p>
            </div>
            <span>{lookupResult.routeCode ?? 'No route'}</span>
          </div>
        )}
      </section>
    </div>
  );
}
