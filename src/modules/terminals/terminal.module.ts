import { Module } from '@nestjs/common';
import { TerminalController } from './controllers/terminal.controller';
import { TerminalService } from './services/terminal.service';

@Module({
  controllers: [TerminalController],
  providers: [TerminalService],
  exports: [TerminalService],
})
export class TerminalModule {}
