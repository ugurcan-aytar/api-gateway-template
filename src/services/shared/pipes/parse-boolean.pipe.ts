import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';

/**
 * Pipe to parse boolean values from string representations
 */
@Injectable()
export class ParseBooleanPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (value === undefined || value === null) {
      return false;
    }
    
    if (typeof value === 'boolean') {
      return value;
    }
    
    if (typeof value === 'string') {
      const lowercaseValue = value.toLowerCase();
      if (lowercaseValue === 'true' || lowercaseValue === '1' || lowercaseValue === 'yes') {
        return true;
      }
      
      if (lowercaseValue === 'false' || lowercaseValue === '0' || lowercaseValue === 'no') {
        return false;
      }
    }
    
    throw new BadRequestException('Boolean value could not be parsed');
  }
}