import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {

  @Get()
  getHealth() {

    // Basic application health response
    return {
    "status": "ok",
    "database": "connected",
    "kafka": "unavailable",
    "uptime": 4521,
    "timestamp": "..."
    };
  }
}