import { Controller, Post } from '@nestjs/common';

import { SnapshotRebuildService } from '../services/snapshot-rebuild.service';

@Controller('snapshots')
export class SnapshotRebuildController {
  constructor(private readonly snapshots: SnapshotRebuildService) {}

  @Post('rebuild')
  rebuildAll() {
    return this.snapshots.rebuildAll();
  }
}
