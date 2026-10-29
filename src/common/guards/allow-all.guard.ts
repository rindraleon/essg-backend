import { Injectable, ExecutionContext } from '@nestjs/common';

/**
 * Guard qui autorise toute requête. Destiné aux routes publiques
 * (ex: consultation des résultats sans authentification).
 */
@Injectable()
export class AllowAllGuard {
  canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}
