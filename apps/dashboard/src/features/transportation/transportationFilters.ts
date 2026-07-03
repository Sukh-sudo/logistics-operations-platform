import type { Route, Shipment, Terminal, Trip } from '../../services/transportation.api';

export interface TransportationFilters { date: string; originId: string; destinationId: string }
export const emptyTransportationFilters: TransportationFilters = { date: '', originId: '', destinationId: '' };
const onDate = (value: string, selected: string) => !selected || value.slice(0, 10) === selected;
const terminalMatches = (actual: number, selected: string) => !selected || actual === Number(selected);

export const filterTerminals = (items: Terminal[], filters: TransportationFilters) => items.filter(item => onDate(item.createdAt, filters.date));
export const filterRoutes = (items: Route[], filters: TransportationFilters) => items.filter(item => onDate(item.createdAt, filters.date) && terminalMatches(item.originTerminalId, filters.originId) && terminalMatches(item.destinationTerminalId, filters.destinationId));
export const filterTrips = (items: Trip[], filters: TransportationFilters) => items.filter(item => onDate(item.plannedDeparture, filters.date) && terminalMatches(item.route.originTerminalId, filters.originId) && terminalMatches(item.route.destinationTerminalId, filters.destinationId));
export const filterShipments = (items: Shipment[], filters: TransportationFilters) => items.filter(item => onDate(item.createdAt, filters.date) && terminalMatches(item.originTerminalId, filters.originId) && terminalMatches(item.destinationTerminalId, filters.destinationId));
