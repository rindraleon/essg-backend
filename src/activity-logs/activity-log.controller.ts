import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiMessage } from '../common/decorators/api-message.decorator';

import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ActivityLogService } from './activity-log.service';
import { QueryActivityLogDto } from './dto/query-activity-log.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiPaginatedResponse,
  ApiStandardErrors,
  ApiStandardResponse,
} from '../common/swagger/api-response.decorator';
import {
  API_BEARER_AUTH_NAME,
  SWAGGER_OPERATION_SUCCESS,
} from '../common/swagger/swagger.constants';

@ApiTags('Journal d’activité')
@ApiBearerAuth(API_BEARER_AUTH_NAME)
@Controller('activity-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get()
  @ApiOperation({
    summary: 'Lister les actions journalisées',
    description:
      'Historique des actions du Back-Office (création, modification, suppression). Réservé au rôle `admin`.',
  })
  @ApiPaginatedResponse(undefined, 'Liste paginée signée ITDCMADA')
  @ApiStandardErrors({ auth: true })
  @ApiMessage('Historique des actions récupéré')
  findAll(@Query() query: QueryActivityLogDto) {
    return this.activityLogService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consulter une action journalisée',
    description: "Détail d'une entrée du journal.",
  })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: true, notFound: true })
  @ApiMessage('Action récupérée')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.activityLogService.findOne(id);
  }
}
