import { useSettings } from '@/api/hooks';
import { PRESETS, presetRange } from '@/lib/ranges';
import { Input, Select } from '@/components/ui';

/** Preset + custom date range. value: { preset, from, to } */
export function RangePicker({ value, onChange, presets = PRESETS }) {
  const settings = useSettings();
  const fyStart = settings.data?.fyStartMonth ?? 4;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={value.preset}
        onChange={(e) => {
          const preset = e.target.value;
          const r = presetRange(preset, fyStart);
          onChange(r ? { preset, ...r } : { ...value, preset });
        }}
        className="w-36"
        aria-label="Date range"
      >
        {presets.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </Select>
      {value.preset === 'custom' && (
        <>
          <Input type="date" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} className="w-40" aria-label="From" />
          <span className="text-xs text-muted">to</span>
          <Input type="date" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} className="w-40" aria-label="To" />
        </>
      )}
    </div>
  );
}

export const rangeParams = (r) => ({ from: r.from || undefined, to: r.to || undefined });
