import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsDate, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateItemDto {
  @ApiProperty({ description: 'Item name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Item description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ description: 'Item category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ description: 'Item price', type: Number })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number;
}

export class UpdateItemDto {
  @ApiPropertyOptional({ description: 'Item name' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ description: 'Item description' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @ApiPropertyOptional({ description: 'Item category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Item price', type: Number })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price?: number;
}

export class ItemResponseDto {
  @ApiProperty({ description: 'Item ID' })
  @IsUUID()
  id: string;

  @ApiProperty({ description: 'Item name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Item description' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ description: 'Item category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ description: 'Item price', type: Number })
  @IsNumber()
  price: number;

  @ApiProperty({ description: 'Created date', type: Date })
  @IsDate()
  createdAt: Date;

  @ApiProperty({ description: 'Last updated date', type: Date })
  @IsDate()
  updatedAt: Date;
}