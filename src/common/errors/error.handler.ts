import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class ErrorHandler {
  public name: string = '';

  public handleError = (error: any) => {
    console.log(error.code);

    const logger = new Logger(this.name);

    logger.error(error);

    if (typeof error === 'string' && error.includes('not found'))
      throw new NotFoundException(error);

    if (error.code === '23505') throw new BadRequestException(error.detail);

    throw new InternalServerErrorException(
      'Unexpected error, check server logs',
    );
  };
}
