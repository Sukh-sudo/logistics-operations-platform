import { Module } from '@nestjs/common';

import { SnapshotRebuildController } from './controllers/snapshot-rebuild.controller';
import { SnapshotRebuildService } from './services/snapshot-rebuild.service';

@Module({
  controllers: [SnapshotRebuildController],
  providers: [SnapshotRebuildService],
  exports: [SnapshotRebuildService],
})
export class SnapshotModule {}
