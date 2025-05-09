import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { ValidatorUtils } from '../utils/validator.utils';

/**
 * Pipe to validate and transform UUID parameters
 */
@Injectable()
export class UuidValidationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (!value) {
      throw new BadRequestException('UUID parameter cannot be empty');
    }
    
    if (!ValidatorUtils.isValidUUID(value)) {
      throw new BadRequestException(`Invalid UUID format: ${value}`);
    }
    
    return value;
  }
}