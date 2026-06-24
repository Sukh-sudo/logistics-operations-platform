import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { RequestWithId } from '../../../common/middleware/request-id.middleware';
import { CreateTerminalDto } from '../dto/create-terminal.dto';
import {
  ReceiveTerminalAssetDto,
  TransferTerminalAssetDto,
} from '../dto/terminal-asset.dto';
import { UpdateTerminalDto } from '../dto/update-terminal.dto';
import { TerminalService } from '../services/terminal.service';

@Controller('terminals')
export class TerminalController {
  constructor(private readonly terminalService: TerminalService) {}

  @Post()
  create(
    @Body() dto: CreateTerminalDto,
    @Req() request: RequestWithId,
  ) {
    return this.terminalService.createTerminal(dto, request.requestId);
  }

  @Get()
  findAll() {
    return this.terminalService.getTerminals();
  }

  @Get(':id/inventory')
  getInventory(@Param('id', ParseIntPipe) id: number) {
    return this.terminalService.getInventory(id);
  }

  @Get(':id/warehouse')
  getWarehouse(@Param('id', ParseIntPipe) id: number) {
    return this.terminalService.getWarehouse(id);
  }

  @Get(':id/yard')
  getYard(@Param('id', ParseIntPipe) id: number) {
    return this.terminalService.getYard(id);
  }

  @Get(':id/operations')
  getOperations(@Param('id', ParseIntPipe) id: number) {
    return this.terminalService.getOperations(id);
  }

  @Get(':id/history')
  getHistory(@Param('id', ParseIntPipe) id: number) {
    return this.terminalService.getHistory(id);
  }

  @Post(':id/assets')
  receiveAsset(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReceiveTerminalAssetDto,
    @Req() request: RequestWithId,
  ) {
    return this.terminalService.receiveAsset(id, dto, request.requestId);
  }

  @Post(':id/transfer')
  transferAsset(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TransferTerminalAssetDto,
    @Req() request: RequestWithId,
  ) {
    return this.terminalService.transferAsset(id, dto, request.requestId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTerminalDto,
    @Req() request: RequestWithId,
  ) {
    return this.terminalService.updateTerminal(id, dto, request.requestId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.terminalService.getTerminal(id);
  }
}
