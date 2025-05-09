import { applyDecorators, Type } from '@nestjs/common';
import { ApiResponse, getSchemaPath } from '@nestjs/swagger';

interface ApiStandardResponseOptions {
  status: number;
  description: string;
  type?: Type<any>;
  isArray?: boolean;
}

/**
 * Custom decorator to create standardized API responses
 */
export const ApiStandardResponse = (options: ApiStandardResponseOptions) => {
  const { status, description, type, isArray } = options;
  
  if (!type) {
    return applyDecorators(
      ApiResponse({
        status,
        description
      })
    );
  }
  
  return applyDecorators(
    ApiResponse({
      status,
      description,
      schema: {
        allOf: [
          {
            properties: {
              success: {
                type: 'boolean',
                example: true,
              },
              data: isArray
                ? {
                    type: 'array',
                    items: { $ref: getSchemaPath(type) },
                  }
                : { $ref: getSchemaPath(type) },
              metadata: {
                type: 'object',
                required: [],
                properties: {
                  page: { type: 'number' },
                  limit: { type: 'number' },
                  total: { type: 'number' },
                  totalPages: { type: 'number' },
                },
              },
            },
          },
        ],
      },
    }),
  );
};