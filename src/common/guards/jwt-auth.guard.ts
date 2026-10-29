import {
  Injectable,
  ExecutionContext,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const JwtGuard = AuthGuard('jwt');

@Injectable()
export class JwtAuthGuard extends JwtGuard {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.get<boolean>(
      IS_PUBLIC_KEY,
      context.getHandler(),
    );
    if (isPublic) {
      return true;
    }
    return (await super.canActivate(context)) as boolean;
  }
}
