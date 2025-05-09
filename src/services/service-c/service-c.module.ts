import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ServiceCController } from './service-c.controller';
import { ServiceCService } from './service-c.service';
import { CoreModule } from '../../core/core.module';
import { SharedServicesModule } from '../shared/services/shared-services.module';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';

// Ensure uploads directory exists
const uploadsDir = join(process.cwd(), 'uploads');
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    CoreModule,
    SharedServicesModule,
    MulterModule.register({
      storage: diskStorage({
        destination: (req, file, cb) => {
          const userUploadDir = join(uploadsDir, req.user?.tenantId || 'anonymous');
          if (!existsSync(userUploadDir)) {
            mkdirSync(userUploadDir, { recursive: true });
          }
          cb(null, userUploadDir);
        },
        filename: (req, file, cb) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, cb) => {
        // Allow specific file types
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|csv/;
        const ext = allowedTypes.test(extname(file.originalname).toLowerCase());
        const mime = allowedTypes.test(file.mimetype);
        
        if (ext && mime) {
          cb(null, true);
        } else {
          cb(new Error('Unsupported file type'), false);
        }
      },
    }),
  ],
  controllers: [ServiceCController],
  providers: [ServiceCService],
  exports: [ServiceCService],
})
export class ServiceCModule { }