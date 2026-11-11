import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Trash2 } from 'lucide-react';
import { api } from '@/api/client';
import { useApiMutation } from '@/api/hooks';
import { useAuth } from '@/features/auth/AuthContext';
import { Button, Input, Modal, ModalFooter } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * Owner-only "Delete permanently" button with a typed confirmation.
 * `what` names the record ("invoice 2026-27/0004"); `details` explains what else goes with it.
 */
export function DeleteRecord({ url, what, details, invalidate = [], to, className, full = true }) {
  const { isOwner } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const del = useApiMutation(() => api.delete(url), {
    invalidate,
    success: `Deleted ${what}`,
    onSuccess: () => {
      setOpen(false);
      if (to) navigate(to, { replace: true });
    },
  });
  if (!isOwner) return null;
  const close = () => { setOpen(false); setTyped(''); };

  return (
    <>
      <Button variant="ghost" className={cn('text-red-600 hover:bg-red-50', full && 'w-full', className)} onClick={() => setOpen(true)}>
        <Trash2 className="size-4" /> Delete
      </Button>
      <Modal open={open} onClose={close} title={`Delete ${what}?`} size="sm">
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); if (typed.trim() === 'DELETE') del.mutate(); }}
        >
          <p className="text-sm text-body">
            This removes it from the app for good. It is <b>not</b> the same as voiding: nothing stays on file and it cannot be undone.
          </p>
          {details && <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{details}</p>}
          <label className="block text-sm">
            Type <span className="font-mono font-bold">DELETE</span> to confirm
            <Input className="mt-1.5" autoFocus autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </label>
          <ModalFooter>
            <Button variant="secondary" onClick={close}>Keep it</Button>
            <Button variant="danger" type="submit" disabled={typed.trim() !== 'DELETE'} loading={del.isPending}>Delete permanently</Button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}
