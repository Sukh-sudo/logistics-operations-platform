import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  CheckCircle2,
  MapPinned,
  PackageCheck,
  PackageOpen,
  Search,
  Truck,
} from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Timeline } from '../components/timeline/Timeline';
import { StatusBadge } from '../components/ui/StatusBadge';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/ui/ViewStates';
import { clampProgress } from '../features/trips/tripProgress';
import { trackingApi } from '../services/tracking.api';

const timestamp = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : '—';

export function TrackingPage() {
  const { shipmentNumber = '' } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(shipmentNumber);

  useEffect(() => setInput(shipmentNumber), [shipmentNumber]);

  const tracking = useQuery({
    queryKey: ['customer-tracking', shipmentNumber],
    queryFn: () => trackingApi.shipment(shipmentNumber),
    enabled: Boolean(shipmentNumber),
    retry: false,
  });
  const notFound =
    axios.isAxiosError(tracking.error) &&
    tracking.error.response?.status === 404;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = input.trim();
    if (value) {
      navigate(`/tracking/${encodeURIComponent(value)}`);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <div>
        <p className="text-sm font-medium text-brand-600">
          Customer visibility
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-900">
          Track a shipment
        </h2>
        <p className="mt-2 text-slate-500">
          Enter a shipment number to see its current delivery snapshot and
          milestones.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="flex flex-col gap-3 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row"
      >
        <label className="flex-1 text-xs font-medium text-slate-500">
          Shipment number
          <input
            aria-label="Shipment number"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="CUSTOMER-12345"
            className="mt-1 block h-11 w-full rounded-lg border bg-white px-3 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </label>
        <button
          type="submit"
          disabled={!input.trim() || tracking.isFetching}
          className="focus-ring mt-auto flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Search className="h-4 w-4" />
          Track shipment
        </button>
      </form>

      {!shipmentNumber && (
        <section className="rounded-2xl border border-dashed bg-white">
          <EmptyState label="Enter a shipment number to begin tracking" />
        </section>
      )}
      {tracking.isFetching && <LoadingState />}
      {notFound && (
        <section className="rounded-2xl border bg-white">
          <EmptyState label={`No shipment found for ${shipmentNumber}`} />
        </section>
      )}
      {tracking.isError && !notFound && (
        <ErrorState message="The shipment tracking record could not be loaded." />
      )}
      {tracking.data && !tracking.isFetching && (
        <TrackingResult tracking={tracking.data} />
      )}
    </div>
  );
}

function TrackingResult({
  tracking,
}: {
  tracking: Awaited<ReturnType<typeof trackingApi.shipment>>;
}) {
  const progress = clampProgress(tracking.progress.progressPercent);
  const timeline = tracking.milestones.map((milestone, index) => ({
    id: `${milestone.type}-${milestone.occurredAt}-${index}`,
    title: milestone.type.replaceAll('_', ' '),
    occurredAt: milestone.occurredAt,
    details: [],
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            Reference {tracking.referenceNumber ?? 'not provided'}
          </p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">
            {tracking.shipmentNumber}
          </h3>
        </div>
        <StatusBadge value={tracking.status} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          icon={PackageOpen}
          label="Packages"
          value={tracking.progress.packageCount}
        />
        <Metric
          icon={Truck}
          label="Out for delivery"
          value={tracking.progress.outForDeliveryPackages}
        />
        <Metric
          icon={CheckCircle2}
          label="Delivered"
          value={tracking.progress.deliveredPackages}
        />
        <Metric
          icon={PackageCheck}
          label="Remaining"
          value={tracking.progress.remainingPackages}
        />
      </div>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">
            Delivery progress
          </span>
          <span className="font-semibold text-brand-700">{progress}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <TerminalCard label="Origin" terminal={tracking.origin} />
          <TerminalCard
            label="Current location"
            terminal={tracking.currentTerminal}
          />
          <TerminalCard label="Destination" terminal={tracking.destination} />
        </div>
        <p className="mt-5 text-xs text-slate-400">
          Last activity: {timestamp(tracking.progress.lastActivityAt)}
          {tracking.progress.completedAt
            ? ` · Completed ${timestamp(tracking.progress.completedAt)}`
            : ''}
        </p>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <SectionHeader
          title="Packages"
          subtitle={`${tracking.packages.length} packages in this shipment`}
        />
        {tracking.packages.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-4">Tracking number</th>
                  <th>Status</th>
                  <th>Last updated</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tracking.packages.map((pkg) => (
                  <tr key={pkg.trackingNumber}>
                    <td className="px-6 py-4">
                      <Link
                        className="font-semibold text-brand-700 hover:text-brand-900"
                        to={`/packages/${encodeURIComponent(pkg.trackingNumber)}`}
                      >
                        {pkg.trackingNumber}
                      </Link>
                    </td>
                    <td>
                      <StatusBadge value={pkg.status} />
                    </td>
                    <td className="text-slate-500">
                      {timestamp(pkg.lastUpdatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState label="No packages are assigned to this shipment" />
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <SectionHeader
          title="Delivery milestones"
          subtitle="Oldest to newest"
        />
        {timeline.length ? (
          <Timeline entries={timeline} />
        ) : (
          <EmptyState label="No shipment milestones recorded" />
        )}
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof PackageOpen;
  label: string;
  value: number;
}) {
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <Icon className="h-5 w-5 text-brand-700" />
      <p className="mt-4 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </section>
  );
}

function TerminalCard({
  label,
  terminal,
}: {
  label: string;
  terminal: Awaited<
    ReturnType<typeof trackingApi.shipment>
  >['currentTerminal'];
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
        <MapPinned className="h-4 w-4" />
        {label}
      </div>
      {terminal ? (
        <>
          <p className="mt-3 text-sm font-semibold text-slate-800">
            {terminal.name}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {terminal.city}, {terminal.province}
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-400">Not available</p>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="border-b px-6 py-5">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
    </div>
  );
}
