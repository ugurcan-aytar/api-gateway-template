import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ServiceAController } from './service-a.controller';
import { ServiceAService } from './service-a.service';
import { CoreModule } from '../../core/core.module';
import { SharedServicesModule } from '../shared/services/shared-services.module';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    CoreModule,
    SharedServicesModule
  ],
  controllers: [ServiceAController],
  providers: [ServiceAService],
  exports: [ServiceAService],
})
export class ServiceAModule { }