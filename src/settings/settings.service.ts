import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSetting } from './entities/setting.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const SETTING_ID = 1;

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(AppSetting)
    private readonly repo: Repository<AppSetting>,
  ) {}

  private async ensureRow(): Promise<AppSetting> {
    let setting = await this.repo.findOne({ where: { id: SETTING_ID } });
    if (!setting) {
      setting = this.repo.create({ id: SETTING_ID, admissionsOuvertes: true });
      setting = await this.repo.save(setting);
    }
    return setting;
  }

  async getPublic(): Promise<{ admissionsOuvertes: boolean }> {
    const setting = await this.ensureRow();
    return { admissionsOuvertes: setting.admissionsOuvertes };
  }

  async get(): Promise<AppSetting> {
    return this.ensureRow();
  }

  async update(dto: UpdateSettingsDto): Promise<AppSetting> {
    const setting = await this.ensureRow();
    if (dto.admissionsOuvertes !== undefined) {
      setting.admissionsOuvertes = dto.admissionsOuvertes;
    }
    return this.repo.save(setting);
  }
}
