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
import { ApiMessage } from '../common/decorators/api-message.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CreateRessourceHumaineDto,
  UpdateRessourceHumaineDto,
} from './dto/create-ressource-humaine.dto';
import { RessourcesHumainesService } from './ressources-humaines.service';

@Controller('ressources-humaines')
export class RessourcesHumainesController {
  constructor(private readonly service: RessourcesHumainesService) {}

  @Get()
  @ApiMessage('Ressources humaines récupérées')
  findAll(@Query() paginationDto: PaginationQueryDto) {
    return this.service.findAll(paginationDto);
  }

  @Get('search')
  @ApiMessage('Recherche effectuée')
  search(@Query('q') query: string, @Query() paginationDto: PaginationQueryDto) {
    return this.service.search(query, paginationDto);
  }

  @Get('slug/:slug')
  @ApiMessage('Ressource humaine récupérée')
  findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @Get(':id')
  @ApiMessage('Ressource humaine récupérée')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiMessage('Ressource humaine créée avec succès')
  create(@Body() dto: CreateRessourceHumaineDto) {
    return this.service.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiMessage('Ressource humaine mise à jour')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRessourceHumaineDto) {
    return this.service.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiMessage('Ressource humaine supprimée')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
