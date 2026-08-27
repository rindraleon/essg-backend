import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { ApiMessage } from './common/decorators/api-message.decorator';
import { ApiStandardResponse } from './common/swagger/api-response.decorator';

@ApiTags('Santé & supervision')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Informations sur l’API',
    description:
      'Point d’entrée racine : identité de l’API, éditeur (**ITDCMADA**), version et liens utiles (documentation, sonde de santé).',
  })
  @ApiStandardResponse(undefined, { description: 'Carte d’identité de l’API, signée ITDCMADA' })
  @ApiMessage('API ESSG opérationnelle')
  getHello() {
    return this.appService.getApiInfo();
  }
}
