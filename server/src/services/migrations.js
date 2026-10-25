// Small, idempotent data/index migrations run at startup.
import { Counter, Invoice, Payment, TeamMember } from '../models/index.js';
import { paymentPurpose } from './payments.js';

export async function runMigrations() {
  // v2: invoice.number became optional (drafts are unnumbered) → index must be sparse.
  const indexes = await Invoice.collection.indexes().catch(() => []);
  const numberIdx = indexes.find((i) => i.name === 'number_1');
  if (numberIdx && !numberIdx.sparse) {
    await Invoice.collection.dropIndex('number_1');
    console.log('Migration: invoice number index made sparse');
  }
  await Invoice.createIndexes();

  // v2: payments carry a purpose (advance / part / final) for their receipt.
  const unlabeled = await Payment.find({ purpose: { $exists: false } }).select('invoice previouslyReceived balanceAfter');
  for (const p of unlabeled) {
    const inv = await Invoice.findById(p.invoice).select('split').lean();
    await Payment.updateOne({ _id: p._id }, { $set: { purpose: paymentPurpose(inv || {}, p.previouslyReceived, p.balanceAfter) } });
  }
  if (unlabeled.length) console.log(`Migration: labelled ${unlabeled.length} payment(s) advance/part/final`);

  // v3: team members get an employee code (EMP-0001…) and an employment status.
  const uncoded = await TeamMember.find({ employeeCode: { $exists: false } }).sort({ createdAt: 1 });
  for (const m of uncoded) {
    const c = await Counter.findOneAndUpdate({ _id: 'employee:all' }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' });
    await TeamMember.updateOne({ _id: m._id }, { $set: { employeeCode: `EMP-${String(c.seq).padStart(4, '0')}`, status: m.isActive === false ? 'left' : 'active' } });
  }
  if (uncoded.length) console.log(`Migration: gave ${uncoded.length} team member(s) an employee code`);
}
