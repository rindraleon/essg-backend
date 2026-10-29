import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import type { NavigationPrincipale } from '../entities/setting.entity';

export const NAVIGATION_PRINCIPALE_CHOIX = ['admission', 'resultats', 'aucun'] as const;

export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  admissionsOuvertes?: boolean;

  @IsOptional()
  @IsIn(NAVIGATION_PRINCIPALE_CHOIX, {
    message: 'La navigation principale doit être « admission », « resultats » ou « aucun ».',
  })
  navigationPrincipale?: NavigationPrincipale;
}
