import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateMentionDto } from './create-mention.dto';
import { UpdateMentionDto } from './update-mention.dto';
import { CreateParcoursDto } from './create-parcours.dto';

/** Reproduit le pipe global de l'application (whitelist + trim + messages FR). */
const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
  forbidNonWhitelisted: true,
});

async function validateWith<T extends object>(
  cls: new () => T,
  payload: unknown,
): Promise<{ ok: true; value: T } | { ok: false; messages: string }> {
  try {
    const value = (await pipe.transform(
      payload,
      { type: 'body', metatype: cls } as never,
      undefined as never,
    )) as T;
    return { ok: true, value };
  } catch (error) {
    if (error instanceof BadRequestException) {
      const response = error.getResponse() as { message?: string[] | string };
      const message = Array.isArray(response.message)
        ? response.message.join(' ')
        : (response.message ?? '');
      return { ok: false, messages: message };
    }
    throw error;
  }
}

const VALID = {
  nom: 'Géomatique et applications',
  parcours: [{ nom: 'Géomatique et Géologie Économique' }],
};

describe('CreateMentionDto — validation', () => {
  it('accepte une mention valide avec un parcours', async () => {
    const result = await validateWith(CreateMentionDto, VALID);
    expect(result.ok).toBe(true);
  });

  it('refuse une mention sans parcours', async () => {
    const result = await validateWith(CreateMentionDto, { nom: 'Géomatique et applications' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.messages).toMatch(/parcours/);
  });

  it('refuse un tableau de parcours vide', async () => {
    const result = await validateWith(CreateMentionDto, {
      nom: 'Géomatique et applications',
      parcours: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.messages).toMatch(/au moins un parcours/);
  });

  it('refuse un nom de mention vide ou en espaces uniquement', async () => {
    const blank = await validateWith(CreateMentionDto, { nom: '   ', parcours: VALID.parcours });
    expect(blank.ok).toBe(false);
    const short = await validateWith(CreateMentionDto, { nom: 'a', parcours: VALID.parcours });
    expect(!short.ok && short.messages).toMatch(/au moins 2 caractères/);
  });

  it('refuse un parcours vide ou en espaces uniquement', async () => {
    const result = await validateWith(CreateMentionDto, {
      nom: 'Géomatique et applications',
      parcours: [{ nom: '   ' }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.messages).toMatch(/au moins 2 caractères/);
  });

  it('trimme automatiquement les espaces superflus', async () => {
    const result = await validateWith(CreateMentionDto, {
      nom: '  Géomatique et applications  ',
      parcours: [{ nom: '  Un parcours  ' }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.nom).toBe('Géomatique et applications');
      expect(result.value.parcours[0]?.nom).toBe('Un parcours');
    }
  });

  it('refuse les champs inconnus — dont un slug saisi manuellement', async () => {
    const result = await validateWith(CreateMentionDto, {
      ...VALID,
      slug: 'slug-saisi-manuellement',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.messages).toMatch(/slug/);
  });
});

describe('UpdateMentionDto — validation', () => {
  it('accepte une modification partielle sans parcours', async () => {
    const result = await validateWith(UpdateMentionDto, { nom: 'Nouveau nom' });
    expect(result.ok).toBe(true);
  });

  it('accepte un parcours existant référencé par id', async () => {
    const result = await validateWith(UpdateMentionDto, { parcours: [{ id: 4, nom: 'Renommé' }] });
    expect(result.ok).toBe(true);
  });

  it('refuse un id de parcours invalide', async () => {
    const result = await validateWith(UpdateMentionDto, { parcours: [{ id: -1, nom: 'Xx' }] });
    expect(result.ok).toBe(false);
  });
});

describe('CreateParcoursDto — validation', () => {
  it('exige une mentionId numérique', async () => {
    const result = await validateWith(CreateParcoursDto, { nom: 'Parcours', mentionId: 'abc' });
    expect(result.ok).toBe(false);
  });

  it('accepte la création isolée avec mention valide', async () => {
    const result = await validateWith(CreateParcoursDto, {
      mentionId: 2,
      nom: 'Géomatique et santé',
    });
    expect(result.ok).toBe(true);
  });

  it('refuse un rattachement à une autre mention via un champ inconnu', async () => {
    const result = await validateWith(CreateParcoursDto, {
      mentionId: 2,
      nom: 'Géomatique et santé',
      mentionNom: 'Autre mention',
    });
    expect(result.ok).toBe(false);
  });
});
