import type { Route, Shipment, Terminal, Trip } from '../../services/transportation.api';

export interface TransportationFilters { fromDate: string; toDate: string; originId: string; destinationId: string }
export const emptyTransportationFilters: TransportationFilters = { fromDate: '', toDate: '', originId: '', destinationId: '' };

// ISO calendar dates sort lexically, allowing inclusive comparisons without
// shifting records across time zones in the operator's browser.
const withinDateRange = (value: string, fromDate: string, toDate: string) => {
  const recordDate = value.slice(0, 10);
  return (!fromDate || recordDate >= fromDate) && (!toDate || recordDate <= toDate);
};
const terminalMatches = (actual: number, selected: string) => !selected || actual === Number(selected);

export const filterTerminals = (items: Terminal[], filters: TransportationFilters) => items.filter(item => withinDateRange(item.createdAt, filters.fromDate, filters.toDate));
export const filterRoutes = (items: Route[], filters: TransportationFilters) => items.filter(item => withinDateRange(item.createdAt, filters.fromDate, filters.toDate) && terminalMatches(item.originTerminalId, filters.originId) && terminalMatches(item.destinationTerminalId, filters.destinationId));
export const filterTrips = (items: Trip[], filters: TransportationFilters) => items.filter(item => withinDateRange(item.plannedDeparture, filters.fromDate, filters.toDate) && terminalMatches(item.route.originTerminalId, filters.originId) && terminalMatches(item.route.destinationTerminalId, filters.destinationId));
export const filterShipments = (items: Shipment[], filters: TransportationFilters) => items.filter(item => withinDateRange(item.createdAt, filters.fromDate, filters.toDate) && terminalMatches(item.originTerminalId, filters.originId) && terminalMatches(item.destinationTerminalId, filters.destinationId));
