import {
  AlertTriangle,
  Check,
  Clock3,
  RefreshCcw,
  RotateCcw,
  Trash2,
  WifiOff,
} from 'lucide-react';
import type { OutboxEvent } from '../domain/types';
import { isPending } from '../storage/outbox';

interface HistoryScreenProps {
  events: OutboxEvent[];
  online: boolean;
  syncing: boolean;
  onSync: () => Promise<void>;
  onReverse: (event: OutboxEvent) => Promise<void>;
  onDismiss: (event: OutboxEvent) => void;
}

const statusMeta = (event: OutboxEvent) => {
  if (event.syncState === 'ACCEPTED' || event.syncState === 'DUPLICATE_ACCEPTED') {
    return { label: 'Accepted', icon: Check, tone: 'success' };
  }
  if (event.syncState === 'REVERSED') {
    return { label: 'Reversed', icon: RotateCcw, tone: 'neutral' };
  }
  if (event.syncState === 'REJECTED_ACTION_REQUIRED') {
    return { label: 'Action needed', icon: AlertTriangle, tone: 'danger' };
  }
  if (event.syncState === 'DISMISSED_LOCAL') {
    return { label: 'Dismissed', icon: Trash2, tone: 'neutral' };
  }
  return {
    label: event.networkStateAtCapture === 'OFFLINE_NETWORK' ? 'Pending validation' : 'Pending',
    icon: event.networkStateAtCapture === 'OFFLINE_NETWORK' ? WifiOff : Clock3,
    tone: 'pending',
  };
};

const readable = (value: string) =>
  value.toLowerCase().replaceAll('_', ' ').replace(/^\w/, (character) => character.toUpperCase());

export function HistoryScreen({
  events,
  online,
  syncing,
  onSync,
  onReverse,
  onDismiss,
}: HistoryScreenProps) {
  const pendingCount = events.filter(isPending).length;
  return (
    <div className="screen-content history-screen">
      <div className="section-heading">
        <div><p className="eyebrow">LOCAL EVENT OUTBOX</p><h2>Work history</h2></div>
        <button
          className="secondary-button compact"
          disabled={!online || syncing || pendingCount === 0}
          onClick={() => void onSync()}
        >
          <RefreshCcw className={syncing ? 'spin' : ''} />
          {syncing ? 'Syncing' : `Sync ${pendingCount}`}
        </button>
      </div>
      <p className="muted history-intro">
        Unresolved work is retained until the server returns an authoritative outcome.
      </p>

      {events.length === 0 ? (
        <div className="empty-state"><Clock3 /><h3>No scans yet</h3><p>Captured work will appear here.</p></div>
      ) : (
        <div className="event-list">
          {events.map((event) => {
            const meta = statusMeta(event);
            const Icon = meta.icon;
            const identifier = event.trackingNumber ?? event.containerBarcode ?? event.trailerBarcode ?? 'Session event';
            return (
              <article className="event-card" key={event.clientEventId}>
                <div className={`event-status ${meta.tone}`}><Icon /></div>
                <div className="event-copy">
                  <div className="event-topline">
                    <strong>{identifier}</strong>
                    <time>{new Date(event.deviceTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                  </div>
                  <p>{readable(event.action)}</p>
                  <small>{event.message}</small>
                  {event.code && event.syncState === 'REJECTED_ACTION_REQUIRED' && <code>{event.code}</code>}
                  {event.exceptionFlags.length > 0 && (
                    <div className="flag-row">{event.exceptionFlags.map((flag) => <span key={flag}>{readable(flag)}</span>)}</div>
                  )}
                  <div className="event-actions">
                    <span className={`status-label ${meta.tone}`}>{meta.label}</span>
                    {(event.syncState === 'ACCEPTED' || event.syncState === 'DUPLICATE_ACCEPTED') &&
                      event.action !== 'REVERSE_EVENT' && (
                        <button disabled={!online} onClick={() => void onReverse(event)}>
                          <RotateCcw /> Reverse
                        </button>
                      )}
                    {event.syncState === 'REJECTED_ACTION_REQUIRED' && (
                      <button onClick={() => onDismiss(event)}><Trash2 /> Dismiss locally</button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
