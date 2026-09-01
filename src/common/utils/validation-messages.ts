import { BadRequestException, ValidationError } from '@nestjs/common';

const FIELD_LABELS: Record<string, string> = {
  q: 'recherche',
  page: 'page',
  limit: 'limite',
  sortBy: 'tri',
  sortOrder: 'ordre de tri',
  email: 'email',
  password: 'mot de passe',
  motDePasse: 'mot de passe',
  nom: 'nom',
  prenom: 'prénom',
  titre: 'titre',
  slug: 'slug',
  description: 'description',
  message: 'message',
  sujet: 'sujet',
  telephone: 'téléphone',
  image: 'image',
  file: 'fichier',
};

function fieldLabel(property: string): string {
  const last = property.split('.').pop() ?? property;
  return FIELD_LABELS[last] ?? last;
}

function translateConstraint(property: string, message: string): string {
  const label = fieldLabel(property);

  if (message.includes('should not exist')) {
    return `Le champ « ${label} » n'est pas autorisé.`;
  }
  if (message.includes('must be a string')) {
    return `Le champ « ${label} » doit être une chaîne de caractères.`;
  }
  if (message.includes('must be an integer number') || message.includes('must be an integer')) {
    return `Le champ « ${label} » doit être un nombre entier.`;
  }
  if (message.includes('must be a number')) {
    return `Le champ « ${label} » doit être un nombre.`;
  }
  if (message.includes('must be a boolean')) {
    return `Le champ « ${label} » doit être vrai ou faux.`;
  }
  if (message.includes('must be an email')) {
    return `Le champ « ${label} » doit être une adresse email valide.`;
  }
  if (message.includes('must be an array')) {
    return `Le champ « ${label} » doit être une liste.`;
  }
  if (message.includes('should not be empty')) {
    return `Le champ « ${label} » est obligatoire.`;
  }
  if (message.includes('must be one of the following values')) {
    const values = message.split('values: ')[1] ?? '';
    return `Le champ « ${label} » doit être l'une des valeurs suivantes : ${values}.`;
  }
  if (message.includes('must be longer than or equal to')) {
    const match = /equal to (\d+)/.exec(message);
    return `Le champ « ${label} » doit contenir au moins ${match?.[1] ?? ''} caractères.`;
  }
  if (message.includes('must be shorter than or equal to')) {
    const match = /equal to (\d+)/.exec(message);
    return `Le champ « ${label} » ne peut pas dépasser ${match?.[1] ?? ''} caractères.`;
  }
  if (message.includes('must not be greater than')) {
    const match = /greater than (\d+)/.exec(message);
    return `Le champ « ${label} » ne peut pas dépasser ${match?.[1] ?? ''}.`;
  }
  if (message.includes('must not be less than')) {
    const match = /less than (\d+)/.exec(message);
    return `Le champ « ${label} » doit être supérieur ou égal à ${match?.[1] ?? ''}.`;
  }
  if (message.includes('must be a valid ISO 8601 date')) {
    return `Le champ « ${label} » doit être une date valide.`;
  }

  return message;
}

export function flattenValidationMessages(errors: ValidationError[], parent?: string): string[] {
  const messages: string[] = [];

  for (const error of errors) {
    const property = parent ? `${parent}.${error.property}` : error.property;
    if (error.constraints) {
      for (const message of Object.values(error.constraints)) {
        messages.push(translateConstraint(property, message));
      }
    }
    if (error.children?.length) {
      messages.push(...flattenValidationMessages(error.children, property));
    }
  }

  return messages;
}

export function createValidationException(errors: ValidationError[]): BadRequestException {
  const messages = flattenValidationMessages(errors);
  return new BadRequestException(
    messages.length > 0 ? messages.join(' ') : 'Les données envoyées sont invalides.',
  );
}
