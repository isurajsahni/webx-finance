import { z } from 'zod';
import { ROLES } from '@webx/shared/constants.js';
import { password } from './auth.js';

export const createUserBody = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email')),
  role: z.enum(ROLES),
  password,
});

export const updateUserBody = z.object({
  name: z.string().trim().min(1).max(100),
  role: z.enum(ROLES),
  isActive: z.boolean(),
});

export const resetPasswordBody = z.object({ password });
