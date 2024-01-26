import { Module } from '@nestjs/common';
import { ErrorHandler } from './errors/error.handler';

@Module({
  providers: [ErrorHandler],
  exports: [ErrorHandler],
})
export class CommonModule {}
