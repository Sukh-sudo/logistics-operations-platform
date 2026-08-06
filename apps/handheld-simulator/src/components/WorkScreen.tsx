import {
  ArrowLeft,
  Box,
  CheckCircle2,
  CirclePause,
  CirclePlay,
  LocateFixed,
  MapPinned,
  Package,
  ScanLine,
  Square,
  Truck,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type {
  HandheldAction,
  OperationalContext,
  OutboxEvent,
  SessionState,
  WorkSession,
} from '../domain/types';
import {
  type ScanField,
  type ScanValidationErrors,
  validateScanInput,
} from '../domain/scanValidation';
import { taskDefinition } from '../domain/workflows';

interface WorkScreenProps {
  session: WorkSession;
  context: OperationalContext;
  recentEvents: OutboxEvent[];
  busy: boolean;
  online: boolean;
  onBack: () => void;
  onContextChange: (context: OperationalContext) => void;
  onCapture: (
    action: HandheldAction,
    identifier: string,
    containerBarcode: string,
    captureGps: boolean,
  ) => Promise<void>;
  onTransition: (transition: 'pause' | 'resume' | 'complete') => Promise<void>;
}

export function WorkScreen({
  session,
  context,
  recentEvents,
  busy,
  online,
  onBack,
  onContextChange,
  onCapture,
  onTransition,
}: WorkScreenProps) {
  const task = taskDefinition(session.taskType);
  const [selectedAction, setSelectedAction] = useState(task.actions[0].value);
  const [identifier, setIdentifier] = useState('');
  const [containerBarcode, setContainerBarcode] = useState('');
  const [captureGps, setCaptureGps] = useState(true);
  const [validationErrors, setValidationErrors] = useState<ScanValidationErrors>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const definition = useMemo(
    () => task.actions.find((candidate) => candidate.value === selectedAction)!,
    [selectedAction, task.actions],
  );

  useEffect(() => {
    setIdentifier('');
    setContainerBarcode('');
    setValidationErrors({});
    inputRef.current?.focus();
  }, [selectedAction]);

  const clearValidationError = (field: ScanField) => {
    setValidationErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const errors = validateScanInput({
      definition,
      identifier,
      containerBarcode,
      trailerBarcode: context.trailerBarcode,
      truckUnitNumber: context.truckUnitNumber,
    });
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      inputRef.current?.focus();
      return;
    }
    await onCapture(selectedAction, identifier.trim(), containerBarcode.trim(), captureGps);
    setIdentifier('');
    if (definition.identifier === 'PACKAGE') setContainerBarcode('');
    inputRef.current?.focus();
  };

  const paused = session.snapshot.currentState === 'PAUSED';
  const requiredContextMissing =
    (definition.needsTrailer && !context.trailerBarcode.trim()) ||
    (definition.needsRoute && (!context.routeCode.trim() || !context.truckUnitNumber.trim()));
  const requiredIdentifierMissing =
    definition.identifier !== 'NONE' && !identifier.trim();
  const requiredPairMissing =
    definition.needsContainer &&
    definition.identifier === 'PACKAGE' &&
    !containerBarcode.trim();

  return (
    <div className="screen-content work-screen">
      <button className="work-back-button" type="button" onClick={onBack}>
        <ArrowLeft />
        <span>Main menu</span>
      </button>

      <section className="work-header">
        <div>
          <p className="eyebrow">ACTIVE TASK</p>
          <h2>{task.shortLabel}</h2>
          <p>Session {session.id.slice(0, 8).toUpperCase()}</p>
        </div>
        <StateBadge state={session.snapshot.currentState} />
      </section>

      {(task.category === 'TRAILER_OPERATIONS' || task.category === 'LAST_MILE_LOADING' || task.category === 'COURIER_DELIVERY') && (
        <section className="context-card">
          <div className="context-heading">
            {task.category === 'TRAILER_OPERATIONS' ? <Truck /> : <MapPinned />}
            <div>
              <p className="eyebrow">CURRENT CONTEXT</p>
              <h3>{task.category === 'TRAILER_OPERATIONS' ? 'Selected trailer' : 'Selected route & truck'}</h3>
            </div>
          </div>
          {task.category === 'TRAILER_OPERATIONS' ? (
            <label>
              <span>Trailer barcode</span>
              <input
                aria-label="Trailer barcode"
                aria-invalid={Boolean(validationErrors.trailerBarcode)}
                value={context.trailerBarcode}
                onChange={(event) => {
                  clearValidationError('trailerBarcode');
                  onContextChange({ ...context, trailerBarcode: event.target.value.toUpperCase() });
                }}
                placeholder="TRLR123456"
              />
              {validationErrors.trailerBarcode && <small className="field-error">{validationErrors.trailerBarcode}</small>}
            </label>
          ) : (
            <div className="context-grid">
              <label><span>Route code</span><input aria-label="Route code" value={context.routeCode} onChange={(event) => onContextChange({ ...context, routeCode: event.target.value.toUpperCase() })} placeholder="RTE-101" /></label>
              <label><span>Truck unit</span><input aria-label="Truck unit" aria-invalid={Boolean(validationErrors.truckUnitNumber)} value={context.truckUnitNumber} onChange={(event) => { clearValidationError('truckUnitNumber'); onContextChange({ ...context, truckUnitNumber: event.target.value.toUpperCase() }); }} placeholder="LMCAL00001" />{validationErrors.truckUnitNumber && <small className="field-error">{validationErrors.truckUnitNumber}</small>}</label>
            </div>
          )}
          {recentEvents.some((event) => event.syncState === 'PENDING' || event.syncState === 'PENDING_VALIDATION') && (
            <p className="field-hint">Changing context affects new scans only. Pending scans retain their captured context.</p>
          )}
        </section>
      )}

      <section className="scanner-card">
        <div className="scanner-heading">
          <div className="scanner-glyph"><ScanLine /></div>
          <div><p className="eyebrow">CONTINUOUS SCAN</p><h3>{definition.instruction}</h3></div>
        </div>

        <div className="action-chips" aria-label="Scan action">
          {task.actions.map((candidate) => (
            <button
              key={candidate.value}
              className={candidate.value === selectedAction ? 'selected' : ''}
              onClick={() => setSelectedAction(candidate.value)}
              type="button"
            >
              {candidate.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="scan-form">
          {definition.identifier !== 'NONE' && (
            <label>
              <span>{definition.identifier === 'PACKAGE' ? 'Package tracking number' : 'Container barcode'}</span>
              <div className="scan-input">
                {definition.identifier === 'PACKAGE' ? <Package /> : <Box />}
                <input
                  ref={inputRef}
                  aria-label={definition.identifier === 'PACKAGE' ? 'Package tracking number' : 'Container barcode'}
                  aria-invalid={Boolean(validationErrors.identifier)}
                  value={identifier}
                  onChange={(event) => {
                    clearValidationError('identifier');
                    setIdentifier(event.target.value.toUpperCase());
                  }}
                  placeholder="CON1234567"
                />
              </div>
              {validationErrors.identifier && <small className="field-error">{validationErrors.identifier}</small>}
            </label>
          )}
          {definition.needsContainer && definition.identifier === 'PACKAGE' && (
            <label>
              <span>Container barcode</span>
              <div className="scan-input"><Box /><input aria-label="Container barcode" aria-invalid={Boolean(validationErrors.containerBarcode)} value={containerBarcode} onChange={(event) => { clearValidationError('containerBarcode'); setContainerBarcode(event.target.value.toUpperCase()); }} placeholder="CON1234567" /></div>
              {validationErrors.containerBarcode && <small className="field-error">{validationErrors.containerBarcode}</small>}
            </label>
          )}
          {definition.delivery && (
            <label className="toggle-row">
              <span><LocateFixed /><span><strong>Capture GPS</strong><small>Best effort; unavailable location will not block work.</small></span></span>
              <input type="checkbox" checked={captureGps} onChange={(event) => setCaptureGps(event.target.checked)} />
            </label>
          )}
          {!online && <div className="alert pending">Offline capture · This scan will be queued for server validation.</div>}
          <button
            className="scan-button"
            disabled={busy || paused || requiredContextMissing || requiredIdentifierMissing || requiredPairMissing}
          >
            <ScanLine /> {definition.identifier === 'NONE' ? definition.label : 'Record scan'}
          </button>
        </form>
      </section>

      <section className="session-controls">
        <button
          className="secondary-button"
          disabled={!online || busy}
          onClick={() => void onTransition(paused ? 'resume' : 'pause')}
        >
          {paused ? <CirclePlay /> : <CirclePause />}
          {paused ? 'Resume task' : 'Pause task'}
        </button>
        <button
          className="danger-button"
          disabled={!online || busy}
          onClick={() => void onTransition('complete')}
        >
          <Square /> Complete
        </button>
      </section>

      {recentEvents[0] && (
        <section className={`latest-result ${recentEvents[0].syncState.toLowerCase()}`}>
          <CheckCircle2 />
          <div><p className="eyebrow">LATEST RESULT</p><strong>{recentEvents[0].trackingNumber ?? recentEvents[0].containerBarcode ?? recentEvents[0].trailerBarcode}</strong><small>{recentEvents[0].message}</small></div>
        </section>
      )}
    </div>
  );
}

function StateBadge({ state }: { state: SessionState }) {
  return <span className={`session-state ${state.toLowerCase()}`}>{state.replaceAll('_', ' ')}</span>;
}
