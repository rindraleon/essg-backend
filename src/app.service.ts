import { Injectable } from '@nestjs/common';
import {
  API_PROVIDER,
  API_SIGNATURE,
  API_TITLE,
  API_VERSION,
} from './common/constants/api.constants';

export interface ApiInfo {
  name: string;
  version: string;
  provider: string;
  signature: typeof API_SIGNATURE;
  documentation: string;
  health: string;
}

@Injectable()
export class AppService {
  getApiInfo(): ApiInfo {
    return {
      name: API_TITLE,
      version: API_VERSION,
      provider: API_PROVIDER,
      signature: API_SIGNATURE,
      documentation: '/docs',
      health: '/health',
    };
  }

  getHello(): string {
    return `API ESSG — ${API_PROVIDER}`;
  }
}
