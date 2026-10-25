import { useRef } from 'react';
import { FileText, Image, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui';

const MAX_MB = 10;

/**
 * Existing uploaded files (removable) plus newly picked files.
 * `existing`: [{ key, originalName, mimeType }], `files`: File[].
 */
export function FilesField({ existing = [], onRemoveExisting, files, onFiles, max = 5, onError }) {
  const input = useRef(null);
  const count = existing.length + files.length;
  const icon = (type) => (type === 'application/pdf' ? <FileText className="size-3.5" /> : <Image className="size-3.5" />);

  return (
    <div className="space-y-2">
      {(existing.length > 0 || files.length > 0) && (
        <ul className="flex flex-wrap gap-2">
          {existing.map((f) => (
            <li key={f.key} className="flex items-center gap-1.5 rounded-lg border border-line bg-panel px-2 py-1 text-xs">
              {icon(f.mimeType)}
              <a href={`/api/files/${f.key}`} target="_blank" rel="noreferrer" className="max-w-40 truncate font-semibold text-brand-600 hover:underline">{f.originalName || 'File'}</a>
              {onRemoveExisting && (
                <button type="button" className="rounded p-0.5 hover:bg-white" onClick={() => onRemoveExisting(f.key)} aria-label={`Remove ${f.originalName}`}><X className="size-3" /></button>
              )}
            </li>
          ))}
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-lavender px-2 py-1 text-xs">
              {icon(f.type)}
              <span className="max-w-40 truncate font-semibold">{f.name}</span>
              <span className="text-muted">new</span>
              <button type="button" className="rounded p-0.5 hover:bg-white" onClick={() => onFiles(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`}><X className="size-3" /></button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={input}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => {
          const picked = [...(e.target.files || [])];
          e.target.value = '';
          const tooBig = picked.find((f) => f.size > MAX_MB * 1024 * 1024);
          if (tooBig) return onError?.(`${tooBig.name} is larger than ${MAX_MB} MB`);
          onFiles([...files, ...picked].slice(0, Math.max(0, max - existing.length)));
        }}
      />
      {count < max && (
        <Button variant="secondary" size="sm" onClick={() => input.current?.click()}>
          <Paperclip className="size-3.5" /> Attach bill
        </Button>
      )}
      <p className="text-xs text-muted">Images or PDFs, up to {MAX_MB} MB each, max {max}.</p>
    </div>
  );
}

/** Send JSON, or multipart (data + files) when there are files. */
export function toRequestBody(data, files, field = 'bills') {
  if (!files.length) return data;
  const fd = new FormData();
  fd.append('data', JSON.stringify(data));
  files.forEach((f) => fd.append(field, f));
  return fd;
}
