import { Logger as NestLogger } from '@nestjs/common';
import type { Logger, QueryRunner } from 'typeorm';
import { addPerf } from '../perf/perf.context';

export class TypeormPerfLogger implements Logger {
  private readonly logger = new NestLogger('TypeORM');
  private readonly verbose: boolean;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  logQuery(_query: string, _parameters?: unknown[], _queryRunner?: QueryRunner): void {
    addPerf({ dbQueries: 1 });
    if (this.verbose) {
      this.logger.debug(_query);
    }
  }

  logQueryError(error: string | Error, query: string): void {
    addPerf({ dbQueries: 1 });
    this.logger.error(typeof error === 'string' ? error : error.message, query);
  }

  logQuerySlow(time: number, query: string): void {
    addPerf({ dbMs: time });
    this.logger.warn(`Requête SQL lente (${Math.round(time)} ms) : ${query}`);
  }

  logSchemaBuild(message: string): void {
    this.logger.log(message);
  }

  logMigration(message: string): void {
    this.logger.log(message);
  }

  log(level: 'log' | 'info' | 'warn', message: unknown): void {
    const text = typeof message === 'string' ? message : JSON.stringify(message);
    if (level === 'warn') {
      this.logger.warn(text);
      return;
    }
    this.logger.log(text);
  }
}
