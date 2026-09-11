import { Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiMessage } from '../../common/decorators/api-message.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import {
  ApiStandardResponse,
  ApiStandardErrors,
} from '../../common/swagger/api-response.decorator';
import { AdmissionDocumentVerificationService } from './services/admission-document-verification.service';
import { API_BEARER_AUTH_NAME } from '../../common/swagger/swagger.constants';

@ApiTags('Admissions - Vérification')
@Controller('admissions/:id/verification')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth(API_BEARER_AUTH_NAME)
export class AdmissionsVerificationController {
  constructor(private readonly verificationService: AdmissionDocumentVerificationService) {}

  @Post()
  @ApiOperation({
    summary: 'Vérifier les pièces d’une candidature',
    description:
      'Lance l’analyse OCR et la comparaison des données saisies avec les documents fournis. Étapes : 1) Identification des documents, 2) Extraction du texte, 3) Analyse OCR, 4) Comparaison des données, 5) Génération du résultat. Seuls les utilisateurs authentifiés du Back Office peuvent lancer la vérification.',
  })
  @ApiParam({ name: 'id', type: Number, example: 12 })
  @ApiStandardResponse(undefined, { description: 'Vérification effectuée' })
  @ApiStandardErrors({ auth: true, notFound: true })
  @ApiMessage('Vérification des pièces effectuée')
  async verify(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    const adminId = user?.userId ?? null;
    const adminEmail = user?.email ?? null;
    return this.verificationService.verify(id, { adminId, adminEmail });
  }

  @Get('history')
  @ApiOperation({ summary: 'Historique des vérifications d’une candidature' })
  @ApiParam({ name: 'id', type: Number })
  @ApiStandardResponse(undefined, { description: 'Historique récupéré' })
  @ApiStandardErrors({ auth: true })
  @ApiMessage('Historique des vérifications récupéré')
  async history(@Param('id', ParseIntPipe) id: number) {
    return this.verificationService.getHistory(id);
  }

  @Get('latest')
  @ApiOperation({ summary: 'Dernière vérification d’une candidature' })
  @ApiParam({ name: 'id', type: Number })
  @ApiStandardResponse(undefined, { description: 'Dernière vérification' })
  @ApiStandardErrors({ auth: true })
  @ApiMessage('Dernière vérification récupérée')
  async latest(@Param('id', ParseIntPipe) id: number) {
    return this.verificationService.getLatest(id);
  }

  @Get(':verificationId')
  @ApiOperation({ summary: 'Détail d’une vérification' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'verificationId', type: Number })
  @ApiStandardResponse(undefined, { description: 'Vérification récupérée' })
  @ApiStandardErrors({ auth: true, notFound: true })
  @ApiMessage('Vérification récupérée')
  async getOne(
    @Param('id', ParseIntPipe) id: number,
    @Param('verificationId', ParseIntPipe) verificationId: number,
  ) {
    return this.verificationService.getOne(id, verificationId);
  }
}
