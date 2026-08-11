import { Controller, Post } from '@nestjs/common';

import { SnapshotRebuildService } from '../services/snapshot-rebuild.service';
import { PERMISSIONS } from '../../authorization/constants/permissions';
import { Permissions } from '../../authorization/decorators/permissions.decorator';

@Controller('snapshots')
@Permissions(PERMISSIONS.SYSTEM_ADMIN)
export class SnapshotRebuildController {
  constructor(private readonly snapshots: SnapshotRebuildService) {}

  @Post('rebuild')
  rebuildAll() {
    return this.snapshots.rebuildAll();
  }
}
