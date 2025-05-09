import { 
  Controller, Get, Post, Put, Delete, Body, Param, UseGuards,
  Query, HttpCode, HttpStatus, ParseUUIDPipe, UploadedFile,
  UseInterceptors, MaxFileSizeValidator, ParseFilePipe,
  FileTypeValidator, Res
} from '@nestjs/common';
import { 
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth,
  ApiParam, ApiQuery, ApiConsumes, ApiBody
} from '@nestjs/swagger';
import { Express, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ServiceCService } from './service-c.service';
import { Action, Resource, Roles } from '../../core/auth/decorators/auth.decorator';
import { ThrottlerGuard } from '../../core/throttler/throttler.guard';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { 
  FileMetadataDto, UploadFileMetadataDto, UpdateFileMetadataDto,
  FolderDto, CreateFolderDto, UpdateFolderDto, FileType
} from './dto';
import { PaginationDto, QueryFilterDto } from '../shared/dto';
import { ApiStandardResponse, AuditLog, TenantId, MeasurePerformance } from '../shared/decorators';
import { UuidValidationPipe, TrimPipe } from '../shared/pipes';
import { Public } from '../../core/auth/decorators/public.decorator';
import { FileTooLargeException } from '../../core/exceptions/validation-exceptions';

/**
 * Controller for Service C endpoints (File & Folder Management)
 */
@ApiTags('Service C')
@Controller('api/service-c')
export class ServiceCController {
  constructor(private readonly serviceCService: ServiceCService) {}

  /**
   * Health check endpoint for Service C
   */
  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Health check', description: 'Check if Service C is healthy' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @HttpCode(HttpStatus.OK)
  async healthCheck() {
    return this.serviceCService.healthCheck();
  }

  /**
   * Upload a file
   */
  @Post('files')
  @Resource('file')
  @Action('create')
  @Roles('admin', 'user')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Upload file', description: 'Upload a new file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        metadata: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            type: { type: 'string', enum: Object.values(FileType) },
            description: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  })
  @ApiResponse({ 
    status: 201, 
    description: 'File uploaded successfully',
    type: FileMetadataDto
  })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @AuditLog('File uploaded')
  @MeasurePerformance()
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB max
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|gif|pdf|doc|docx|xls|xlsx|txt|csv)$/i }),
        ],
        exceptionFactory: () => new FileTooLargeException(),
      }),
    ) 
    file: Express.Multer.File,
    @Body('metadata', TrimPipe) metadata: UploadFileMetadataDto,
    @TenantId() tenantId: string,
  ) {
    return this.serviceCService.uploadFile(tenantId, file, metadata);
  }

  /**
   * Get file metadata by ID
   */
  @Get('files/:id/metadata')
  @Resource('file')
  @Action('read')
  @Roles('admin', 'user')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Get file metadata', description: 'Get file metadata by ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'File metadata retrieved successfully',
    type: FileMetadataDto
  })
  @ApiParam({ name: 'id', description: 'File ID', type: String })
  @ApiBearerAuth()
  @MeasurePerformance()
  async getFileMetadata(
    @Param('id', UuidValidationPipe) id: string,
    @TenantId() tenantId: string
  ) {
    return this.serviceCService.getFileMetadata(tenantId, id);
  }

  /**
   * Download a file
   */
  @Get('files/:id')
  @Resource('file')
  @Action('read')
  @Roles('admin', 'user')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Download file', description: 'Download a file by ID' })
  @ApiResponse({ status: 200, description: 'File content' })
  @ApiParam({ name: 'id', description: 'File ID', type: String })
  @ApiBearerAuth()
  @MeasurePerformance()
  async downloadFile(
    @Param('id', UuidValidationPipe) id: string,
    @TenantId() tenantId: string,
    @Res() res: Response
  ) {
    const { fileStream, metadata } = await this.serviceCService.downloadFile(tenantId, id);
    
    res.setHeader('Content-Type', metadata.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${metadata.name}"`);
    
    fileStream.pipe(res);
  }

  /**
   * Update file metadata
   */
  @Put('files/:id/metadata')
  @Resource('file')
  @Action('update')
  @Roles('admin', 'user')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Update file metadata', description: 'Update file metadata by ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'File metadata updated successfully',
    type: FileMetadataDto
  })
  @ApiParam({ name: 'id', description: 'File ID', type: String })
  @ApiBearerAuth()
  @AuditLog('File metadata updated')
  @MeasurePerformance()
  async updateFileMetadata(
    @Param('id', UuidValidationPipe) id: string,
    @Body(TrimPipe) updateData: UpdateFileMetadataDto,
    @TenantId() tenantId: string
  ) {
    return this.serviceCService.updateFileMetadata(tenantId, id, updateData);
  }

  /**
   * Delete a file
   */
  @Delete('files/:id')
  @Resource('file')
  @Action('delete')
  @Roles('admin', 'user')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Delete file', description: 'Delete a file by ID' })
  @ApiResponse({ status: 204, description: 'File deleted successfully' })
  @ApiParam({ name: 'id', description: 'File ID', type: String })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditLog('File deleted')
  @MeasurePerformance()
  async deleteFile(
    @Param('id', UuidValidationPipe) id: string,
    @TenantId() tenantId: string
  ) {
    await this.serviceCService.deleteFile(tenantId, id);
    return;
  }

  /**
   * List files
   */
  @Get('files')
  @Resource('file')
  @Action('read')
  @Roles('admin', 'user')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'List files', description: 'List files with filtering and pagination' })
  @ApiResponse({ 
    status: 200, 
    description: 'Files retrieved successfully',
    type: FileMetadataDto,
    isArray: true
  })
  @ApiQuery({ name: 'folderId', required: false, type: String })
  @ApiBearerAuth()
  @MeasurePerformance()
  async listFiles(
    @TenantId() tenantId: string,
    @Query() paginationDto: PaginationDto,
    @Query() filterDto: QueryFilterDto,
    @Query('folderId') folderId?: string
  ) {
    return this.serviceCService.listFiles(tenantId, paginationDto, filterDto, folderId);
  }

  /**
   * Create a folder
   */
  @Post('folders')
  @Resource('folder')
  @Action('create')
  @Roles('admin', 'user')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Create folder', description: 'Create a new folder' })
  @ApiResponse({ 
    status: 201, 
    description: 'Folder created successfully',
    type: FolderDto
  })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @AuditLog('Folder created')
  @MeasurePerformance()
  async createFolder(
    @Body(TrimPipe) folderData: CreateFolderDto,
    @TenantId() tenantId: string
  ) {
    return this.serviceCService.createFolder(tenantId, folderData);
  }

  /**
   * Get folder by ID
   */
  @Get('folders/:id')
  @Resource('folder')
  @Action('read')
  @Roles('admin', 'user')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Get folder', description: 'Get folder by ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Folder retrieved successfully',
    type: FolderDto
  })
  @ApiParam({ name: 'id', description: 'Folder ID', type: String })
  @ApiBearerAuth()
  @MeasurePerformance()
  async getFolderById(
    @Param('id', UuidValidationPipe) id: string,
    @TenantId() tenantId: string
  ) {
    return this.serviceCService.getFolderById(tenantId, id);
  }

  /**
   * Update a folder
   */
  @Put('folders/:id')
  @Resource('folder')
  @Action('update')
  @Roles('admin', 'user')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Update folder', description: 'Update a folder by ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Folder updated successfully',
    type: FolderDto
  })
  @ApiParam({ name: 'id', description: 'Folder ID', type: String })
  @ApiBearerAuth()
  @AuditLog('Folder updated')
  @MeasurePerformance()
  async updateFolder(
    @Param('id', UuidValidationPipe) id: string,
    @Body(TrimPipe) updateData: UpdateFolderDto,
    @TenantId() tenantId: string
  ) {
    return this.serviceCService.updateFolder(tenantId, id, updateData);
  }

  /**
   * Delete a folder
   */
  @Delete('folders/:id')
  @Resource('folder')
  @Action('delete')
  @Roles('admin', 'user')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Delete folder', description: 'Delete a folder by ID' })
  @ApiResponse({ status: 204, description: 'Folder deleted successfully' })
  @ApiParam({ name: 'id', description: 'Folder ID', type: String })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditLog('Folder deleted')
  @MeasurePerformance()
  async deleteFolder(
    @Param('id', UuidValidationPipe) id: string,
    @TenantId() tenantId: string
  ) {
    await this.serviceCService.deleteFolder(tenantId, id);
    return;
  }

  /**
   * List folders
   */
  @Get('folders')
  @Resource('folder')
  @Action('read')
  @Roles('admin', 'user')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'List folders', description: 'List folders with filtering and pagination' })
  @ApiResponse({ 
    status: 200, 
    description: 'Folders retrieved successfully',
    type: FolderDto,
    isArray: true
  })
  @ApiQuery({ name: 'parentId', required: false, type: String })
  @ApiBearerAuth()
  @MeasurePerformance()
  async listFolders(
    @TenantId() tenantId: string,
    @Query() paginationDto: PaginationDto,
    @Query() filterDto: QueryFilterDto,
    @Query('parentId') parentId?: string
  ) {
    return this.serviceCService.listFolders(tenantId, paginationDto, filterDto, parentId);
  }
}