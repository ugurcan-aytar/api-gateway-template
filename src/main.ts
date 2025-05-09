import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { RedisService } from './core/redis/redis.service';
import { AllExceptionsFilter } from './core/filters/all-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Bootstrap the application.
 */
export async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Apply global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Enable CORS
  app.enableCors();

  // Set up Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('API Gateway')
    .setDescription('API Gateway Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Set global prefix
  app.setGlobalPrefix('api');

  // Get port from environment or use default
  const port = process.env.PORT || 8000;

  // Start the server
  await app.listen(port);
  logger.log(`🚀 API Gateway is running on: http://localhost:${port}/api`);

  // Handle graceful shutdown
  const signals = ['SIGTERM', 'SIGINT'];

  for (const signal of signals) {
    process.on(signal, async () => {
      logger.log(`Received ${signal} signal. Starting graceful shutdown...`);

      try {
        // Get Redis service for proper cleanup
        const redisService = app.get(RedisService);

        // Close Redis connections
        logger.log('Closing Redis connections...');
        if (redisService.redisClient) {
          await redisService.redisClient.quit();
          logger.log('Redis connections closed successfully');
        }

        // Close HTTP server and NestJS app
        logger.log('Closing application...');
        await app.close();
        logger.log('Application successfully closed.');

        // Exit process with success code
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    });
  }
}

bootstrap();