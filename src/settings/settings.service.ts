import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSetting, type NavigationPrincipale } from './entities/setting.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { CacheService } from '../infrastructure/cache/cache.service';
import { CACHE_RESOURCE, CACHE_TTL } from '../infrastructure/cache/cache.constants';

const SETTING_ID = 1;

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(AppSetting)
    private readonly repo: Repository<AppSetting>,
    private readonly cacheService: CacheService,
  ) {}

  private async ensureRow(): Promise<AppSetting> {
    let setting = await this.repo.findOne({ where: { id: SETTING_ID } });
    if (!setting) {
      setting = this.repo.create({
        id: SETTING_ID,
        admissionsOuvertes: true,
        navigationPrincipale: 'admission',
      });
      setting = await this.repo.save(setting);
    }
    return setting;
  }

  async getPublic(): Promise<{
    admissionsOuvertes: boolean;
    navigationPrincipale: NavigationPrincipale;
  }> {
    return this.cacheService.getOrSet(
      this.cacheService.viewKey(CACHE_RESOURCE.settings, 'public'),
      async () => {
        const setting = await this.ensureRow();
        return {
          admissionsOuvertes: setting.admissionsOuvertes,
          navigationPrincipale: setting.navigationPrincipale,
        };
      },
      { ttl: CACHE_TTL.LONG, stampedeProtection: true },
    );
  }

  async get(): Promise<AppSetting> {
    return this.ensureRow();
  }

  async update(dto: UpdateSettingsDto): Promise<AppSetting> {
    const setting = await this.ensureRow();
    if (dto.admissionsOuvertes !== undefined) {
      setting.admissionsOuvertes = dto.admissionsOuvertes;
    }
    if (dto.navigationPrincipale !== undefined) {
      setting.navigationPrincipale = dto.navigationPrincipale;
    }
    const saved = await this.repo.save(setting);
    this.cacheService.invalidateResource(CACHE_RESOURCE.settings);
    return saved;
  }

  async getNavigationPrincipale(): Promise<NavigationPrincipale> {
    const setting = await this.ensureRow();
    return setting.navigationPrincipale;
  }
}

