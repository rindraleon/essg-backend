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
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateMessageDto, UpdateMessageDto } from './dto/create-message.dto';
import { QueryMessageDto } from './dto/query-message.dto';
import { ReplyMessageDto } from './dto/reply-message.dto';
import { MessagesService } from './messages.service';

@Controller('messages')
export class MessagesController {
  constructor(private readonly service: MessagesService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiMessage('Messages récupérés')
  findAll(@Query() query: QueryMessageDto) {
    if (query.q?.trim()) {
      return this.service.search(query.q, query);
    }
    return this.service.findAll(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('search')
  @ApiMessage('Recherche effectuée')
  search(@Query() query: QueryMessageDto) {
    return this.service.search(query.q ?? '', query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiMessage('Message récupéré')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiMessage('Message créé avec succès')
  create(@Body() dto: CreateMessageDto) {
    return this.service.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/reply')
  @ApiMessage('Réponse envoyée')
  reply(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReplyMessageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.reply(id, dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiMessage('Message mis à jour')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMessageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiMessage('Message supprimé')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
