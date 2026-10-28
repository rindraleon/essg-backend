import { Body, Controller, Get, HttpCode, HttpStatus, Patch, UseGuards } from '@nestjs/common';
import { ApiMessage } from '../common/decorators/api-message.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../users/users.constants';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiStandardErrors, ApiStandardResponse } from '../common/swagger/api-response.decorator';
import {
  API_BEARER_AUTH_NAME,
  SWAGGER_OPERATION_SUCCESS,
} from '../common/swagger/swagger.constants';

@ApiTags('Paramètres')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('public')
  @ApiOperation({
    summary: 'Paramètres publics du site',
    description: 'Coordonnées, réseaux sociaux et contenus exposés au site vitrine.',
  })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: false })
  @ApiMessage('Paramètres publics récupérés')
  getPublic() {
    return this.settingsService.getPublic();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SETTINGS_ADMISSION)
  @Get()
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Paramètres complets',
    description:
      'Paramètres réservés au Back-Office. Accessible avec la permission `settings.admission` (rôles administrateur et scolarité).',
  })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: true })
  @ApiMessage('Paramètres récupérés')
  get() {
    return this.settingsService.get();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SETTINGS_ADMISSION)
  @Patch()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Mettre à jour les paramètres',
    description:
      'Réservé aux comptes disposant de la permission `settings.admission`. Mise à jour partielle (PATCH).',
  })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: true, conflict: true })
  @ApiMessage('Paramètres mis à jour')
  update(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.update(dto);
  }
}
