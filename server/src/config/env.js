import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5050),
  MONGODB_URI: z.string().trim().default(''),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  UPLOAD_DIR: z.string().default('uploads'),
  STORAGE_DRIVER: z.enum(['local']).default('local'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(10),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  console.error('Copy server/.env.example to server/.env and fill it in.');
  process.exit(1);
}

const isProd = parsed.data.NODE_ENV === 'production';
// No real connection string yet (empty or still the .env.example placeholder)?
// In development we then run a local MongoDB automatically (see config/localMongo.js).
const placeholderUri = !parsed.data.MONGODB_URI || /xxxxx|USER:PASSWORD/.test(parsed.data.MONGODB_URI);

if (isProd && placeholderUri) {
  console.error('MONGODB_URI must be set to a real MongoDB connection string in production.');
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProd,
  useLocalMongo: !isProd && placeholderUri,
  COOKIE_SECURE: parsed.data.COOKIE_SECURE ?? isProd,
};
