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
import { CreateFormationDto, UpdateFormationDto } from './dto/create-formation.dto';
import { FormationsService } from './formations.service';
import { FORMATION_MENTIONS } from './formation-mentions.constant';

@Controller('formations')
export class FormationsController {
  constructor(private readonly service: FormationsService) {}

  @Get()
  @ApiMessage('Formations récupérées')
  findAll(@Query() paginationDto: PaginationQueryDto) {
    return this.service.findAll(paginationDto);
  }

  @Get('mentions')
  @ApiMessage('Mentions récupérées')
  findMentions() {
    return FORMATION_MENTIONS;
  }

  @Get('search')
  @ApiMessage('Recherche effectuée')
  search(@Query('q') query: string, @Query() paginationDto: PaginationQueryDto) {
    return this.service.search(query, paginationDto);
  }

  @Get('slug/:slug')
  @ApiMessage('Formation récupérée')
  findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @Get(':id')
  @ApiMessage('Formation récupérée')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiMessage('Formation créée avec succès')
  create(@Body() dto: CreateFormationDto) {
    return this.service.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiMessage('Formation mise à jour')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFormationDto) {
    return this.service.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiMessage('Formation supprimée')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
