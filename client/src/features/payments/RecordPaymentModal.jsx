import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatMoney } from '@webx/shared/money.js';
import { Modal } from '@/components/ui';
import { RecordPaymentForm } from './RecordPaymentForm';

export function RecordPaymentModal({ open, onClose, invoice }) {
  const qc = useQueryClient();
  return (
    <Modal open={open} onClose={onClose} title={invoice ? `Record payment · ${invoice.number}` : 'Record payment'} description={invoice?.snapshot?.client?.name} size="md">
      {open && (
        <RecordPaymentForm
          invoice={invoice}
          onCancel={onClose}
          onDone={(payment, inv) => {
            onClose();
            ['invoices', 'payments', 'clients'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
            toast.success(`${formatMoney(payment.amount, payment.currency)} recorded · receipt ${payment.receiptNumber}`, {
              description: inv?.status === 'paid' ? 'Invoice is now fully paid.' : undefined,
              action: { label: 'Open receipt', onClick: () => window.open(`/api/payments/${payment._id}/receipt`, '_blank', 'noopener') },
            });
          }}
        />
      )}
    </Modal>
  );
}
