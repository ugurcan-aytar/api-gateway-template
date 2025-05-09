import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationMetadataDto {
  @ApiProperty({ description: 'Current page', type: Number })
  page: number;

  @ApiProperty({ description: 'Items per page', type: Number })
  limit: number;

  @ApiProperty({ description: 'Total number of items', type: Number })
  total: number;

  @ApiProperty({ description: 'Total number of pages', type: Number })
  totalPages: number;

  @ApiPropertyOptional({ description: 'Indicates if there are more items', type: Boolean })
  hasMore?: boolean;
}

export class StandardResponseDto<T> {
  @ApiProperty({ description: 'Operation success status', type: Boolean })
  success: boolean;

  @ApiProperty({ description: 'Response data' })
  data: T;

  @ApiPropertyOptional({ description: 'Pagination metadata', type: PaginationMetadataDto })
  metadata?: PaginationMetadataDto;
}