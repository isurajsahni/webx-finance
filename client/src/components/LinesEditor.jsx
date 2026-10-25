import { useFieldArray, useWatch } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { formatMoney, toMinor } from '@webx/shared/money.js';
import { Button, Field, Input, MoneyInput } from '@/components/ui';

/** Editable list of { [labelKey], amount } rows with a running total. */
export function LinesEditor({ control, register, errors, name, labelKey = 'description', labelPlaceholder = 'Description', addLabel = 'Add line', minRows = 1, showTotal = true, negative = false }) {
  const { fields, append, remove } = useFieldArray({ control, name });
  const rows = useWatch({ control, name }) || [];
  const total = rows.reduce((s, r) => s + (toMinor(r.amount) || 0), 0);

  return (
    <div className="space-y-2">
      {fields.map((f, i) => {
        const e = errors?.[name]?.[i] || {};
        return (
          <div key={f.id} className="flex items-start gap-2">
            <Field error={e[labelKey]?.message} className="flex-1">
              <Input {...register(`${name}.${i}.${labelKey}`)} placeholder={labelPlaceholder} aria-label={`${labelPlaceholder} ${i + 1}`} />
            </Field>
            <Field error={e.amount?.message} className="w-36">
              <MoneyInput {...register(`${name}.${i}.amount`)} placeholder="0" aria-label={`Amount ${i + 1}`} />
            </Field>
            <Button variant="ghost" size="icon" className="mt-1" disabled={fields.length <= minRows} onClick={() => remove(i)} aria-label={`Remove line ${i + 1}`}>
              <Trash2 className="size-4 text-muted" />
            </Button>
          </div>
        );
      })}
      {errors?.[name]?.message && <p className="text-xs font-medium text-red-600">{errors[name].message}</p>}
      {errors?.[name]?.root?.message && <p className="text-xs font-medium text-red-600">{errors[name].root.message}</p>}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => append({ [labelKey]: '', amount: '' })}>
          <Plus className="size-3.5" /> {addLabel}
        </Button>
        {showTotal && <p className="pr-10 text-sm font-bold tabular-nums">{negative ? '− ' : ''}{formatMoney(total)}</p>}
      </div>
    </div>
  );
}
