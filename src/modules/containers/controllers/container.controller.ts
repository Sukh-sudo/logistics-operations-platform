import { Body, Controller, Post } from '@nestjs/common';
import { ContainerService } from '../services/container.service';
import { CreateContainerDto } from '../dto/create-container.dto';

@Controller('containers')
export class ContainerController {
  constructor(
    private readonly containerService: ContainerService,
  ) {}

  @Post()
  createContainer(
    @Body() dto: CreateContainerDto,
  ) {
    return this.containerService.createContainer(dto);
  }
}