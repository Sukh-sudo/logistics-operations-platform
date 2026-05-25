import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {

  @Get()
  getHealth() {

    // Basic application health response
    return {
      status: 'ok',
      service: 'logistics-platform',
      timestamp: new Date(),
    };
  }
}