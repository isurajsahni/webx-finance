import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Camera, FileText, Image as ImageIcon, Mail, Pencil, Phone, Plus, Trash2, Upload } from 'lucide-react';
import { formatMoney } from '@webx/shared/money.js';
import { formatLongDate } from '@webx/shared/fy.js';
import { api } from '@/api/client';
import { useApiMutation, useMember, usePayouts } from '@/api/hooks';
import { useAuth } from '@/features/auth/AuthContext';
import { Badge, Button, Card, CardHeader, Field, Input, Modal, ModalFooter, QueryState } from '@/components/ui';
import { MemberForm } from './MemberForm';
import { PayoutsTable } from './PayoutsTable';

const STATUS = { active: ['green', 'Active'], on_notice: ['amber', 'On notice'], left: ['neutral', 'Left'] };
const mask = (n) => (n ? `••••${String(n).slice(-4)}` : '');

function Row({ label, children }) {
  if (!children) return null;
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function Photo({ member }) {
  const input = useRef(null);
  const upload = useApiMutation(
    (file) => {
      const fd = new FormData();
      fd.append('photo', file);
      return api.post(`/team/${member._id}/photo`, fd);
    },
    { invalidate: [['team']], success: 'Photo updated' },
  );
  return (
    <div className="relative">
      <div className="grid size-20 place-items-center overflow-hidden rounded-2xl bg-lavender text-2xl font-black text-brand-600">
        {member.photo ? <img src={`/api/files/${member.photo.key}`} alt={member.name} className="size-full object-cover" /> : member.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload.mutate(f);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="absolute -right-1.5 -bottom-1.5 grid size-8 place-items-center rounded-full border border-line bg-white text-muted shadow hover:text-brand-600"
        aria-label="Change photo"
        title="Change photo"
      >
        <Camera className="size-4" />
      </button>
    </div>
  );
}

function Documents({ member }) {
  const { isOwner } = useAuth();
  const input = useRef(null);
  const [label, setLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const opts = { invalidate: [['team']] };
  const add = useApiMutation(
    (file) => {
      const fd = new FormData();
      fd.append('label', label);
      fd.append('file', file);
      return api.post(`/team/${member._id}/documents`, fd);
    },
    { ...opts, success: 'Document added', onSuccess: () => { setAdding(false); setLabel(''); } },
  );
  const remove = useApiMutation((docId) => api.delete(`/team/${member._id}/documents/${docId}`), { ...opts, success: 'Document removed' });

  return (
    <Card>
      <CardHeader title="Documents" description="ID proof, offer letter, agreement, certificates." actions={<Button size="sm" variant="secondary" onClick={() => setAdding(true)}><Plus className="size-4" /> Add</Button>} />
      {member.documents?.length ? (
        <ul className="divide-y divide-line/50">
          {member.documents.map((doc) => (
            <li key={doc._id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
              {doc.file.mimeType === 'application/pdf' ? <FileText className="size-4 text-muted" /> : <ImageIcon className="size-4 text-muted" />}
              <a href={`/api/files/${doc.file.key}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-semibold text-brand-600 hover:underline">{doc.label}</a>
              <span className="text-xs text-muted">{formatLongDate(doc.uploadedAt)}</span>
              {isOwner && (
                <Button size="icon" variant="ghost" onClick={() => remove.mutate(doc._id)} aria-label={`Remove ${doc.label}`}><Trash2 className="size-4 text-muted" /></Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-4 text-sm text-muted">No documents yet.</p>
      )}
      <Modal open={adding} onClose={() => setAdding(false)} title="Add document" size="sm">
        {adding && (
          <div className="space-y-4">
            <Field label="What is it?" hint="e.g. Aadhaar card, PAN card, Offer letter, NDA">
              <Input value={label} onChange={(e) => setLabel(e.target.value)} autoFocus maxLength={80} />
            </Field>
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) add.mutate(f);
                e.target.value = '';
              }}
            />
            <ModalFooter>
              <Button variant="secondary" onClick={() => setAdding(false)}>Cancel</Button>
              <Button onClick={() => input.current?.click()} loading={add.isPending} disabled={!label.trim()}><Upload className="size-4" /> Choose file & upload</Button>
            </ModalFooter>
          </div>
        )}
      </Modal>
    </Card>
  );
}

function Body({ member }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [page, setPage] = useState(1);
  const payouts = usePayouts({ member: member._id, page, limit: 20, status: '' });
  const pd = member.payoutDetails || {};
  const ec = member.emergencyContact || {};
  const [tone, statusLabel] = STATUS[member.status] || STATUS[member.isActive ? 'active' : 'left'];
  const cityLine = [member.city, [member.state, member.pincode].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  return (
    <>
      <Link to="/team" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-body"><ArrowLeft className="size-3.5" /> Team</Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <Photo member={member} />
          <div>
            <h1 className="text-2xl font-black tracking-tight text-ink">{member.name}</h1>
            <p className="text-sm text-muted">{[member.role, member.department].filter(Boolean).join(' · ') || 'No role set'}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {member.employeeCode && <span className="font-mono text-xs font-semibold text-muted">{member.employeeCode}</span>}
              <Badge tone={member.type === 'employee' ? 'brand' : 'neutral'}>{member.type}</Badge>
              <Badge tone={tone}>{statusLabel}</Badge>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {member.phone && <Button as="a" href={`tel:${member.phone.replace(/\s/g, '')}`} variant="ghost"><Phone className="size-4" /> Call</Button>}
          {member.email && <Button as="a" href={`mailto:${member.email}`} variant="ghost"><Mail className="size-4" /> Email</Button>}
          <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="size-4" /> Edit details</Button>
          {member.isActive && <Button as={Link} to={`/payouts/new?member=${member._id}`}><Plus className="size-4" /> New payout</Button>}
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card px-5 py-4"><p className="text-xs font-semibold text-muted">Paid to date</p><p className="mt-1 text-xl font-black text-ink tabular-nums">{formatMoney(member.stats.totalNet)}</p></div>
        <div className="card px-5 py-4"><p className="text-xs font-semibold text-muted">Payouts</p><p className="mt-1 text-xl font-black text-ink tabular-nums">{member.stats.count}</p></div>
        <div className="card px-5 py-4"><p className="text-xs font-semibold text-muted">{member.payBasis === 'monthly' ? 'Monthly salary' : 'Project rate'}</p><p className="mt-1 text-xl font-black text-ink tabular-nums">{formatMoney(member.payBasis === 'monthly' ? member.monthlySalary : member.projectRate)}</p></div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Employment & contact" />
          <dl className="px-5 py-3">
            <Row label="Joined">{member.joiningDate && formatLongDate(member.joiningDate)}</Row>
            <Row label={member.status === 'left' ? 'Left on' : 'Last working day'}>{member.status !== 'active' && member.exitDate && `${formatLongDate(member.exitDate)}${member.exitReason ? ` · ${member.exitReason}` : ''}`}</Row>
            <Row label="Mobile">{member.phone && <a className="hover:text-brand-600" href={`tel:${member.phone.replace(/\s/g, '')}`}>{member.phone}</a>}</Row>
            <Row label="Alternate">{member.alternatePhone}</Row>
            <Row label="Work email">{member.email}</Row>
            <Row label="Personal email">{member.personalEmail}</Row>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Personal & emergency" />
          <dl className="px-5 py-3">
            <Row label="Date of birth">{member.dateOfBirth && formatLongDate(member.dateOfBirth)}</Row>
            <Row label="Blood group">{member.bloodGroup}</Row>
            <Row label="Address">{[member.address, cityLine].filter(Boolean).join(', ')}</Row>
            <Row label="Emergency contact">{ec.name && `${ec.name}${ec.relation ? ` (${ec.relation})` : ''}${ec.phone ? ` · ${ec.phone}` : ''}`}</Row>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Payout & statutory" />
          <dl className="px-5 py-3">
            <Row label="Paid via">{pd.method === 'upi' ? pd.upiId && `UPI · ${pd.upiId}` : [pd.accountName, pd.bankName, mask(pd.accountNumber), pd.ifsc].filter(Boolean).join(' · ')}</Row>
            <Row label="PAN">{member.pan && <span className="font-mono">{member.pan}</span>}</Row>
            <Row label="Aadhaar">{member.aadhaarLast4 && <span className="font-mono">XXXX XXXX {member.aadhaarLast4}</span>}</Row>
            <Row label="UAN (PF)">{member.uan && <span className="font-mono">{member.uan}</span>}</Row>
            <Row label="Notes">{member.notes && <span className="whitespace-pre-line">{member.notes}</span>}</Row>
          </dl>
        </Card>
        <Documents member={member} />
      </div>

      <Card className="mt-6">
        <CardHeader title="Payouts" />
        <PayoutsTable query={payouts} onPage={setPage} showMember={false} empty={<p className="px-5 py-6 text-sm text-muted">No payouts yet.</p>} />
      </Card>

      <Modal open={editing} onClose={() => setEditing(false)} title={`Edit ${member.name}`} size="lg">
        {editing && <MemberForm member={member} onCancel={() => setEditing(false)} onDone={() => { setEditing(false); qc.invalidateQueries({ queryKey: ['team'] }); toast.success('Saved'); }} />}
      </Modal>
    </>
  );
}

export function MemberDetailPage() {
  const { id } = useParams();
  const member = useMember(id);
  return <QueryState query={member}>{(m) => <Body member={m} />}</QueryState>;
}
