# NestJS API Gateway Template

A production-ready API Gateway template built with NestJS, TypeScript, and best practices for creating secure, scalable gateway services.

![NestJS](https://img.shields.io/badge/nestjs-%23E0234E.svg?style=for-the-badge&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white)
![Swagger](https://img.shields.io/badge/-Swagger-%23Clojure?style=for-the-badge&logo=swagger&logoColor=white)

## Features

- ✓ **Authentication & Authorization**: JWT and API Key support with role-based access control
- ✓ **Rate Limiting**: Redis-backed throttling with per-endpoint configuration
- ✓ **Error Handling**: Consistent error responses across all services
- ✓ **Request Tracing**: Logging with request IDs for traceability
- ✓ **Service Proxy**: Forward and transform requests to microservices
- ✓ **Resource Quota Management**: Limit resource usage per tenant
- ✓ **Input Validation**: Request validation with class-validator
- ✓ **Health Checks**: Endpoints for monitoring
- ✓ **API Documentation**: Swagger integration
- ✓ **Test Setup**: Unit and integration tests

## Project Structure

```
api-gateway-template/
|— src/
|  |— app.controller.ts      # Main app controller with health checks
|  |— app.module.ts          # Main app module
|  |— app.service.ts         # App service
|  |— main.ts                # Application entry point
|  |— core/                  # Core gateway functionality
|  |  |— auth/               # Authentication & authorization
|  |  |— exceptions/         # Exception handling
|  |  |— filters/            # Global exception filters
|  |  |— middleware/         # HTTP middleware
|  |  |— redis/              # Redis client
|  |  |— throttler/          # Rate limiting
|  |  |— types/              # TypeScript type definitions
|  |— services/              # Microservice connectors
|  |  |— service-a/          # Service A connector
|  |  |— service-b/          # Service B connector
|  |  |— service-c/          # Service C connector
|  |— shared/                # Shared utilities
|     |— decorators/         # Custom decorators
|     |— pipes/              # Validation pipes
|     |— services/           # Shared services
|     |— utils/              # Utility functions
|— test/                     # Tests
|— .github/                  # GitHub workflows
|— Dockerfile                # Docker configuration
|— nest-cli.json             # NestJS CLI configuration
|— package.json              # Dependencies and scripts
|— tsconfig.json             # TypeScript configuration
```

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm or yarn
- Redis server

### Installation

1. Clone the repository
```
git clone https://github.com/ugurcan-aytar/api-gateway-template.git
cd api-gateway-template
```

2. Install dependencies
```
npm install
```

3. Set up environment variables
```
cp .env.example .env
```

4. Run the development server
```
npm run start:dev
```

5. Access the API documentation at http://localhost:8000/api

## Configuration

The application is configured using environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | HTTP port | 8000 |
| REDIS_HOST_MASTER | Redis host | localhost |
| REDIS_PORT | Redis port | 6379 |
| THROTTLE_TTL | Rate limit window (seconds) | 60 |
| THROTTLE_LIMIT | Rate limit requests per window | 60 |
| SERVICE_A_URL | Service A base URL | http://localhost:8001 |
| SERVICE_A_API_KEY | Service A API key | |
| SERVICE_B_URL | Service B base URL | http://localhost:8002 |
| SERVICE_B_API_KEY | Service B API key | |
| SERVICE_C_URL | Service C base URL | http://localhost:8003 |
| SERVICE_C_API_KEY | Service C API key | |
| AUTH_SERVICE_URL | Auth service URL | http://localhost:8005 |
| STATIC_API_TOKEN | Static API token(s) for authentication | |

## Core Features

### Authentication

The gateway supports both JWT and API key authentication:

- JWT Authentication: Used for user-based authentication. Tokens are validated against an authentication service.
- API Key Authentication: Used for service-to-service communication. API keys are defined in environment variables.

```
// Example of securing an endpoint with JWT authentication and role-based access
@Get('users')
@Resource('user')
@Action('read')
@Roles('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
async getUsers() {
  // ...
}
```

### Rate Limiting

The template includes a Redis-backed rate limiter with:

- Per-endpoint rate limiting
- Different limits for different request types
- Header-based client identification
- Response headers with rate limit information

```
// Example of configuring rate limits
const limitMap = {
  'POST:user': 5,         // 5 requests per minute
  'GET:user': 60,         // 60 requests per minute
  'DELETE': 10,           // 10 requests per minute for all DELETE operations
};
```

### Error Handling

Standardized error responses across all services:

- Consistent error format
- Rich error details
- Request tracing via unique request IDs

```
// Example error response
{
  "error": "ValidationError",
  "message": "Invalid email format",
  "timestamp": "2023-06-20T12:00:00.000Z",
  "path": "/api/users",
  "requestId": "123e4567-e89b-12d3-a456-426614174000",
  "validationErrors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### Service Communication

The gateway forwards requests to microservices while:

1. Authenticating the client (user or system)
2. Validating the request data
3. Enforcing rate limits and quotas
4. Transforming the request if needed
5. Handling errors consistently
6. Logging and monitoring

Each service connector follows a similar pattern:

```
// Example service connector method
async getItemById(tenantId: string, itemId: string) {
  const url = `${this.baseUrl}/items/${itemId}?tenantId=${tenantId}`;

  try {
    const { data } = await firstValueFrom(
      this.httpService.get(url, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
      }).pipe(
        catchError(this.handleError),
      ),
    );

    return data;
  } catch (error) {
    // Handle and transform errors
    // ...
  }
}
```

### Request Tracing

Every request receives a unique ID that is:

1. Generated if not present in the incoming request
2. Added to all logs related to the request
3. Passed to downstream services
4. Included in error responses

This makes it easy to trace requests across the entire system:

```
// Request ID generation in LoggingMiddleware
const requestId = req.headers['x-request-id'] as string || uuidv4();
req.headers['x-request-id'] = requestId;

// Request ID in logs
this.logger.log(`[${requestId}] ${method} ${url} - ${ip} - ${userAgent}`);

// Request ID in error responses
if (request.headers['x-request-id']) {
  errorResponse.requestId = request.headers['x-request-id'];
}
```

### Input Validation

The template uses NestJS's validation pipes with class-validator to ensure all requests are valid:

```
// Example DTO with validation
export class CreateUserDto {
  @IsString()
  @IsEmail()
  readonly email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(50)
  readonly password: string;

  @IsString()
  @IsOptional()
  readonly fullName?: string;
}
```

### Health Checks

The API includes health check endpoints for monitoring:

- /health - Public health check
- /system-check - Public system check
- /system-check-key - Protected system check (requires authentication)

These endpoints return status information and can be used by load balancers and monitoring tools.

## Extending the Template

### Adding a New Microservice

1. Create a new module in src/services/
2. Create service classes for communicating with the microservice
3. Create controllers to expose the microservice functionality
4. Add the new module to AppModule

### Adding Custom Authentication

1. Modify AuthenticationProvider in src/core/auth/auth.provider.ts
2. Update the JWT or API key validation logic
3. Add any additional authentication guards

### Modifying Rate Limits

1. Update the limit maps in ThrottlerService in src/core/throttler/throttler.service.ts
2. Customize limits for specific endpoints or resources

### Adding Custom Exceptions

1. Create a new exception class extending BaseException in src/core/exceptions/
2. Add appropriate status codes and error types
3. Use the new exception in your services

## Best Practices

### Security

- Always validate input
- Use HTTPS in production
- Restrict CORS in production
- Sanitize error messages
- Never expose sensitive information
- Use rate limiting and throttling

### Performance

- Use Redis for caching when appropriate
- Implement pagination for list endpoints
- Use appropriate timeouts for service calls
- Implement circuit breakers for service resilience

### Maintainability

- Follow the established patterns
- Add thorough documentation
- Write tests for new functionality
- Keep microservice clients isolated
- Use dependency injection

## Testing

```
# Unit tests
npm run test

# Integration tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Deployment

### Docker

A Dockerfile is included for containerization:

```
# Build the image
docker build -t api-gateway .

# Run the container
docker run -p 8000:8000 --env-file .env api-gateway
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
