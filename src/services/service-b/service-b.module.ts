import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ServiceBController } from './service-b.controller';
import { ServiceBService } from './service-b.service';
import { CoreModule } from '../../core/core.module';
import { SharedServicesModule } from '../shared/services/shared-services.module';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    CoreModule,
    SharedServicesModule
  ],
  controllers: [ServiceBController],
  providers: [ServiceBService],
  exports: [ServiceBService],
})
export class ServiceBModule { }