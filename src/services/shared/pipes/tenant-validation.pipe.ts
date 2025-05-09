import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException, ForbiddenException } from '@nestjs/common';

/**
 * Pipe to validate tenant access permissions
 */
@Injectable()
export class TenantValidationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (!value) {
      throw new BadRequestException('Tenant ID is required');
    }
    
    // You would typically check tenant permissions from a service or database
    // This is a simple example that allows access to specific tenants
    const allowedTenants = ['tenant-1', 'tenant-2', 'tenant-3'];
    
    if (!allowedTenants.includes(value) && value !== 'direct-api-access') {
      throw new ForbiddenException(`Access to tenant ${value} is not allowed`);
    }
    
    return value;
  }
}