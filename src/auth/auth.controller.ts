import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiMessage } from '../common/decorators/api-message.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

interface AuthUser {
  userId: number;
  email: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiMessage('Connexion réussie')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify')
  @ApiMessage('Session valide')
  verify(@Request() req: { user: AuthUser }) {
    return { valid: true, user: req.user };
  }

  @UseGuards(JwtAuthGuard)
  @Post('me')
  @ApiMessage('Profil récupéré')
  me(@Request() req: { user: AuthUser }) {
    return req.user;
  }
}
