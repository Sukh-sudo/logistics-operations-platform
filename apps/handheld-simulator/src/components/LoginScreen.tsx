import { BadgeCheck, ScanLine, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { IDENTIFIER_EXAMPLES } from '../domain/identifierExamples';

interface LoginScreenProps {
  online: boolean;
  submitting: boolean;
  error: string;
  deviceId: string;
  deviceEnrolled: boolean;
  onEnroll: (credential: string) => void;
  onSubmit: (badgeBarcode: string, employeeId: string) => Promise<void>;
}

export function LoginScreen({
  online,
  submitting,
  error,
  deviceId,
  deviceEnrolled,
  onEnroll,
  onSubmit,
}: LoginScreenProps) {
  const [badgeBarcode, setBadgeBarcode] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [deviceCredential, setDeviceCredential] = useState('');
  const [configuringDevice, setConfiguringDevice] = useState(!deviceEnrolled);

  useEffect(() => {
    if (!deviceEnrolled) setConfiguringDevice(true);
  }, [deviceEnrolled]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void onSubmit(badgeBarcode.trim(), employeeId.trim());
  };

  return (
    <main className="login-shell">
      <section className="login-brand" aria-label="Handheld simulator introduction">
        <div className="brand-mark"><ScanLine aria-hidden="true" /></div>
        <p className="eyebrow">LOGISTICS OPERATIONS</p>
        <h1>Every scan.<br />Accounted for.</h1>
        <p>
          A focused handheld simulator for terminal, last-mile, and courier
          workflows.
        </p>
        <div className="audit-note"><ShieldCheck /> Immutable event audit trail</div>
      </section>

      <section className="login-panel">
        <div className="network-pill" data-online={online}>
          <span />
          {online ? 'Network online' : 'Network offline'}
        </div>
        <div>
          <p className="eyebrow">EMPLOYEE SIGN IN</p>
          <h2>Start your shift</h2>
          <p className="muted">First sign-in requires a connection to the operations API.</p>
        </div>

        <form onSubmit={submit} className="login-form">
          <div className="device-enrollment">
            <span>Device ID</span>
            <code>{deviceId}</code>
            {configuringDevice ? (
              <>
                <label>
                  <span>One-time enrollment credential</span>
                  <input
                    required
                    minLength={32}
                    type="password"
                    value={deviceCredential}
                    onChange={(event) => setDeviceCredential(event.target.value)}
                    autoComplete="new-password"
                  />
                </label>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={deviceCredential.trim().length < 32}
                  onClick={() => {
                    onEnroll(deviceCredential);
                    setDeviceCredential('');
                    setConfiguringDevice(false);
                  }}
                >
                  Save device enrollment
                </button>
              </>
            ) : (
              <button
                type="button"
                className="link-button"
                onClick={() => setConfiguringDevice(true)}
              >
                Device enrolled · Replace credential
              </button>
            )}
          </div>
          <label>
            <span>Badge barcode</span>
            <div className="field-with-icon">
              <BadgeCheck aria-hidden="true" />
              <input
                autoFocus
                required
                value={badgeBarcode}
                onChange={(event) => setBadgeBarcode(event.target.value)}
                placeholder={IDENTIFIER_EXAMPLES.badgeBarcode}
                autoComplete="off"
              />
            </div>
          </label>
          <label>
            <span>Employee number</span>
            <input
              required
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              placeholder={IDENTIFIER_EXAMPLES.employeeNumber}
              autoComplete="username"
            />
          </label>
          {error && <div className="alert error" role="alert">{error}</div>}
          <button
            className="primary-button"
            disabled={!online || submitting || !deviceEnrolled || configuringDevice}
          >
            {submitting ? 'Authenticating…' : 'Authenticate & continue'}
          </button>
        </form>
        <p className="security-copy">Authorized employees only · Activity is audited</p>
      </section>
    </main>
  );
}
