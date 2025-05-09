import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsDate, IsEnum, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export enum ReportType {
  SALES = 'SALES',
  INVENTORY = 'INVENTORY',
  PERFORMANCE = 'PERFORMANCE',
  CUSTOM = 'CUSTOM'
}

export class GenerateReportDto {
  @ApiProperty({ description: 'Report type', enum: ReportType })
  @IsEnum(ReportType)
  type: ReportType;

  @ApiProperty({ description: 'Report name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Start date for report data' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for report data' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Additional filters' })
  @IsOptional()
  filters?: Record<string, any>;
}

export class ReportResponseDto {
  @ApiProperty({ description: 'Report ID' })
  @IsUUID()
  id: string;

  @ApiProperty({ description: 'Report type', enum: ReportType })
  @IsEnum(ReportType)
  type: ReportType;

  @ApiProperty({ description: 'Report name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Status of the report generation' })
  @IsString()
  status: string;

  @ApiPropertyOptional({ description: 'Report data' })
  @IsOptional()
  data?: Record<string, any>;

  @ApiProperty({ description: 'Created date' })
  @IsDate()
  createdAt: Date;

  @ApiPropertyOptional({ description: 'Completed date' })
  @IsOptional()
  @IsDate()
  completedAt?: Date;
}

export class ScheduleReportDto extends GenerateReportDto {
  @ApiProperty({ description: 'Schedule frequency (cron expression)' })
  @IsString()
  @IsNotEmpty()
  schedule: string;

  @ApiPropertyOptional({ description: 'Email recipients' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipients?: string[];
}