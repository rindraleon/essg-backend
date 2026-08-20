import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiMessage } from '../common/decorators/api-message.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiMessage('Statistiques récupérées')
  getStats() {
    return this.dashboardService.getStats();
  }

  @Get('recent-activities')
  @UseGuards(JwtAuthGuard)
  @ApiMessage('Activités récentes récupérées')
  getRecentActivities() {
    return this.dashboardService.getRecentActivities();
  }

  @Get('overview')
  @UseGuards(JwtAuthGuard)
  @ApiMessage('Aperçu récupéré')
  getOverview() {
    return this.dashboardService.getOverview();
  }

  @Get('public/stats')
  @ApiMessage('Statistiques récupérées')
  getPublicStats() {
    return this.dashboardService.getStats();
  }

  @Get('public/recent-activities')
  @ApiMessage('Activités récentes récupérées')
  getPublicRecentActivities() {
    return this.dashboardService.getRecentActivities();
  }
}
