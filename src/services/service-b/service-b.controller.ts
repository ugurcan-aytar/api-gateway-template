import { 
  Controller, Get, Post, Body, Param, UseGuards, 
  Query, HttpCode, HttpStatus, ParseUUIDPipe, Delete, Put 
} from '@nestjs/common';
import { 
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, 
  ApiParam, ApiQuery 
} from '@nestjs/swagger';
import { ServiceBService } from './service-b.service';
import { Action, Resource, Roles } from '../../core/auth/decorators/auth.decorator';
import { ThrottlerGuard } from '../../core/throttler/throttler.guard';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { 
  GenerateReportDto, ReportResponseDto, ScheduleReportDto,
  SendNotificationDto, NotificationResponseDto
} from './dto';
import { PaginationDto, QueryFilterDto } from '../shared/dto';
import { ApiStandardResponse, AuditLog, TenantId, MeasurePerformance } from '../shared/decorators';
import { UuidValidationPipe, TrimPipe } from '../shared/pipes';
import { SkipThrottle } from '../../core/throttler/decorators/skip-throttle-decorator';
import { Public } from '../../core/auth/decorators/public.decorator';

/**
 * Controller for Service B endpoints (Reports & Notifications)
 */
@ApiTags('Service B')
@Controller('api/service-b')
export class ServiceBController {
  constructor(private readonly serviceBService: ServiceBService) {}

  /**
   * Health check endpoint for Service B
   */
  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Health check', description: 'Check if Service B is healthy' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @HttpCode(HttpStatus.OK)
  async healthCheck() {
    return this.serviceBService.healthCheck();
  }

  /**
   * Generate a new report
   */
  @Post('reports')
  @Resource('report')
  @Action('create')
  @Roles('admin', 'user')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Generate report', description: 'Generate a new report based on criteria' })
  @ApiStandardResponse({ 
    status: 202, 
    description: 'Report generation started',
    type: ReportResponseDto
  })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.ACCEPTED)
  @AuditLog('Report generation requested')
  @MeasurePerformance()
  async generateReport(
    @Body(TrimPipe) reportDto: GenerateReportDto,
    @TenantId() tenantId: string
  ) {
    return this.serviceBService.generateReport(tenantId, reportDto);
  }

  /**
   * Get report by ID
   */
  @Get('reports/:id')
  @Resource('report')
  @Action('read')
  @Roles('admin', 'user')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Get report', description: 'Get a report by ID' })
  @ApiStandardResponse({ 
    status: 200, 
    description: 'Report retrieved successfully',
    type: ReportResponseDto
  })
  @ApiParam({ name: 'id', description: 'Report ID', type: String })
  @ApiBearerAuth()
  @MeasurePerformance()
  async getReportById(
    @Param('id', UuidValidationPipe) id: string,
    @TenantId() tenantId: string
  ) {
    return this.serviceBService.getReportById(tenantId, id);
  }

  /**
   * Get all reports
   */
  @Get('reports')
  @Resource('report')
  @Action('read')
  @Roles('admin', 'user')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Get all reports', description: 'Get all reports for the tenant' })
  @ApiStandardResponse({ 
    status: 200, 
    description: 'Reports retrieved successfully',
    type: ReportResponseDto,
    isArray: true
  })
  @ApiBearerAuth()
  @MeasurePerformance()
  async getAllReports(
    @TenantId() tenantId: string,
    @Query() paginationDto: PaginationDto,
    @Query() filterDto: QueryFilterDto
  ) {
    return this.serviceBService.getAllReports(tenantId, paginationDto, filterDto);
  }

  /**
   * Delete a report
   */
  @Delete('reports/:id')
  @Resource('report')
  @Action('delete')
  @Roles('admin')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Delete report', description: 'Delete a report by ID' })
  @ApiResponse({ status: 204, description: 'Report deleted successfully' })
  @ApiParam({ name: 'id', description: 'Report ID', type: String })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditLog('Report deleted')
  @MeasurePerformance()
  async deleteReport(
    @Param('id', UuidValidationPipe) id: string,
    @TenantId() tenantId: string
  ) {
    await this.serviceBService.deleteReport(tenantId, id);
    return;
  }

  /**
   * Schedule a recurring report
   */
  @Post('reports/schedule')
  @Resource('report')
  @Action('create')
  @Roles('admin')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Schedule report', description: 'Schedule a recurring report' })
  @ApiStandardResponse({ 
    status: 201, 
    description: 'Report scheduled successfully',
    type: ReportResponseDto
  })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @AuditLog('Report scheduled')
  @MeasurePerformance()
  async scheduleReport(
    @Body(TrimPipe) scheduleDto: ScheduleReportDto,
    @TenantId() tenantId: string
  ) {
    return this.serviceBService.scheduleReport(tenantId, scheduleDto);
  }

  /**
   * Send a notification
   */
  @Post('notifications')
  @Resource('notification')
  @Action('create')
  @Roles('admin', 'user')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Send notification', description: 'Send a new notification' })
  @ApiStandardResponse({ 
    status: 202, 
    description: 'Notification sending started',
    type: NotificationResponseDto
  })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.ACCEPTED)
  @AuditLog('Notification sent')
  @MeasurePerformance()
  async sendNotification(
    @Body(TrimPipe) notificationDto: SendNotificationDto,
    @TenantId() tenantId: string
  ) {
    return this.serviceBService.sendNotification(tenantId, notificationDto);
  }

  /**
   * Get notification by ID
   */
  @Get('notifications/:id')
  @Resource('notification')
  @Action('read')
  @Roles('admin', 'user')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Get notification', description: 'Get a notification by ID' })
  @ApiStandardResponse({ 
    status: 200, 
    description: 'Notification retrieved successfully',
    type: NotificationResponseDto
  })
  @ApiParam({ name: 'id', description: 'Notification ID', type: String })
  @ApiBearerAuth()
  @MeasurePerformance()
  async getNotificationById(
    @Param('id', UuidValidationPipe) id: string,
    @TenantId() tenantId: string
  ) {
    return this.serviceBService.getNotificationById(tenantId, id);
  }

  /**
   * Get all notifications
   */
  @Get('notifications')
  @Resource('notification')
  @Action('read')
  @Roles('admin', 'user')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Get all notifications', description: 'Get all notifications for the tenant' })
  @ApiStandardResponse({ 
    status: 200, 
    description: 'Notifications retrieved successfully',
    type: NotificationResponseDto,
    isArray: true
  })
  @ApiBearerAuth()
  @MeasurePerformance()
  async getAllNotifications(
    @TenantId() tenantId: string,
    @Query() paginationDto: PaginationDto,
    @Query() filterDto: QueryFilterDto
  ) {
    return this.serviceBService.getAllNotifications(tenantId, paginationDto, filterDto);
  }
}