import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthenticationProvider } from './auth.provider';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { ApiKeyAuthGuard } from './guards/api-key-auth.guard';

@Module({
  imports: [HttpModule],
  providers: [
    AuthenticationProvider,
    JwtAuthGuard,
    RolesGuard,
    ApiKeyAuthGuard
  ],
  exports: [
    AuthenticationProvider,
    JwtAuthGuard,
    RolesGuard,
    ApiKeyAuthGuard
  ],
})
export class AuthModule { }