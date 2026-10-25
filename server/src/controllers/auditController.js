import { z } from 'zod';
import { AuditLog } from '../models/index.js';
import { paginate } from '../utils/pagination.js';

const filterSchema = z.object({
  entity: z.string().max(40).optional(),
  entityId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  action: z.string().max(40).optional(),
});

export async function listAuditLogs(req, res) {
  const { entity, entityId, action } = filterSchema.parse(req.query);
  const filter = {};
  if (entity) filter.entity = entity;
  if (entityId) filter.entityId = entityId;
  if (action) filter.action = action;
  res.json(await paginate(AuditLog, req, { filter, searchFields: ['actorName', 'entity', 'action', 'label'], defaultSort: '-at', sortable: ['at'] }));
}
