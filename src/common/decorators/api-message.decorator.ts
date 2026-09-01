import { SetMetadata } from '@nestjs/common';

export const API_MESSAGE_KEY = 'apiMessage';

export const ApiMessage = (message: string): MethodDecorator =>
  SetMetadata(API_MESSAGE_KEY, message);
