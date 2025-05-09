import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * Configure CORS for the application
 * 
 * @param app NestJS application instance
 */
export function configureCors(app: INestApplication): void {
  // Enable CORS with appropriate configuration
  app.enableCors({
    origin: (origin, callback) => {
      // Allow all origins in development, should be restricted in production
      callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true,
  });

  // Configure global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );
}