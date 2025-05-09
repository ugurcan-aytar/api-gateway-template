import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QueryFilterDto {
  @ApiPropertyOptional({
    description: 'Search term',
    type: String,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by fields (JSON string)',
    type: String,
  })
  @IsOptional()
  @IsString()
  filter?: string;

  @ApiPropertyOptional({
    description: 'Sort by field (prefix with - for descending)',
    type: String,
    example: '-createdAt',
  })
  @IsOptional()
  @IsString()
  sort?: string;
}