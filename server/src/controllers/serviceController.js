import { z } from 'zod';
import { Service } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { paginate } from '../utils/pagination.js';
import { optStr, minor } from '../validators/common.js';

export const serviceBody = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: optStr(1000),
  rate: minor.min(0, 'Rate cannot be negative'),
  unit: optStr(30),
  sac: optStr(12),
  category: optStr(60),
  isActive: z.boolean().default(true),
});

export async function list(req, res) {
  const { active } = z.object({ active: z.enum(['1', '0', 'all']).default('1') }).parse(req.query);
  const filter = active === 'all' ? {} : { isActive: active === '1' };
  res.json(await paginate(Service, req, { filter, searchFields: ['name', 'description', 'category', 'sac'], sortable: ['name', 'rate', 'createdAt'], defaultSort: 'category name' }));
}

export async function create(req, res) {
  res.status(201).json({ service: await new Service(req.body).save() });
}

export async function update(req, res) {
  const s = await Service.findById(req.params.id);
  if (!s) throw ApiError.notFound('Service not found');
  s.set(req.body);
  res.json({ service: await s.save() });
}
