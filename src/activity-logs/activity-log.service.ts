import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';

import { QueryActivityLogDto } from './dto/query-activity-log.dto';
import { PaginatedData } from 'src/common/interfaces/api-response.interface';
import { buildPaginatedData } from 'src/common/utils/pagination.util';
import { ILIKE_ESCAPE, buildIlikeTerm } from 'src/common/utils/search.util';
import { ActivityLog } from './entities/activity-log.entity';


export interface CreateActivityLogData {
  userId: number | null;
  userName: string | null;
  action: string;
  description: string;
  method: string;
  endpoint: string;
  module: string;
  statusCode: number;
  success: boolean;
  ipAddress: string | null;
  metadata: Record<string, unknown> | null;
}

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly repo: Repository<ActivityLog>,
  ) {}

  private static readonly MAX_LOGS = 10_000;
  private static readonly KEEP_LOGS = 8_000;

  async create(data: CreateActivityLogData): Promise<ActivityLog> {
    const log = this.repo.create(data);
    const saved = await this.repo.save(log);
    void this.pruneIfNeeded();
    return saved;
  }

  private async pruneIfNeeded(): Promise<void> {
    try {
      const count = await this.repo.count();
      if (count < ActivityLogService.MAX_LOGS) return;

      const excess = count - ActivityLogService.KEEP_LOGS;
      const oldest = await this.repo.find({
        select: ['id'],
        order: { id: 'ASC' },
        take: excess,
      });
      const ids = oldest.map((item) => item.id);
      if (ids.length > 0) {
        await this.repo.delete(ids);
      }
    } catch {
      /* the write path must never fail because of rotation */
    }
  }

  async findAll(query: QueryActivityLogDto): Promise<PaginatedData<ActivityLog>> {
    const {
      page = 1,
      limit = 20,
      userId,
      action,
      module,
      method,
      statusCode,
      success,
      startDate,
      endDate,
      search,
      sortBy,
      sortOrder = 'DESC',
    } = query;
    const skip = (page - 1) * limit;

    const qb = this.repo.createQueryBuilder('log');

    if (userId !== undefined) {
      qb.andWhere('log.userId = :userId', { userId });
    }
    if (action) {
      qb.andWhere('log.action = :action', { action });
    }
    if (module) {
      qb.andWhere('log.module = :module', { module });
    }
    if (method) {
      qb.andWhere('log.method = :method', { method });
    }
    if (statusCode !== undefined) {
      qb.andWhere('log.statusCode = :statusCode', { statusCode });
    }
    if (success !== undefined) {
      qb.andWhere('log.success = :success', { success });
    }
    if (startDate) {
      qb.andWhere('log.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('log.createdAt <= :endDate', { endDate });
    }
    if (search) {
      const term = buildIlikeTerm(search);
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where(`log.description ILIKE :term ${ILIKE_ESCAPE}`, { term })
            .orWhere(`log.userName ILIKE :term ${ILIKE_ESCAPE}`, { term })
            .orWhere(`log.endpoint ILIKE :term ${ILIKE_ESCAPE}`, { term })
            .orWhere(`log.module ILIKE :term ${ILIKE_ESCAPE}`, { term });
        }),
      );
    }

    const allowedSort = [
      'id',
      'createdAt',
      'userId',
      'userName',
      'module',
      'method',
      'statusCode',
      'success',
    ];
    const orderBy = allowedSort.includes(sortBy ?? '') ? sortBy : 'createdAt';
    qb.orderBy(`log.${orderBy}`, sortOrder);

    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return buildPaginatedData(items, total, page, limit);
  }

  async findOne(id: number): Promise<ActivityLog> {
    const log = await this.repo.findOne({ where: { id } });
    if (!log) {
      throw new NotFoundException(`Log d'activité avec l'ID ${id} non trouvé`);
    }
    return log;
  }
}
