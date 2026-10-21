import { useEffect, useState } from 'react';
import { useSaveTemplate, type Template } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { PageHead } from '@/components/shell';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ErrorBox, errMsg, Skel, useRefreshState, useTracker } from '@/lib/tracker';

const FIELDS = ['{employee_name}', '{employee_id}', '{supervisor_name}', '{notice_type}', '{event_date}', '{effective_date}', '{description}', '{action_required}', '{due_date}', '{sender_name}'];

function Editor({ t }: { t: Template }) {
  const [subject, setSubject] = useState(t.subject);
  const [body, setBody] = useState(t.body);
  useEffect(() => { setSubject(t.subject); setBody(t.body); }, [t.template_id]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useSaveTemplate();
  const refresh = useRefreshState();
  const { toast } = useToast();
  const dirty = subject !== t.subject || body !== t.body;
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">{t.notice_type}</h2>
      <div><label className="label">Subject</label><input data-testid="input-template-subject" className="field" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={1000} /></div>
      <div><label className="label">Body</label><textarea data-testid="input-template-body" className="field font-mono text-[13px] leading-relaxed" rows={16} value={body} onChange={(e) => setBody(e.target.value)} /></div>
      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs text-muted-foreground mr-1 self-center">Click to insert:</span>
        {FIELDS.map((f) => <button key={f} type="button" data-testid={`button-insert-${f.slice(1, -1)}`} onClick={() => setBody((b) => b + f)} className="font-mono text-[11px] px-1.5 py-0.5 border border-border rounded bg-muted hover:border-primary">{f}</button>)}
      </div>
      <div className="flex gap-2 items-center">
        <Button data-testid="button-save-template" disabled={!dirty || !subject.trim() || !body.trim() || save.isPending}
          onClick={() => save.mutate({ id: t.template_id, data: { subject, body } }, {
            onSuccess: () => { toast({ title: 'Template saved', description: 'The next memo generated for this notice type will use it.' }); refresh(); },
            onError: (e) => toast({ title: 'Could not save template', description: errMsg(e), variant: 'destructive' }),
          })}>{save.isPending ? 'Saving…' : 'Save template'}</Button>
        <Button variant="ghost" data-testid="button-discard-template" disabled={!dirty} onClick={() => { setSubject(t.subject); setBody(t.body); }}>Discard changes</Button>
        {dirty && <span className="text-xs text-[#7a4b00]">Unsaved changes</span>}
      </div>
    </div>
  );
}

export default function Templates() {
  const q = useTracker();
  const s = q.data;
  const [sel, setSel] = useState<number | null>(null);
  const list = s?.templates ?? [];
  const cur = list.find((t) => t.template_id === sel) ?? list[0];
  return (
    <div className="max-w-6xl">
      <PageHead title="Memo Templates" sub="One template per notice type. Changes apply to the next memo generated." />
      {q.isError && <ErrorBox message="Could not load templates." onRetry={() => q.refetch()} />}
      <div className="grid md:grid-cols-[240px_1fr] gap-5 items-start">
        <ul className="border border-border rounded divide-y divide-border">
          {!s && Array.from({ length: 9 }).map((_, i) => <li key={i} className="p-3"><Skel className="h-4" /></li>)}
          {list.map((t) => (
            <li key={t.template_id}>
              <button data-testid={`button-template-${t.template_id}`} onClick={() => setSel(t.template_id)}
                className={cn('w-full text-left px-3 py-2.5 text-sm border-l-4', cur?.template_id === t.template_id ? 'border-primary bg-accent font-bold text-accent-foreground' : 'border-transparent hover:bg-muted')}>{t.notice_type}</button>
            </li>
          ))}
        </ul>
        <div className="border border-border rounded p-5">{cur ? <Editor key={cur.template_id} t={cur} /> : <Skel className="h-80" />}</div>
      </div>
    </div>
  );
}
