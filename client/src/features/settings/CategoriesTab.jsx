import { useState } from 'react';
import { Check, Pencil, Plus, Tags, X } from 'lucide-react';
import { api } from '@/api/client';
import { useApiMutation, useExpenseCategories } from '@/api/hooks';
import { Badge, Button, Card, CardHeader, EmptyState, Input, QueryState } from '@/components/ui';

const opts = { invalidate: [['expense-categories']] };

function CategoryRow({ c }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(c.name);
  const update = useApiMutation((body) => api.put(`/expense-categories/${c._id}`, body), { ...opts, onSuccess: () => setEditing(false) });

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === c.name) return setEditing(false);
    update.mutate({ name: trimmed, isActive: c.isActive });
  };

  return (
    <li className={`flex items-center gap-3 px-5 py-2.5 ${c.isActive ? '' : 'opacity-60'}`}>
      {editing ? (
        <>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') setEditing(false);
            }}
            autoFocus
            maxLength={60}
            className="flex-1"
            aria-label="Category name"
          />
          <Button size="icon" variant="ghost" onClick={save} loading={update.isPending} aria-label="Save">
            {!update.isPending && <Check className="size-4 text-emerald-600" />}
          </Button>
          <Button size="icon" variant="ghost" onClick={() => { setName(c.name); setEditing(false); }} aria-label="Cancel">
            <X className="size-4" />
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm font-semibold">{c.name}</span>
          {!c.isActive && <Badge tone="amber">Hidden</Badge>}
          <Button size="icon" variant="ghost" onClick={() => setEditing(true)} aria-label={`Rename ${c.name}`}>
            <Pencil className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" loading={update.isPending} onClick={() => update.mutate({ name: c.name, isActive: !c.isActive })}>
            {c.isActive ? 'Hide' : 'Show'}
          </Button>
        </>
      )}
    </li>
  );
}

export function CategoriesTab() {
  const categories = useExpenseCategories({ includeInactive: true });
  const [name, setName] = useState('');
  const create = useApiMutation((body) => api.post('/expense-categories', body), { ...opts, success: 'Category added', onSuccess: () => setName('') });

  return (
    <Card className="max-w-2xl">
      <CardHeader title="Expense categories" description="Hidden categories stay on past expenses but are not offered for new ones." />
      <form
        className="flex gap-2 border-b border-line/60 px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate({ name: name.trim() });
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category name" maxLength={60} aria-label="New category name" />
        <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
          <Plus className="size-4" /> Add
        </Button>
      </form>
      <QueryState query={categories}>
        {(items) =>
          items.length ? (
            <ul className="divide-y divide-line/50">
              {items.map((c) => <CategoryRow key={c._id} c={c} />)}
            </ul>
          ) : (
            <EmptyState icon={Tags} title="No categories" description="Add your first expense category above." />
          )
        }
      </QueryState>
    </Card>
  );
}
