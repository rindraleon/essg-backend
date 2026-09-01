import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiMessage } from '../common/decorators/api-message.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiStandardErrors, ApiStandardResponse } from '../common/swagger/api-response.decorator';

@ApiTags('Tableau de bord')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Statistiques du Back-Office',
    description: 'Compteurs consolidés (formations, projets, actualités, candidatures…).',
  })
  @ApiStandardResponse(undefined, { description: 'Opération effectuée avec succès' })
  @ApiStandardErrors({ auth: true })
  @ApiMessage('Statistiques récupérées')
  getStats() {
    return this.dashboardService.getStats();
  }

  @Get('recent-activities')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Activités récentes',
    description: 'Dernières actions et derniers contenus créés.',
  })
  @ApiStandardResponse(undefined, { description: 'Opération effectuée avec succès' })
  @ApiStandardErrors({ auth: true })
  @ApiMessage('Activités récentes récupérées')
  getRecentActivities() {
    return this.dashboardService.getRecentActivities();
  }

  @Get('overview')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: "Vue d'ensemble",
    description: 'Agrégat statistiques + activités récentes en un appel.',
  })
  @ApiStandardResponse(undefined, { description: 'Opération effectuée avec succès' })
  @ApiStandardErrors({ auth: true })
  @ApiMessage('Aperçu récupéré')
  getOverview() {
    return this.dashboardService.getOverview();
  }

  @Get('public/stats')
  @ApiOperation({
    summary: 'Statistiques publiques',
    description: 'Mêmes compteurs, exposés sans authentification pour le site vitrine.',
  })
  @ApiStandardResponse(undefined, { description: 'Opération effectuée avec succès' })
  @ApiStandardErrors({ auth: false })
  @ApiMessage('Statistiques récupérées')
  getPublicStats() {
    return this.dashboardService.getStats();
  }

  @Get('public/recent-activities')
  @ApiOperation({
    summary: 'Activités récentes publiques',
    description: "Version publique du flux d'activités.",
  })
  @ApiStandardResponse(undefined, { description: 'Opération effectuée avec succès' })
  @ApiStandardErrors({ auth: false })
  @ApiMessage('Activités récentes récupérées')
  getPublicRecentActivities() {
    return this.dashboardService.getRecentActivities();
  }
}
