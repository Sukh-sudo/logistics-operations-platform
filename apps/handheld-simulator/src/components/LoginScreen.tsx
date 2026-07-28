import { BadgeCheck, ScanLine, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';

interface LoginScreenProps {
  online: boolean;
  submitting: boolean;
  error: string;
  onSubmit: (badgeBarcode: string, employeeId: string) => Promise<void>;
}

export function LoginScreen({
  online,
  submitting,
  error,
  onSubmit,
}: LoginScreenProps) {
  const [badgeBarcode, setBadgeBarcode] = useState('');
  const [employeeId, setEmployeeId] = useState('');

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
          <label>
            <span>Badge barcode</span>
            <div className="field-with-icon">
              <BadgeCheck aria-hidden="true" />
              <input
                autoFocus
                required
                value={badgeBarcode}
                onChange={(event) => setBadgeBarcode(event.target.value)}
                placeholder="EMP-BADGE-12345"
                autoComplete="off"
              />
            </div>
          </label>
          <label>
            <span>Employee ID</span>
            <input
              required
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              placeholder="EMP-1001"
              autoComplete="username"
            />
          </label>
          {error && <div className="alert error" role="alert">{error}</div>}
          <button className="primary-button" disabled={!online || submitting}>
            {submitting ? 'Authenticating…' : 'Authenticate & continue'}
          </button>
        </form>
        <p className="security-copy">Authorized employees only · Activity is audited</p>
      </section>
    </main>
  );
}
