import type { DeliveryReportFilters } from '@logistics/shared-types';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  ClipboardList,
  PackageCheck,
  SlidersHorizontal,
  Truck,
  X,
} from 'lucide-react';
import { type ChangeEvent, type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';

import { StatusBadge } from '../components/ui/StatusBadge';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/ui/ViewStates';
import { reportingApi } from '../services/reporting.api';
import { transportationApi } from '../services/transportation.api';

interface ReportForm {
  fromDate: string;
  toDate: string;
  originTerminalId: string;
  destinationTerminalId: string;
}

const emptyForm: ReportForm = {
  fromDate: '',
  toDate: '',
  originTerminalId: '',
  destinationTerminalId: '',
};

const timestamp = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : '—';
export function ReportsPage() {
  const [form, setForm] = useState<ReportForm>(emptyForm);
  const [filters, setFilters] = useState<DeliveryReportFilters>({});
  const report = useQuery({
    queryKey: ['delivery-report', filters],
    queryFn: () => reportingApi.deliveries(filters),
    retry: false,
  });
  const terminals = useQuery({
    queryKey: ['report-terminals'],
    queryFn: transportationApi.terminals,
  });

  const update =
    (field: keyof ReportForm) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((current) => ({ ...current, [field]: event.target.value }));

  const apply = (event: FormEvent) => {
    event.preventDefault();
    setFilters({
      ...(form.fromDate && { fromDate: form.fromDate }),
      ...(form.toDate && { toDate: form.toDate }),
      ...(form.originTerminalId && {
        originTerminalId: Number(form.originTerminalId),
      }),
      ...(form.destinationTerminalId && {
        destinationTerminalId: Number(form.destinationTerminalId),
      }),
    });
  };
  const clear = () => {
    setForm(emptyForm);
    setFilters({});
  };
  const hasFilters = Object.values(form).some(Boolean);

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div>
        <p className="text-sm font-medium text-brand-600">
          Customer operations
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-900">
          Delivery reports
        </h2>
        <p className="mt-2 text-slate-500">
          Review snapshot-backed shipment completion and package delivery
          performance.
        </p>
      </div>

      <form
        onSubmit={apply}
        className="flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-5 shadow-sm"
      >
        <div className="mr-1 flex h-10 items-center gap-2 text-sm font-medium text-slate-600">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
        </div>
        <label className="text-xs font-medium text-slate-500">
          From
          <input
            aria-label="Report from date"
            type="date"
            max={form.toDate || undefined}
            value={form.fromDate}
            onChange={update('fromDate')}
            className="mt-1 block h-10 rounded-lg border bg-white px-3 text-sm text-slate-700"
          />
        </label>
        <label className="text-xs font-medium text-slate-500">
          To
          <input
            aria-label="Report to date"
            type="date"
            min={form.fromDate || undefined}
            value={form.toDate}
            onChange={update('toDate')}
            className="mt-1 block h-10 rounded-lg border bg-white px-3 text-sm text-slate-700"
          />
        </label>
        <label className="text-xs font-medium text-slate-500">
          Origin
          <select
            aria-label="Report origin"
            value={form.originTerminalId}
            onChange={update('originTerminalId')}
            className="mt-1 block h-10 min-w-44 rounded-lg border bg-white px-3 text-sm text-slate-700"
          >
            <option value="">All origins</option>
            {terminals.data?.map((terminal) => (
              <option key={terminal.id} value={terminal.id}>
                {terminal.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500">
          Destination
          <select
            aria-label="Report destination"
            value={form.destinationTerminalId}
            onChange={update('destinationTerminalId')}
            className="mt-1 block h-10 min-w-44 rounded-lg border bg-white px-3 text-sm text-slate-700"
          >
            <option value="">All destinations</option>
            {terminals.data?.map((terminal) => (
              <option key={terminal.id} value={terminal.id}>
                {terminal.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="focus-ring h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Apply
        </button>
        {hasFilters && (
          <button
            type="button"
            onClick={clear}
            className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        )}
      </form>

      {(report.isLoading || terminals.isLoading) && <LoadingState />}
      {(report.isError || terminals.isError) && (
        <ErrorState message="The delivery report could not be loaded." />
      )}
      {report.data && !report.isLoading && (
        <ReportResult report={report.data} />
      )}
    </div>
  );
}

function ReportResult({
  report,
}: {
  report: Awaited<ReturnType<typeof reportingApi.deliveries>>;
}) {
  const cards = [
    {
      label: 'Total shipments',
      value: report.totals.totalShipments,
      detail: `${report.totals.activeShipments} active`,
      icon: ClipboardList,
    },
    {
      label: 'Completed',
      value: report.totals.completedShipments,
      detail: `${report.totals.completionRate}% completion rate`,
      icon: CheckCircle2,
    },
    {
      label: 'Packages delivered',
      value: report.totals.deliveredPackages,
      detail: `${report.totals.totalPackages} total packages`,
      icon: PackageCheck,
    },
    {
      label: 'Cancelled',
      value: report.totals.cancelledShipments,
      detail: 'Shipment exceptions',
      icon: Truck,
    },
  ];
  const statuses = Object.entries(report.statusBreakdown).filter(
    ([, count]) => count > 0,
  );

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label: cardLabel, value, detail, icon: Icon }) => (
          <section
            key={cardLabel}
            className="rounded-2xl border bg-white p-5 shadow-sm"
          >
            <Icon className="h-5 w-5 text-brand-700" />
            <p className="mt-4 text-3xl font-semibold text-slate-900">
              {value.toLocaleString()}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-700">
              {cardLabel}
            </p>
            <p className="mt-1 text-xs text-slate-400">{detail}</p>
          </section>
        ))}
      </div>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-slate-900">Status breakdown</h3>
        {statuses.length ? (
          <div className="mt-5 flex flex-wrap gap-3">
            {statuses.map(([status, count]) => (
              <div
                key={status}
                className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3"
              >
                <StatusBadge value={status} />
                <span className="text-sm font-semibold text-slate-800">
                  {count}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState label="No shipment statuses match these filters" />
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-6 py-5">
          <h3 className="font-semibold text-slate-900">Shipment deliveries</h3>
          <p className="mt-1 text-xs text-slate-400">
            {report.deliveries.length} matching shipments
          </p>
        </div>
        {report.deliveries.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-4">Shipment</th>
                  <th>Status</th>
                  <th>Packages</th>
                  <th>Progress</th>
                  <th>Created</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.deliveries.map((delivery) => (
                  <tr key={delivery.shipmentNumber}>
                    <td className="px-6 py-4">
                      <Link
                        to={`/tracking/${encodeURIComponent(delivery.shipmentNumber)}`}
                        className="font-semibold text-brand-700 hover:text-brand-900"
                      >
                        {delivery.shipmentNumber}
                      </Link>
                    </td>
                    <td>
                      <StatusBadge value={delivery.status} />
                    </td>
                    <td>
                      {delivery.deliveredPackages} / {delivery.packageCount}
                    </td>
                    <td className="font-medium text-slate-700">
                      {delivery.progressPercent}%
                    </td>
                    <td className="text-slate-500">
                      {timestamp(delivery.createdAt)}
                    </td>
                    <td className="text-slate-500">
                      {timestamp(delivery.completedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState label="No deliveries match these filters" />
        )}
      </section>
    </>
  );
}
