import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { type Permission, roleHasPermission } from '../../users/users.constants';

interface RequestWithUser {
  user?: {
    role?: string;
  };
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const user = context.switchToHttp().getRequest<RequestWithUser>().user;
    if (!user?.role) {
      throw new ForbiddenException('Accès refusé');
    }

    const granted = required.every((permission) => roleHasPermission(user.role, permission));
    if (!granted) {
      throw new ForbiddenException("Vous n'avez pas les permissions nécessaires");
    }

    return true;
  }
}
