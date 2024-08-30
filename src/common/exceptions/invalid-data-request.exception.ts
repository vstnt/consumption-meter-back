import { BadRequestException } from '@nestjs/common';

export class InvalidDataRequestException extends BadRequestException {
  constructor(errorDescription: string) {
    super({
      error_code: 'INVALID_DATA',
      error_description: errorDescription,
    });
  }
}