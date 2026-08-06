export interface FleetFilters {
  terminalId: string;
  status: string;
}

export interface FleetListQuery<S extends string> {
  terminalId?: number;
  status?: S;
}

export const emptyFleetFilters: FleetFilters = { terminalId: '', status: '' };

export const toFleetListQuery = <S extends string>(filters: FleetFilters, statuses: readonly S[]): FleetListQuery<S> => ({
  ...(filters.terminalId && { terminalId: Number(filters.terminalId) }),
  ...(statuses.includes(filters.status as S) && { status: filters.status as S }),
});
