export interface AssetLaneFilters<S extends string> {
  fromDate: string;
  toDate: string;
  originTerminalId: string;
  destinationTerminalId: string;
  status: S | '';
}

export interface AssetLaneQuery<S extends string> {
  fromDate?: string;
  toDate?: string;
  originTerminalId?: number;
  destinationTerminalId?: number;
  status?: S;
}

export const emptyAssetLaneFilters = <S extends string>(): AssetLaneFilters<S> => ({
  fromDate: '',
  toDate: '',
  originTerminalId: '',
  destinationTerminalId: '',
  status: '',
});

export const toAssetLaneQuery = <S extends string>(filters: AssetLaneFilters<S>): AssetLaneQuery<S> => ({
  ...(filters.fromDate && { fromDate: filters.fromDate }),
  ...(filters.toDate && { toDate: filters.toDate }),
  ...(filters.originTerminalId && { originTerminalId: Number(filters.originTerminalId) }),
  ...(filters.destinationTerminalId && { destinationTerminalId: Number(filters.destinationTerminalId) }),
  ...(filters.status && { status: filters.status }),
});
