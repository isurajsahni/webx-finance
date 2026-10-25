import { z } from 'zod';

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
  search: z.string().trim().max(100).optional(),
  sort: z.string().regex(/^-?[a-zA-Z_.]+$/).optional(),
});

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Standard list handler helper: pagination, case-insensitive search across
 * `searchFields`, and sort restricted to `sortable` fields.
 */
export async function paginate(Model, req, { filter = {}, searchFields = [], sortable = [], defaultSort = '-createdAt', populate, select } = {}) {
  const q = listQuery.parse(req.query);
  const query = { ...filter };

  if (q.search && searchFields.length) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    query.$or = searchFields.map((f) => ({ [f]: rx }));
  }

  const sortField = q.sort?.replace(/^-/, '');
  const sort = q.sort && sortable.includes(sortField) ? q.sort : defaultSort;

  let cursor = Model.find(query).sort(sort).skip((q.page - 1) * q.limit).limit(q.limit);
  if (populate) cursor = cursor.populate(populate);
  if (select) cursor = cursor.select(select);

  const [items, total] = await Promise.all([cursor.lean({ virtuals: true }), Model.countDocuments(query)]);
  return { items, page: q.page, limit: q.limit, total, pages: Math.max(1, Math.ceil(total / q.limit)) };
}
