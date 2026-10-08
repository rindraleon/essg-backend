/**
 * Helpers de mock partagés par les tests unitaires du module mentions.
 * Volontairement séparés pour éviter la duplication entre suites.
 */

export type QbMock = Record<string, jest.Mock>;

/** QueryBuilder TypeORM minimal simulé pour les tests unitaires. */
export function makeQueryBuilder(overrides: Record<string, jest.Mock> = {}): QbMock {
  const qb: QbMock = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(() => Promise.resolve(undefined)),
    getRawMany: jest.fn(() => Promise.resolve([])),
    getMany: jest.fn(() => Promise.resolve([])),
    getManyAndCount: jest.fn(() => Promise.resolve([[], 0])),
    ...overrides,
  };
  return qb;
}

/** Mock de Repository TypeORM : méthodes asynchrones résolues, compteurs jest. */
export function makeRepo(overrides: Record<string, jest.Mock> = {}): Record<string, jest.Mock> {
  return {
    findOne: jest.fn(() => Promise.resolve(null)),
    find: jest.fn(() => Promise.resolve([])),
    findAndCount: jest.fn(() => Promise.resolve([[], 0])),
    create: jest.fn((input: unknown) => ({ ...(input as object) })),
    save: jest.fn((input: unknown) =>
      Promise.resolve(Array.isArray(input) ? input : { id: 1, ...(input as object) }),
    ),
    update: jest.fn(() => Promise.resolve({ affected: 1 })),
    delete: jest.fn(() => Promise.resolve({ affected: 1 })),
    count: jest.fn(() => Promise.resolve(0)),
    createQueryBuilder: jest.fn(() => makeQueryBuilder()),
    ...overrides,
  };
}

/** CacheService simulé : passe toujours par le loader, invalide sans effet. */
export function makeCacheService() {
  return {
    getOrSet: <T>(_key: string, loader: () => Promise<T>): Promise<T> => loader(),
    listKey: (resource: string): string => `${resource}:list`,
    itemKey: (resource: string, id: number): string => `${resource}:item:${String(id)}`,
    slugKey: (resource: string, slug: string): string => `${resource}:slug:${slug}`,
    viewKey: (resource: string, segment: string, id?: number): string =>
      `${resource}:${segment}:${String(id ?? 0)}`,
    invalidateResource: jest.fn(),
  };
}

export type RepoMock = ReturnType<typeof makeRepo>;

/** Extrait typé du premier argument (position donnée) du premier appel d'un mock. */
export function firstCallArg<T>(mock: jest.Mock, argIndex = 0): T {
  const calls = (mock?.mock?.calls ?? []) as unknown as unknown[][];
  return calls[0]?.[argIndex] as T;
}
