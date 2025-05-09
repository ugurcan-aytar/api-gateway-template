import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const RESOURCE_KEY = 'resource';
export const ACTION_KEY = 'action';
export const IS_PUBLIC_KEY = 'isPublic';

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
export const Resource = (resource: string) => SetMetadata(RESOURCE_KEY, resource);
export const Action = (action: string) => SetMetadata(ACTION_KEY, action);
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);