import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiMessage } from '../common/decorators/api-message.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../users/users.constants';
import { DashboardService, limitDashboardStats } from './dashboard.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiStandardErrors, ApiStandardResponse } from '../common/swagger/api-response.decorator';
import {
  API_BEARER_AUTH_NAME,
  SWAGGER_OPERATION_SUCCESS,
} from '../common/swagger/swagger.constants';

@ApiTags('Tableau de bord')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.DASHBOARD_VIEW)
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Statistiques du Back-Office',
    description: 'Compteurs consolidés (formations, projets, actualités, candidatures…).',
  })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: true })
  @ApiMessage('Statistiques récupérées')
  async getStats(@CurrentUser() user: AuthUser) {
    return limitDashboardStats(await this.dashboardService.getStats(), user.role);
  }

  @Get('recent-activities')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.DASHBOARD_VIEW)
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Activités récentes',
    description: 'Dernières actions et derniers contenus créés.',
  })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: true })
  @ApiMessage('Activités récentes récupérées')
  getRecentActivities() {
    return this.dashboardService.getRecentActivities();
  }

  @Get('overview')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.DASHBOARD_VIEW)
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: "Vue d'ensemble",
    description: 'Agrégat statistiques + activités récentes en un appel.',
  })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: true })
  @ApiMessage('Aperçu récupéré')
  async getOverview(@CurrentUser() user: AuthUser) {
    const overview = await this.dashboardService.getOverview();
    return { ...overview, stats: limitDashboardStats(overview.stats, user.role) };
  }

  @Get('public/stats')
  @ApiOperation({
    summary: 'Statistiques publiques',
    description: 'Mêmes compteurs, exposés sans authentification pour le site vitrine.',
  })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
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
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: false })
  @ApiMessage('Activités récentes récupérées')
  getPublicRecentActivities() {
    return this.dashboardService.getRecentActivities();
  }
}
