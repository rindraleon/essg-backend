import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

const JwtGuard = AuthGuard('jwt');

@Injectable()
export class JwtAuthGuard extends JwtGuard {}
