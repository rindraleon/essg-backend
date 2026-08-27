import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiMessage } from '../common/decorators/api-message.decorator';
import { API_SIGNATURE } from '../common/constants/api.constants';
import { ApiStandardResponse } from '../common/swagger/api-response.decorator';
import { HealthService } from './health.service';

@ApiTags('Santé & supervision')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'État de santé complet du backend',
    description: [
      'Vérifie en une requête les dépendances critiques du projet :',
      '',
      '| Composant | Sonde | Impact si `down` |',
      '| --- | --- | --- |',
      '| `database` | `SELECT 1` sur PostgreSQL | API inutilisable (503 sur `/health/ready`) |',
      '| `storage` | `bucketExists` sur MinIO | Uploads d’images impossibles |',
      '| `memory` | Ratio heap utilisé / heap total | Risque de saturation du process |',
      '',
      'États globaux : `ok` (tout est vert), `degraded` (une dépendance est tombée),',
      '`down` (base **et** stockage indisponibles).',
      '',
      'Réponse signée **ITDCMADA** (corps JSON + en-tête `X-Api-Signature`).',
    ].join('\n'),
  })
  @ApiStandardResponse(undefined, {
    description: 'Rapport de santé détaillé — toujours renvoyé en 200 pour la supervision',
  })
  @ApiMessage('État de santé du service')
  check() {
    return this.healthService.check();
  }

  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sonde de vivacité (liveness)',
    description:
      'Répond immédiatement si le process Node est vivant. À utiliser pour le redémarrage automatique (Docker/Kubernetes).',
  })
  @ApiStandardResponse(undefined, { description: 'Le process répond' })
  @ApiMessage('Service vivant')
  live() {
    return {
      status: 'ok',
      signature: API_SIGNATURE,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Sonde de disponibilité (readiness)',
    description:
      'Renvoie 200 si l’application peut servir du trafic, 503 si la base de données est injoignable.',
  })
  @ApiStandardResponse(undefined, { description: 'Application prête' })
  @ApiMessage('Service prêt')
  async ready() {
    const report = await this.healthService.check();
    if (report.checks.database.status === 'down') {
      throw new ServiceUnavailableException(
        `Service indisponible : ${report.checks.database.details ?? 'base de données injoignable'}`,
      );
    }
    return report;
  }
}
