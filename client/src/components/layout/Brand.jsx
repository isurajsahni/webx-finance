import { useSettings } from '@/api/hooks';

export function BrandMark({ className = 'size-9' }) {
  const settings = useSettings();
  const src = settings.data?.company.logoUrl || '/favicon.svg';
  return <img src={src} alt="" className={`${className} shrink-0 rounded-[22%] object-contain`} />;
}

export function BrandName({ dark = false }) {
  return (
    <div className="min-w-0 leading-tight">
      <p className={`truncate text-[13px] font-black tracking-wide uppercase ${dark ? 'text-white' : 'text-ink'}`}>
        The Web<span className="text-brand-500">{'{X}'}</span> Studio
      </p>
      <p className={`text-[11px] font-semibold ${dark ? 'text-white/50' : 'text-muted'}`}>Finance</p>
    </div>
  );
}
