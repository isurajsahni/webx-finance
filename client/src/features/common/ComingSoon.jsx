import { Construction } from 'lucide-react';
import { useLocation } from 'react-router';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { NAV } from '@/components/layout/nav';

export function ComingSoon() {
  const { pathname } = useLocation();
  const item = NAV.find((n) => n.to !== '/' && pathname.startsWith(n.to));
  return (
    <>
      <PageHeader title={item?.label ?? 'Coming soon'} />
      <Card>
        <EmptyState icon={Construction} title={`Arrives in Phase ${item?.phase ?? '—'}`} description="This module is planned and will be built in a later phase." />
      </Card>
    </>
  );
}

export function NotFound() {
  return (
    <Card>
      <EmptyState title="Page not found" description="The page you are looking for does not exist." />
    </Card>
  );
}
