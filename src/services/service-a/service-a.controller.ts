import { 
  Controller, Get, Post, Put, Delete, Body, Param, UseGuards, 
  Req, Query, HttpCode, HttpStatus, ParseUUIDPipe 
} from '@nestjs/common';
import { 
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, 
  ApiParam, ApiQuery 
} from '@nestjs/swagger';
import { ServiceAService } from './service-a.service';
import { Action, Resource, Roles } from '../../core/auth/decorators/auth.decorator';
import { ThrottlerGuard } from '../../core/throttler/throttler.guard';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Request } from 'express';
import { CreateItemDto, UpdateItemDto, ItemResponseDto } from './dto/item.dto';
import { PaginationDto, QueryFilterDto } from '../shared/dto';
import { ApiStandardResponse, AuditLog, TenantId, MeasurePerformance } from '../shared/decorators';
import { UuidValidationPipe, TrimPipe } from '../shared/pipes';
import { SkipThrottle } from '../../core/throttler/decorators/skip-throttle-decorator';

/**
 * Controller for Service A endpoints
 */
@ApiTags('Service A')
@Controller('api/service-a')
export class ServiceAController {
  constructor(private readonly serviceAService: ServiceAService) {}

  /**
   * Get all items (requires authentication)
   */
  @Get('items')
  @Resource('item')
  @Action('read')
  @Roles('admin', 'user')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Get all items', description: 'Retrieves all items for the tenant' })
  @ApiStandardResponse({ 
    status: 200, 
    description: 'Items retrieved successfully',
    type: ItemResponseDto,
    isArray: true 
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiBearerAuth()
  @MeasurePerformance()
  async getAllItems(
    @TenantId() tenantId: string,
    @Query() paginationDto: PaginationDto,
    @Query() filterDto: QueryFilterDto
  ) {
    return this.serviceAService.getAllItems(tenantId, paginationDto, filterDto);
  }

  /**
   * Get item by ID (requires authentication)
   */
  @Get('items/:id')
  @Resource('item')
  @Action('read')
  @Roles('admin', 'user')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Get item by ID', description: 'Retrieves an item by ID' })
  @ApiStandardResponse({ 
    status: 200, 
    description: 'Item retrieved successfully',
    type: ItemResponseDto 
  })
  @ApiParam({ name: 'id', description: 'Item ID', type: String })
  @ApiBearerAuth()
  @MeasurePerformance()
  async getItemById(
    @Param('id', UuidValidationPipe) id: string,
    @TenantId() tenantId: string
  ) {
    return this.serviceAService.getItemById(tenantId, id);
  }

  /**
   * Create a new item (requires authentication)
   */
  @Post('items')
  @Resource('item')
  @Action('create')
  @Roles('admin')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Create new item', description: 'Creates a new item for the tenant' })
  @ApiStandardResponse({ 
    status: 201, 
    description: 'Item created successfully',
    type: ItemResponseDto 
  })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @AuditLog('Item created')
  @MeasurePerformance()
  async createItem(
    @Body(TrimPipe) itemData: CreateItemDto,
    @TenantId() tenantId: string
  ) {
    return this.serviceAService.createItem(tenantId, itemData);
  }

  /**
   * Update an item (requires authentication)
   */
  @Put('items/:id')
  @Resource('item')
  @Action('update')
  @Roles('admin')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Update item', description: 'Updates an existing item' })
  @ApiStandardResponse({ 
    status: 200, 
    description: 'Item updated successfully',
    type: ItemResponseDto 
  })
  @ApiParam({ name: 'id', description: 'Item ID', type: String })
  @ApiBearerAuth()
  @AuditLog('Item updated')
  @MeasurePerformance()
  async updateItem(
    @Param('id', UuidValidationPipe) id: string,
    @Body(TrimPipe) updateData: UpdateItemDto,
    @TenantId() tenantId: string
  ) {
    return this.serviceAService.updateItem(tenantId, id, updateData);
  }

  /**
   * Delete an item (requires authentication)
   */
  @Delete('items/:id')
  @Resource('item')
  @Action('delete')
  @Roles('admin')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Delete item', description: 'Deletes an item' })
  @ApiResponse({ status: 204, description: 'Item deleted successfully' })
  @ApiParam({ name: 'id', description: 'Item ID', type: String })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditLog('Item deleted')
  @MeasurePerformance()
  async deleteItem(
    @Param('id', UuidValidationPipe) id: string,
    @TenantId() tenantId: string
  ) {
    await this.serviceAService.deleteItem(tenantId, id);
    return;
  }

  /**
   * Get item categories (requires authentication)
   */
  @Get('categories')
  @Resource('item')
  @Action('read')
  @Roles('admin', 'user')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @SkipThrottle() // Skip rate limiting for this endpoint
  @ApiOperation({ summary: 'Get all categories', description: 'Retrieves all categories for the tenant' })
  @ApiStandardResponse({ 
    status: 200, 
    description: 'Categories retrieved successfully',
    type: String,
    isArray: true 
  })
  @ApiBearerAuth()
  @MeasurePerformance()
  async getCategories(@TenantId() tenantId: string) {
    return this.serviceAService.getCategories(tenantId);
  }

  /**
   * Get item statistics (requires authentication)
   */
  @Get('statistics')
  @Resource('item')
  @Action('read')
  @Roles('admin')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Get item statistics', description: 'Retrieves item statistics for the tenant' })
  @ApiStandardResponse({ 
    status: 200, 
    description: 'Statistics retrieved successfully' 
  })
  @ApiBearerAuth()
  @MeasurePerformance()
  async getStatistics(@TenantId() tenantId: string) {
    return this.serviceAService.getStatistics(tenantId);
  }
}