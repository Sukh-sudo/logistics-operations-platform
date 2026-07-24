import type { PackageEventType, TerminalAssetType } from '@logistics/shared-types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Boxes, Container, PackageCheck, RefreshCw, Route, Send, Truck } from 'lucide-react';
import { type FormEvent, type PropsWithChildren, useState } from 'react';
import { containerApi } from '../services/container.api';
import { fleetApi } from '../services/fleet.api';
import { packageApi } from '../services/package.api';
import { recoveryApi } from '../services/recovery.api';
import { shipmentApi } from '../services/shipment.api';
import { terminalApi } from '../services/terminal.api';
import { trailerApi } from '../services/trailer.api';
import { transportationApi } from '../services/transportation.api';
import { tripApi } from '../services/trip.api';

const inputClass = 'mt-1 h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100';
const buttonClass = 'focus-ring inline-flex h-10 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50';
const packageEvents: PackageEventType[] = ['PACKAGE_RECEIVED', 'PACKAGE_SORTED', 'PACKAGE_LOADED_TO_CONTAINER', 'PACKAGE_UNLOADED_FROM_CONTAINER', 'PACKAGE_LOADED_TO_TRAILER', 'PACKAGE_UNLOADED_FROM_TRAILER', 'PACKAGE_DEPARTED', 'PACKAGE_ARRIVED', 'PACKAGE_OUT_FOR_DELIVERY', 'PACKAGE_DELIVERED'];

function Card({ title, description, icon: Icon, children }: PropsWithChildren<{ title: string; description: string; icon: typeof Boxes }>) {
  return <section className="rounded-2xl border bg-white p-6 shadow-sm">
    <div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5"/></span><div><h3 className="font-semibold text-slate-900">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{description}</p></div></div>
    <div className="mt-5 space-y-4">{children}</div>
  </section>;
}

function Field({ label, children }: PropsWithChildren<{ label: string }>) {
  return <label className="block text-xs font-medium text-slate-600">{label}{children}</label>;
}

function TerminalSelect({ label, value, onChange, terminals, required = true }: { label: string; value: string; onChange: (value: string) => void; terminals: Awaited<ReturnType<typeof transportationApi.terminals>>; required?: boolean }) {
  return <Field label={label}><select aria-label={label} required={required} value={value} onChange={event => onChange(event.target.value)} className={inputClass}><option value="">{required ? 'Select a terminal' : 'No terminal'}</option>{terminals.map(terminal => <option key={terminal.id} value={terminal.id}>{terminal.terminalCode} — {terminal.name}</option>)}</select></Field>;
}

function SubmitButton({ children, busy }: PropsWithChildren<{ busy: boolean }>) {
  return <button type="submit" disabled={busy} className={buttonClass}>{busy ? 'Submitting…' : children}</button>;
}

export function OperationsPage() {
  const queryClient = useQueryClient();
  const terminalsQuery = useQuery({ queryKey: ['transportation', 'terminals'], queryFn: transportationApi.terminals });
  const terminals = terminalsQuery.data ?? [];
  const [running, setRunning] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const [packageForm, setPackageForm] = useState({ trackingNumber: '', eventType: 'PACKAGE_RECEIVED' as PackageEventType, terminalId: '', employeeId: '' });
  const [assetForm, setAssetForm] = useState({ assetType: 'CONTAINER' as 'CONTAINER' | 'TRAILER', identifier: '', terminalId: '' });
  const [containerForm, setContainerForm] = useState({ containerId: '', action: 'LOAD' as 'LOAD' | 'UNLOAD', trackingNumber: '' });
  const [trailerForm, setTrailerForm] = useState({ trailerId: '', action: 'LOAD' as 'LOAD' | 'UNLOAD', contentType: 'CONTAINER' as 'CONTAINER' | 'PACKAGE', identifier: '' });
  const [tripForm, setTripForm] = useState({ tripId: '', action: 'START' as 'START' | 'ARRIVE' | 'DEPART' | 'COMPLETE' | 'CANCEL', stopId: '', notes: '' });
  const [fleetForm, setFleetForm] = useState({ action: 'ASSIGN' as 'ASSIGN' | 'RELEASE', assignmentId: '', tripId: '', truckId: '', driverId: '', trailerId: '' });
  const [transferForm, setTransferForm] = useState({ originTerminalId: '', destinationTerminalId: '', assetType: 'PACKAGE' as TerminalAssetType, assetIdentifier: '', employeeId: '' });
  const [shipmentCreate, setShipmentCreate] = useState({ shipmentNumber: '', referenceNumber: '', notificationRecipient: '', originTerminalId: '', destinationTerminalId: '', packageTrackingNumbers: '' });
  const [shipmentAction, setShipmentAction] = useState({ shipmentId: '', action: 'ASSIGN_PACKAGE' as 'UPDATE_REFERENCE' | 'ASSIGN_PACKAGE' | 'REMOVE_PACKAGE' | 'COMPLETE' | 'CANCEL', value: '' });

  const perform = async (name: string, action: () => Promise<unknown>, success: (result: unknown) => string = () => `${name} completed.`) => {
    setRunning(name);
    setNotice(null);
    try {
      const result = await action();
      // Mutations change event streams and their snapshot projections, so all
      // visible read models are marked stale after a successful transaction.
      await queryClient.invalidateQueries();
      setNotice({ kind: 'success', text: success(result) });
    } catch (error) {
      const message = typeof error === 'object' && error && 'response' in error
        ? String((error as { response?: { data?: { message?: string | string[]; error?: { message?: string } } } }).response?.data?.error?.message ?? (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message ?? 'The operation was rejected.')
        : error instanceof Error ? error.message : 'The operation failed.';
      setNotice({ kind: 'error', text: message });
    } finally {
      setRunning(null);
    }
  };

  const submitPackage = (event: FormEvent) => {
    event.preventDefault();
    void perform('Package event', () => packageApi.createEvent({
      trackingNumber: packageForm.trackingNumber.trim().toUpperCase(),
      eventType: packageForm.eventType,
      ...(packageForm.terminalId ? { terminalId: Number(packageForm.terminalId) } : {}),
      ...(packageForm.employeeId ? { employeeId: Number(packageForm.employeeId) } : {}),
    }));
  };

  const submitAsset = (event: FormEvent) => {
    event.preventDefault();
    const terminalId = Number(assetForm.terminalId);
    const identifier = assetForm.identifier.trim().toUpperCase();
    void perform(`Create ${assetForm.assetType.toLowerCase()}`, () => assetForm.assetType === 'CONTAINER'
      ? containerApi.create({ containerBarcode: identifier, terminalId })
      : trailerApi.create({ trailerBarcode: identifier, terminalId }));
  };

  const submitContainer = (event: FormEvent) => {
    event.preventDefault();
    const payload = { trackingNumber: containerForm.trackingNumber.trim().toUpperCase() };
    void perform(`${containerForm.action.toLowerCase()} package`, () => containerForm.action === 'LOAD'
      ? containerApi.loadPackage(containerForm.containerId.trim(), payload)
      : containerApi.unloadPackage(containerForm.containerId.trim(), payload));
  };

  const submitTrailer = (event: FormEvent) => {
    event.preventDefault();
    const trailerId = trailerForm.trailerId.trim();
    const identifier = trailerForm.identifier.trim().toUpperCase();
    void perform(`${trailerForm.action.toLowerCase()} trailer freight`, () => {
      if (trailerForm.contentType === 'CONTAINER') {
        const payload = { containerBarcode: identifier };
        return trailerForm.action === 'LOAD' ? trailerApi.loadContainer(trailerId, payload) : trailerApi.unloadContainer(trailerId, payload);
      }
      const payload = { trackingNumber: identifier };
      return trailerForm.action === 'LOAD' ? trailerApi.loadPackage(trailerId, payload) : trailerApi.unloadPackage(trailerId, payload);
    });
  };

  const submitTrip = (event: FormEvent) => {
    event.preventDefault();
    const id = tripForm.tripId.trim();
    void perform(`${tripForm.action.toLowerCase()} trip`, () => {
      if (tripForm.action === 'START') return tripApi.start(id);
      if (tripForm.action === 'COMPLETE') return tripApi.complete(id);
      if (tripForm.action === 'CANCEL') return tripApi.cancel(id);
      const payload = tripForm.notes.trim() ? { notes: tripForm.notes.trim() } : {};
      return tripForm.action === 'ARRIVE' ? tripApi.arrive(id, tripForm.stopId.trim(), payload) : tripApi.depart(id, tripForm.stopId.trim(), payload);
    });
  };

  const submitFleet = (event: FormEvent) => {
    event.preventDefault();
    void perform(`${fleetForm.action.toLowerCase()} equipment`, () => fleetForm.action === 'RELEASE'
      ? fleetApi.release(fleetForm.assignmentId.trim())
      : fleetApi.assign({ tripId: fleetForm.tripId.trim(), truckId: fleetForm.truckId.trim(), driverId: fleetForm.driverId.trim(), trailerId: fleetForm.trailerId.trim() }));
  };

  const submitTransfer = (event: FormEvent) => {
    event.preventDefault();
    void perform('Terminal transfer', () => terminalApi.transfer(Number(transferForm.originTerminalId), {
      destinationTerminalId: Number(transferForm.destinationTerminalId),
      assetType: transferForm.assetType,
      assetIdentifier: transferForm.assetIdentifier.trim().toUpperCase(),
      ...(transferForm.employeeId ? { employeeId: Number(transferForm.employeeId) } : {}),
    }));
  };

  const submitShipmentCreate = (event: FormEvent) => {
    event.preventDefault();
    const packageTrackingNumbers = shipmentCreate.packageTrackingNumbers.split(/[\s,]+/).map(value => value.trim().toUpperCase()).filter(Boolean);
    void perform('Create shipment', () => shipmentApi.create({
      shipmentNumber: shipmentCreate.shipmentNumber.trim(),
      originTerminalId: Number(shipmentCreate.originTerminalId),
      destinationTerminalId: Number(shipmentCreate.destinationTerminalId),
      packageTrackingNumbers,
      ...(shipmentCreate.referenceNumber.trim() ? { referenceNumber: shipmentCreate.referenceNumber.trim() } : {}),
      ...(shipmentCreate.notificationRecipient.trim() ? { notificationRecipient: shipmentCreate.notificationRecipient.trim() } : {}),
    }));
  };

  const submitShipmentAction = (event: FormEvent) => {
    event.preventDefault();
    const id = shipmentAction.shipmentId.trim();
    const value = shipmentAction.value.trim();
    void perform('Shipment update', () => {
      if (shipmentAction.action === 'UPDATE_REFERENCE') return shipmentApi.update(id, { referenceNumber: value });
      if (shipmentAction.action === 'ASSIGN_PACKAGE') return shipmentApi.assignPackage(id, { trackingNumber: value.toUpperCase() });
      if (shipmentAction.action === 'REMOVE_PACKAGE') return shipmentApi.removePackage(id, { trackingNumber: value.toUpperCase() });
      if (shipmentAction.action === 'COMPLETE') return shipmentApi.complete(id);
      return shipmentApi.cancel(id);
    });
  };

  const busy = running !== null;
  const tripNeedsStop = tripForm.action === 'ARRIVE' || tripForm.action === 'DEPART';
  const shipmentNeedsValue = shipmentAction.action === 'UPDATE_REFERENCE' || shipmentAction.action === 'ASSIGN_PACKAGE' || shipmentAction.action === 'REMOVE_PACKAGE';

  return <div className="mx-auto max-w-7xl">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-medium text-brand-600">Transactional commands</p><h2 className="mt-1 text-2xl font-semibold text-slate-900">Operations workspace</h2><p className="mt-2 max-w-3xl text-slate-500">Submit business actions to the backend. Each accepted action appends events and updates snapshot read models transactionally.</p></div>
    </div>

    {notice && <div role={notice.kind === 'error' ? 'alert' : 'status'} className={`mt-6 rounded-xl border px-4 py-3 text-sm ${notice.kind === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{notice.text}</div>}
    {terminalsQuery.isError && <div role="alert" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Terminal choices could not be loaded. Refresh before submitting terminal-owned operations.</div>}

    <div className="mt-7 grid gap-6 xl:grid-cols-2">
      <Card title="Package event" description="Append a lifecycle event and update package and shipment projections." icon={PackageCheck}>
        <form onSubmit={submitPackage} className="grid gap-4 sm:grid-cols-2">
          <Field label="Tracking number"><input aria-label="Package tracking number" required value={packageForm.trackingNumber} onChange={event => setPackageForm(current => ({ ...current, trackingNumber: event.target.value }))} className={inputClass}/></Field>
          <Field label="Event"><select aria-label="Package event" value={packageForm.eventType} onChange={event => setPackageForm(current => ({ ...current, eventType: event.target.value as PackageEventType }))} className={inputClass}>{packageEvents.map(value => <option key={value}>{value}</option>)}</select></Field>
          <TerminalSelect label="Package terminal" required={packageForm.eventType === 'PACKAGE_RECEIVED' || packageForm.eventType === 'PACKAGE_ARRIVED'} value={packageForm.terminalId} onChange={value => setPackageForm(current => ({ ...current, terminalId: value }))} terminals={terminals}/>
          <Field label="Employee ID (optional)"><input aria-label="Package employee ID" type="number" min="1" value={packageForm.employeeId} onChange={event => setPackageForm(current => ({ ...current, employeeId: event.target.value }))} className={inputClass}/></Field>
          <div className="sm:col-span-2"><SubmitButton busy={busy}>Record package event</SubmitButton></div>
        </form>
      </Card>

      <Card title="Create handling asset" description="Register a container or trailer with its required owning terminal." icon={Boxes}>
        <form onSubmit={submitAsset} className="grid gap-4 sm:grid-cols-2">
          <Field label="Asset type"><select aria-label="New asset type" value={assetForm.assetType} onChange={event => setAssetForm(current => ({ ...current, assetType: event.target.value as 'CONTAINER' | 'TRAILER' }))} className={inputClass}><option value="CONTAINER">Container</option><option value="TRAILER">Trailer</option></select></Field>
          <Field label={assetForm.assetType === 'CONTAINER' ? 'Container barcode' : 'Trailer barcode'}><input aria-label="New asset identifier" required value={assetForm.identifier} onChange={event => setAssetForm(current => ({ ...current, identifier: event.target.value }))} className={inputClass}/></Field>
          <TerminalSelect label="Owning terminal" value={assetForm.terminalId} onChange={value => setAssetForm(current => ({ ...current, terminalId: value }))} terminals={terminals}/>
          <div className="flex items-end"><SubmitButton busy={busy}>Create asset</SubmitButton></div>
        </form>
      </Card>

      <Card title="Container freight" description="Load or unload a package using the stable container aggregate ID." icon={Container}>
        <form onSubmit={submitContainer} className="grid gap-4 sm:grid-cols-2">
          <Field label="Container aggregate ID"><input aria-label="Container aggregate ID" required value={containerForm.containerId} onChange={event => setContainerForm(current => ({ ...current, containerId: event.target.value }))} className={inputClass}/></Field>
          <Field label="Action"><select aria-label="Container action" value={containerForm.action} onChange={event => setContainerForm(current => ({ ...current, action: event.target.value as 'LOAD' | 'UNLOAD' }))} className={inputClass}><option value="LOAD">Load package</option><option value="UNLOAD">Unload package</option></select></Field>
          <Field label="Package tracking number"><input aria-label="Container package tracking number" required value={containerForm.trackingNumber} onChange={event => setContainerForm(current => ({ ...current, trackingNumber: event.target.value }))} className={inputClass}/></Field>
          <div className="flex items-end"><SubmitButton busy={busy}>Apply container action</SubmitButton></div>
        </form>
      </Card>

      <Card title="Trailer freight" description="Load or unload either a container or a loose package." icon={Truck}>
        <form onSubmit={submitTrailer} className="grid gap-4 sm:grid-cols-2">
          <Field label="Trailer aggregate ID"><input aria-label="Trailer aggregate ID" required value={trailerForm.trailerId} onChange={event => setTrailerForm(current => ({ ...current, trailerId: event.target.value }))} className={inputClass}/></Field>
          <Field label="Action"><select aria-label="Trailer action" value={trailerForm.action} onChange={event => setTrailerForm(current => ({ ...current, action: event.target.value as 'LOAD' | 'UNLOAD' }))} className={inputClass}><option value="LOAD">Load</option><option value="UNLOAD">Unload</option></select></Field>
          <Field label="Freight type"><select aria-label="Trailer freight type" value={trailerForm.contentType} onChange={event => setTrailerForm(current => ({ ...current, contentType: event.target.value as 'CONTAINER' | 'PACKAGE' }))} className={inputClass}><option value="CONTAINER">Container</option><option value="PACKAGE">Loose package</option></select></Field>
          <Field label={trailerForm.contentType === 'CONTAINER' ? 'Container barcode' : 'Package tracking number'}><input aria-label="Trailer freight identifier" required value={trailerForm.identifier} onChange={event => setTrailerForm(current => ({ ...current, identifier: event.target.value }))} className={inputClass}/></Field>
          <div className="sm:col-span-2"><SubmitButton busy={busy}>Apply trailer action</SubmitButton></div>
        </form>
      </Card>

      <Card title="Trip execution" description="Start, progress stops, complete, or cancel an existing trip." icon={Route}>
        <form onSubmit={submitTrip} className="grid gap-4 sm:grid-cols-2">
          <Field label="Trip ID"><input aria-label="Trip ID" required value={tripForm.tripId} onChange={event => setTripForm(current => ({ ...current, tripId: event.target.value }))} className={inputClass}/></Field>
          <Field label="Action"><select aria-label="Trip action" value={tripForm.action} onChange={event => setTripForm(current => ({ ...current, action: event.target.value as typeof tripForm.action }))} className={inputClass}><option value="START">Start</option><option value="ARRIVE">Arrive at stop</option><option value="DEPART">Depart stop</option><option value="COMPLETE">Complete</option><option value="CANCEL">Cancel</option></select></Field>
          {tripNeedsStop && <><Field label="Stop ID"><input aria-label="Trip stop ID" required value={tripForm.stopId} onChange={event => setTripForm(current => ({ ...current, stopId: event.target.value }))} className={inputClass}/></Field><Field label="Notes (optional)"><input aria-label="Trip stop notes" maxLength={500} value={tripForm.notes} onChange={event => setTripForm(current => ({ ...current, notes: event.target.value }))} className={inputClass}/></Field></>}
          <div className="sm:col-span-2"><SubmitButton busy={busy}>Apply trip action</SubmitButton></div>
        </form>
      </Card>

      <Card title="Fleet assignment" description="Assign a truck, driver, and trailer to a trip or release an active assignment." icon={Truck}>
        <form onSubmit={submitFleet} className="grid gap-4 sm:grid-cols-2">
          <Field label="Action"><select aria-label="Fleet action" value={fleetForm.action} onChange={event => setFleetForm(current => ({ ...current, action: event.target.value as 'ASSIGN' | 'RELEASE' }))} className={inputClass}><option value="ASSIGN">Assign equipment</option><option value="RELEASE">Release assignment</option></select></Field>
          {fleetForm.action === 'RELEASE' ? <Field label="Assignment ID"><input aria-label="Assignment ID" required value={fleetForm.assignmentId} onChange={event => setFleetForm(current => ({ ...current, assignmentId: event.target.value }))} className={inputClass}/></Field> : <>
            <Field label="Trip ID"><input aria-label="Fleet trip ID" required value={fleetForm.tripId} onChange={event => setFleetForm(current => ({ ...current, tripId: event.target.value }))} className={inputClass}/></Field>
            <Field label="Truck ID"><input aria-label="Fleet truck ID" required value={fleetForm.truckId} onChange={event => setFleetForm(current => ({ ...current, truckId: event.target.value }))} className={inputClass}/></Field>
            <Field label="Driver ID"><input aria-label="Fleet driver ID" required value={fleetForm.driverId} onChange={event => setFleetForm(current => ({ ...current, driverId: event.target.value }))} className={inputClass}/></Field>
            <Field label="Trailer ID"><input aria-label="Fleet trailer ID" required value={fleetForm.trailerId} onChange={event => setFleetForm(current => ({ ...current, trailerId: event.target.value }))} className={inputClass}/></Field>
          </>}
          <div className="sm:col-span-2"><SubmitButton busy={busy}>Apply fleet action</SubmitButton></div>
        </form>
      </Card>

      <Card title="Terminal transfer" description="Transfer terminal ownership and emit linked source and destination events." icon={Send}>
        <form onSubmit={submitTransfer} className="grid gap-4 sm:grid-cols-2">
          <TerminalSelect label="Origin terminal" value={transferForm.originTerminalId} onChange={value => setTransferForm(current => ({ ...current, originTerminalId: value }))} terminals={terminals}/>
          <TerminalSelect label="Destination terminal" value={transferForm.destinationTerminalId} onChange={value => setTransferForm(current => ({ ...current, destinationTerminalId: value }))} terminals={terminals}/>
          <Field label="Asset type"><select aria-label="Transfer asset type" value={transferForm.assetType} onChange={event => setTransferForm(current => ({ ...current, assetType: event.target.value as TerminalAssetType }))} className={inputClass}><option value="PACKAGE">Package</option><option value="CONTAINER">Container</option><option value="TRAILER">Trailer</option></select></Field>
          <Field label="Asset identifier"><input aria-label="Transfer asset identifier" required value={transferForm.assetIdentifier} onChange={event => setTransferForm(current => ({ ...current, assetIdentifier: event.target.value }))} className={inputClass}/></Field>
          <Field label="Employee ID (optional)"><input aria-label="Transfer employee ID" type="number" min="1" value={transferForm.employeeId} onChange={event => setTransferForm(current => ({ ...current, employeeId: event.target.value }))} className={inputClass}/></Field>
          <div className="flex items-end"><SubmitButton busy={busy}>Transfer asset</SubmitButton></div>
        </form>
      </Card>

      <Card title="Create shipment" description="Create a shipment and assign its initial package set transactionally." icon={PackageCheck}>
        <form onSubmit={submitShipmentCreate} className="grid gap-4 sm:grid-cols-2">
          <Field label="Shipment number"><input aria-label="New shipment number" required value={shipmentCreate.shipmentNumber} onChange={event => setShipmentCreate(current => ({ ...current, shipmentNumber: event.target.value }))} className={inputClass}/></Field>
          <Field label="Reference number (optional)"><input aria-label="New shipment reference" value={shipmentCreate.referenceNumber} onChange={event => setShipmentCreate(current => ({ ...current, referenceNumber: event.target.value }))} className={inputClass}/></Field>
          <TerminalSelect label="Shipment origin" value={shipmentCreate.originTerminalId} onChange={value => setShipmentCreate(current => ({ ...current, originTerminalId: value }))} terminals={terminals}/>
          <TerminalSelect label="Shipment destination" value={shipmentCreate.destinationTerminalId} onChange={value => setShipmentCreate(current => ({ ...current, destinationTerminalId: value }))} terminals={terminals}/>
          <Field label="Notification email (optional)"><input aria-label="Shipment notification email" type="email" value={shipmentCreate.notificationRecipient} onChange={event => setShipmentCreate(current => ({ ...current, notificationRecipient: event.target.value }))} className={inputClass}/></Field>
          <Field label="Package numbers (comma or space separated)"><textarea aria-label="Shipment package numbers" required rows={3} value={shipmentCreate.packageTrackingNumbers} onChange={event => setShipmentCreate(current => ({ ...current, packageTrackingNumbers: event.target.value }))} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"/></Field>
          <div className="sm:col-span-2"><SubmitButton busy={busy}>Create shipment</SubmitButton></div>
        </form>
      </Card>

      <Card title="Update shipment" description="Update its reference, package assignments, or terminal lifecycle state." icon={PackageCheck}>
        <form onSubmit={submitShipmentAction} className="grid gap-4 sm:grid-cols-2">
          <Field label="Shipment ID"><input aria-label="Shipment ID" required value={shipmentAction.shipmentId} onChange={event => setShipmentAction(current => ({ ...current, shipmentId: event.target.value }))} className={inputClass}/></Field>
          <Field label="Action"><select aria-label="Shipment action" value={shipmentAction.action} onChange={event => setShipmentAction(current => ({ ...current, action: event.target.value as typeof shipmentAction.action }))} className={inputClass}><option value="UPDATE_REFERENCE">Update reference</option><option value="ASSIGN_PACKAGE">Assign package</option><option value="REMOVE_PACKAGE">Remove package</option><option value="COMPLETE">Complete</option><option value="CANCEL">Cancel</option></select></Field>
          {shipmentNeedsValue && <Field label={shipmentAction.action === 'UPDATE_REFERENCE' ? 'Reference number' : 'Package tracking number'}><input aria-label="Shipment action value" required value={shipmentAction.value} onChange={event => setShipmentAction(current => ({ ...current, value: event.target.value }))} className={inputClass}/></Field>}
          <div className="flex items-end"><SubmitButton busy={busy}>Apply shipment action</SubmitButton></div>
        </form>
      </Card>

      <Card title="Projection recovery" description="Retry durable package projections or rebuild disposable package, container, and trailer snapshots." icon={RefreshCw}>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/><p>Use recovery actions after diagnosing projection lag. Snapshot rebuild runs as one database transaction.</p></div></div>
        <div className="flex flex-wrap gap-3">
          <button disabled={busy} className={buttonClass} onClick={() => void perform('Retry projections', packageApi.retryProjections, result => `Projection retry processed ${(result as { processed: number }).processed} item(s).`)}>Retry pending projections</button>
          <button disabled={busy} className={buttonClass} onClick={() => {
            if (window.confirm('Rebuild all package, container, and trailer snapshots now?')) {
              void perform('Rebuild snapshots', recoveryApi.rebuildSnapshots, result => {
                const counts = result as Awaited<ReturnType<typeof recoveryApi.rebuildSnapshots>>;
                return `Rebuilt ${counts.packages} package, ${counts.containers} container, and ${counts.trailers} trailer snapshot(s).`;
              });
            }
          }}>Rebuild snapshots</button>
        </div>
      </Card>
    </div>
  </div>;
}
