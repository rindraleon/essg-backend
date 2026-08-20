import { PartialType } from '@nestjs/mapped-types';
import { CreateUtilisateurDto } from './create-user.dto';

export class UpdateUtilisateurDto extends PartialType(CreateUtilisateurDto) {}
