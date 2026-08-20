import { Controller, Get } from '@nestjs/common';
import { ApiMessage } from '../common/decorators/api-message.decorator';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiMessage('Service en ligne')
  check() {
    return this.healthService.check();
  }
}
