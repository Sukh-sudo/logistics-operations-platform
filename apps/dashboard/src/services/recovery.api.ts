import { apiClient } from './apiClient';

export interface SnapshotRebuildResult {
  packages: number;
  containers: number;
  trailers: number;
}

export const recoveryApi = {
  // The backend rebuilds all disposable read models in a single transaction.
  rebuildSnapshots: async () => (await apiClient.post<SnapshotRebuildResult>('/snapshots/rebuild')).data,
};
