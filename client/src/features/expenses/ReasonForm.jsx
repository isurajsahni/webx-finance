import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, errorMessage } from '@/api/client';
import { Button, Field, ModalFooter, Textarea } from '@/components/ui';

const schema = z.object({ reason: z.string().trim().min(3, 'Give a reason (min 3 characters)').max(500) });

/** "Why?" form for void / reject actions. Posts { reason } to `url`. */
export function ReasonForm({ url, intro, confirmLabel, onDone, onCancel }) {
  const { register, handleSubmit, formState, setError } = useForm({ resolver: zodResolver(schema), defaultValues: { reason: '' } });
  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        try {
          await api.post(url, v);
          onDone();
        } catch (err) {
          setError('reason', { message: errorMessage(err) });
        }
      })}
      noValidate
    >
      {intro && <p className="mb-4 text-sm text-muted">{intro}</p>}
      <Field label="Reason" required error={formState.errors.reason?.message}>
        <Textarea rows={3} {...register('reason')} autoFocus />
      </Field>
      <ModalFooter>
        <Button variant="secondary" onClick={onCancel}>Back</Button>
        <Button variant="danger" type="submit" loading={formState.isSubmitting}>{confirmLabel}</Button>
      </ModalFooter>
    </form>
  );
}
