import type { ContainerSnapshotDto } from './container.types.js';
import type { PackageSnapshotDto } from './package.types.js';
import type { TrailerSnapshotDto } from './trailer.types.js';
export type SearchResultDto = { type: 'PACKAGE'; data: PackageSnapshotDto } | { type: 'CONTAINER'; data: ContainerSnapshotDto } | { type: 'TRAILER'; data: TrailerSnapshotDto };
