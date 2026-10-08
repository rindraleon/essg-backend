import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiMessage } from '../common/decorators/api-message.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  API_BEARER_AUTH_NAME,
  SWAGGER_OPERATION_SUCCESS,
} from '../common/swagger/swagger.constants';
import {
  ApiPaginatedResponse,
  ApiStandardErrors,
  ApiStandardResponse,
} from '../common/swagger/api-response.decorator';
import { CreateParcoursDto, UpdateParcoursDto } from './dto/create-parcours.dto';
import { QueryParcoursDto } from './dto/query-mention.dto';
import { ParcoursService } from './parcours.service';

@ApiTags('Parcours')
@Controller('parcours')
export class ParcoursController {
  constructor(private readonly service: ParcoursService) {}

  @Get()
  @ApiOperation({
    summary: 'Lister les parcours',
    description:
      'Catalogue paginé des parcours. Filtre `mentionId` pour n’obtenir que les parcours d’une mention.',
  })
  @ApiPaginatedResponse(undefined, 'Liste paginée des parcours')
  @ApiStandardErrors({ auth: false })
  @ApiMessage('Parcours récupérés')
  findAll(@Query() query: QueryParcoursDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consulter un parcours',
    description: 'Détail d’un parcours avec sa mention et son nombre de formations.',
  })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: false, notFound: true })
  @ApiMessage('Parcours récupéré')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Créer un parcours rattaché à une mention',
    description:
      'Le parcours est obligatoirement rattaché à une mention existante et unique dans cette mention.',
  })
  @ApiStandardResponse(undefined, { status: 201, description: 'Ressource créée' })
  @ApiStandardErrors({ auth: true, conflict: true })
  @ApiMessage('Parcours créé avec succès')
  create(@Body() dto: CreateParcoursDto) {
    return this.service.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Mettre à jour un parcours',
    description:
      'Renommage (slug régénéré) ou changement de mention. Le changement de mention est refusé si des formations utilisent le parcours.',
  })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: true, notFound: true, conflict: true })
  @ApiMessage('Parcours mis à jour avec succès')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateParcoursDto) {
    return this.service.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth(API_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Supprimer un parcours',
    description:
      'Suppression bloquée si des formations utilisent ce parcours (message explicite avec le nombre).',
  })
  @ApiStandardResponse(undefined, { description: SWAGGER_OPERATION_SUCCESS })
  @ApiStandardErrors({ auth: true, notFound: true })
  @ApiMessage('Parcours supprimé')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
