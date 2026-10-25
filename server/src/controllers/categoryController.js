import { ExpenseCategory } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';

export async function listCategories(req, res) {
  const filter = req.query.includeInactive === '1' ? {} : { isActive: true };
  const items = await ExpenseCategory.find(filter).sort({ sortOrder: 1, name: 1 }).lean();
  res.json({ items });
}

export async function createCategory(req, res) {
  const last = await ExpenseCategory.findOne().sort({ sortOrder: -1 }).lean();
  const category = await new ExpenseCategory({ ...req.body, sortOrder: req.body.sortOrder ?? (last?.sortOrder ?? 0) + 1 }).save();
  res.status(201).json({ category });
}

export async function updateCategory(req, res) {
  const category = await ExpenseCategory.findById(req.params.id);
  if (!category) throw ApiError.notFound('Category not found');
  category.set(req.body);
  await category.save();
  res.json({ category });
}
