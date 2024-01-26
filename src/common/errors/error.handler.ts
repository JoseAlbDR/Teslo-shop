import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class ErrorHandler {
  public handleError = (error: any, name: string) => {
    const logger = new Logger(name);

    if (error.includes('not found')) throw new NotFoundException(error);
    if (error.code === '23505') throw new BadRequestException(error.detail);

    logger.error(error);

    throw new InternalServerErrorException(
      'Unexpected error, check server logs',
    );
  };
}
