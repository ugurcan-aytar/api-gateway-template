import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsDate, IsEnum, IsArray, IsNumber, Min, Max } from 'class-validator';

export enum FileType {
  DOCUMENT = 'DOCUMENT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  OTHER = 'OTHER'
}

export class FileMetadataDto {
  @ApiProperty({ description: 'File ID' })
  @IsUUID()
  id: string;

  @ApiProperty({ description: 'File name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'File type', enum: FileType })
  @IsEnum(FileType)
  type: FileType;

  @ApiProperty({ description: 'Content type (MIME type)' })
  @IsString()
  contentType: string;

  @ApiProperty({ description: 'File size in bytes' })
  @IsNumber()
  @Min(0)
  size: number;

  @ApiPropertyOptional({ description: 'File description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Upload date' })
  @IsDate()
  uploadedAt: Date;

  @ApiPropertyOptional({ description: 'Last modified date' })
  @IsOptional()
  @IsDate()
  modifiedAt?: Date;

  @ApiPropertyOptional({ description: 'User who uploaded the file' })
  @IsOptional()
  @IsString()
  uploadedBy?: string;

  @ApiPropertyOptional({ description: 'File tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UploadFileMetadataDto {
  @ApiProperty({ description: 'File name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'File type', enum: FileType })
  @IsEnum(FileType)
  type: FileType;

  @ApiPropertyOptional({ description: 'File description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'File tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateFileMetadataDto {
  @ApiPropertyOptional({ description: 'File name' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ description: 'File type', enum: FileType })
  @IsOptional()
  @IsEnum(FileType)
  type?: FileType;

  @ApiPropertyOptional({ description: 'File description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'File tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}