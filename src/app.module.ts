import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { ServiceAModule } from './services/service-a/service-a.module';
import { ServiceBModule } from './services/service-b/service-b.module';
import { ServiceCModule } from './services/service-c/service-c.module';
import { LoggingMiddleware } from './core/middleware/logging.middleware';
import { BodyParserMiddleware } from './core/middleware/body-parser.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CoreModule,
    ServiceAModule,
    ServiceBModule,
    ServiceCModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggingMiddleware, BodyParserMiddleware)
      .forRoutes('*');
  }
}