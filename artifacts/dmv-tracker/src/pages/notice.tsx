import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'wouter';
import { useRequestDocumentUpload, useUpdateCase, type CaseInput, type DemoUser } from '@workspace/api-client-react';
import { ArrowLeft, Download, FileText, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHead } from '@/components/shell';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { actionFor, empName, ErrorBox, errMsg, Flag, fmtDate, fmtDateTime, Impact, isOdcast, Panel, Row, Skel, Status, useRefreshState, useTracker } from '@/lib/tracker';

const API = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api/demo`;
const DOC_TYPES = ['DMV record printout', 'Court disposition', 'Reinstatement letter', 'Medical certificate', 'Renewed license copy', 'Other'] as const;
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png'] as const;

export default function NoticeDetail({ user }: { user: DemoUser }) {
  const { id } = useParams<{ id: string }>();
  const nid = Number(id);
  const q = useTracker();
  const s = q.data;
  const refresh = useRefreshState();
  const { toast } = useToast();
  const op = useUpdateCase();
  const reqUpload = useRequestDocumentUpload();
  const odcast = isOdcast(user);
  const [pendingOp, setPendingOp] = useState<string | null>(null);

  const notice = s?.notices.find((n) => n.notice_id === nid);
  const emp = notice?.matched_employee_id != null ? s?.employees.find((e) => e.employee_id === notice.matched_employee_id) : undefined;
  const memo = useMemo(() => (s?.memos ?? []).filter((m) => m.notice_id === nid).sort((a, b) => b.memo_id - a.memo_id)[0], [s, nid]);
  const action = s ? actionFor(s, nid) : undefined;
  const docs = useMemo(() => (s?.documents ?? []).filter((d) => d.notice_id === nid), [s, nid]);
  const log = useMemo(() => (s?.activity ?? []).filter((a) => a.notice_id === nid).sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.log_id - a.log_id), [s, nid]);

  // memo local state, init once per memo id
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const memoInit = useRef<number | null>(null);
  useEffect(() => {
    if (memo && memoInit.current !== memo.memo_id) { memoInit.current = memo.memo_id; setSubject(memo.subject); setBody(memo.body); }
  }, [memo]);
  const memoDirty = !!memo && (subject !== memo.subject || body !== memo.body);

  // action local state
  const [act, setAct] = useState({ action_required: '', due_date: '', assigned_to: 'employee', status: 'Open' });
  const actKey = action ? `${action.action_id}|${action.due_date}|${action.status}|${action.assigned_to}|${action.action_required}` : 'none';
  const actInit = useRef<string>('');
  useEffect(() => {
    if (actInit.current === actKey) return;
    actInit.current = actKey;
    if (action) setAct({ action_required: action.action_required, due_date: action.due_date.slice(0, 10), assigned_to: action.assigned_to, status: action.status });
  }, [actKey, action]);

  const [matchEmp, setMatchEmp] = useState('');
  const [docType, setDocType] = useState<string>('DMV record printout');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = (key: string, data: CaseInput, okTitle?: string, after?: () => void) => {
    setPendingOp(key);
    op.mutate({ id: nid, data }, {
      onSuccess: (r) => { toast({ title: okTitle ?? r.message }); refresh(); after?.(); },
      onError: (e) => toast({ title: 'That did not work', description: errMsg(e), variant: 'destructive' }),
      onSettled: () => setPendingOp(null),
    });
  };
  const busy = (k: string) => pendingOp === k;

  const onFile = async (f: File) => {
    if (!(ALLOWED as readonly string[]).includes(f.type)) { toast({ title: 'Use a PDF, JPG, or PNG file', variant: 'destructive' }); return; }
    if (f.size > 10485760) { toast({ title: 'File is larger than 10 MB', variant: 'destructive' }); return; }
    setUploading(true);
    try {
      const r = await reqUpload.mutateAsync({ id: nid, data: { name: f.name, contentType: f.type as (typeof ALLOWED)[number], size: f.size } });
      const put = await fetch(r.uploadURL, { method: 'PUT', body: f, headers: { 'Content-Type': f.type } });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      await op.mutateAsync({ id: nid, data: { operation: 'document', file_name: f.name, document_type: docType as CaseInput['document_type'], objectPath: r.objectPath } });
      toast({ title: 'Document uploaded', description: f.name });
      refresh();
    } catch (e) {
      toast({ title: 'Upload failed', description: errMsg(e), variant: 'destructive' });
    } finally { setUploading(false); }
  };

  if (q.isError) return <ErrorBox message="Could not load this notice." onRetry={() => q.refetch()} />;
  if (!s) return <div className="space-y-4"><Skel className="h-8 w-72" /><div className="grid lg:grid-cols-2 gap-4"><Skel className="h-64" /><Skel className="h-64" /></div><Skel className="h-48" /></div>;
  if (!notice) return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-bold">Notice not found</h1>
      <p className="text-muted-foreground text-sm mt-1">It may be outside your district, or the link is wrong.</p>
      <Link href="/" className="text-primary font-semibold underline mt-4 inline-block">Back to Dashboard</Link>
    </div>
  );

  const resolved = notice.status === 'Resolved';

  return (
    <div className="max-w-6xl">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-primary font-semibold mb-3 hover:underline" data-testid="link-back"><ArrowLeft className="h-4 w-4" />Dashboard</Link>
      <PageHead title={`${notice.notice_type} — ${empName(emp)}`} sub={`Notice #${notice.notice_id} · License ${notice.license_number} · Source: ${notice.source}`}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Status status={notice.status} />
            {!odcast && !resolved && notice.status !== 'Ready for ODCAST review' && (
              <Button data-testid="button-ready" variant="outline" onClick={() => run('ready', { operation: 'ready' })} disabled={busy('ready')}>{busy('ready') ? 'Saving…' : 'Mark ready for ODCAST review'}</Button>
            )}
            {odcast && !resolved && (
              <Button data-testid="button-resolve" onClick={() => run('resolve', { operation: 'resolve' })} disabled={busy('resolve')}>{busy('resolve') ? 'Saving…' : 'Mark resolved'}</Button>
            )}
            {odcast && resolved && (
              <Button data-testid="button-reopen" variant="outline" onClick={() => run('reopen', { operation: 'reopen' })} disabled={busy('reopen')}>{busy('reopen') ? 'Saving…' : 'Reopen'}</Button>
            )}
          </div>
        } />

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Notice">
          <dl>
            <Row k="Notice type" v={notice.notice_type} />
            <Row k="Received" v={fmtDate(notice.received_date)} />
            <Row k="Event date" v={fmtDate(notice.violation_or_event_date)} />
            <Row k="Effective date" v={fmtDate(notice.effective_date)} />
            <Row k="Description" v={notice.description} />
            <Row k="Flag" v={<Flag flag={notice.flag} />} />
            <Row k="Driving impact" v={<Impact impact={notice.driving_impact} />} />
          </dl>
        </Panel>
        <Panel title="Employee">
          {emp ? (
            <dl>
              <Row k="Name" v={<Link href={`/employees/${emp.employee_id}`} className="text-primary hover:underline">{empName(emp)}</Link>} />
              <Row k="Employee ID" v={<span className="font-mono">{emp.employee_id}</span>} />
              <Row k="District / unit" v={`District ${emp.district} · ${emp.unit}`} />
              <Row k="Job title" v={emp.job_title} />
              <Row k="Drives for dept." v={emp.drives_for_department ? 'Yes' : 'No'} />
              <Row k="License class" v={emp.license_class} />
              <Row k="License expires" v={fmtDate(emp.license_expiration_date)} />
              <Row k="Medical cert. expires" v={emp.medical_certificate_expiration_date ? fmtDate(emp.medical_certificate_expiration_date) : 'Not required'} />
              <Row k="Supervisor" v={<>{emp.supervisor_name}<div className="text-xs text-muted-foreground font-normal">{emp.supervisor_email}</div></>} />
            </dl>
          ) : (
            <div className="space-y-3">
              <p className="text-sm">No employee has license number <span className="font-mono font-semibold">{notice.license_number}</span>. Match this notice to an employee to continue.</p>
              <div className="flex gap-2">
                <select className="field" data-testid="select-match-employee" value={matchEmp} onChange={(e) => setMatchEmp(e.target.value)}>
                  <option value="">Pick an employee…</option>
                  {[...s.employees].sort((a, b) => a.last_name.localeCompare(b.last_name)).map((e) => <option key={e.employee_id} value={e.employee_id}>{empName(e)} · D{e.district} · {e.license_number}</option>)}
                </select>
                <Button data-testid="button-match" disabled={!matchEmp || busy('match')} onClick={() => run('match', { operation: 'match', employeeId: Number(matchEmp) })}>{busy('match') ? 'Matching…' : 'Match'}</Button>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Panel className="mt-4" title="Memo"
        right={memo && <span className="text-xs text-muted-foreground">{memo.status === 'Sent' ? `Sent ${fmtDate(memo.sent_date)}` : `Draft by ${memo.created_by}, ${fmtDate(memo.created_date)}`}</span>}>
        {!memo ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">No memo yet. Generating one fills a draft from the {notice.notice_type} template, addressed to the employee with the supervisor copied.</p>
            <Button data-testid="button-generate-memo" disabled={!emp || busy('gen')} onClick={() => run('gen', { operation: 'generateMemo' }, 'Memo draft created')}>
              <FileText className="h-4 w-4 mr-2" />{busy('gen') ? 'Generating…' : 'Generate memo'}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div><span className="label">To</span><div className="font-mono text-xs">{memo.to_employee_email}</div></div>
              <div><span className="label">CC (supervisor)</span><div className="font-mono text-xs">{memo.cc_supervisor_email}</div></div>
            </div>
            <div><label className="label" htmlFor="m-subj">Subject</label><input id="m-subj" data-testid="input-memo-subject" className="field" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={1000} /></div>
            <div><label className="label" htmlFor="m-body">Body</label><textarea id="m-body" data-testid="input-memo-body" className="field font-mono text-[13px] leading-relaxed" rows={12} value={body} onChange={(e) => setBody(e.target.value)} /></div>
            <div className="flex flex-wrap gap-2 items-center">
              <Button variant="outline" data-testid="button-save-memo" disabled={!memoDirty || busy('saveMemo')} onClick={() => run('saveMemo', { operation: 'saveMemo', memoId: memo.memo_id, subject, body }, 'Memo saved')}>{busy('saveMemo') ? 'Saving…' : 'Save draft'}</Button>
              <Button data-testid="button-send-memo" disabled={busy('send')} onClick={() => run('send', { operation: 'sendMemo', memoId: memo.memo_id, subject, body }, 'Memo recorded as sent (demo — no email sent).')}>{busy('send') ? 'Recording…' : memo.status === 'Sent' ? 'Mark as sent again' : 'Mark as sent'}</Button>
              <a data-testid="link-download-memo" href={`${API}/memos/${memo.memo_id}/pdf`} className="inline-flex items-center gap-1.5 h-9 px-3 text-sm font-semibold text-primary border border-primary rounded hover:bg-accent"><Download className="h-4 w-4" />Download memo</a>
              <Button variant="ghost" data-testid="button-regenerate-memo" disabled={busy('gen')} onClick={() => { memoInit.current = null; run('gen', { operation: 'generateMemo' }, 'New memo draft created'); }}>Generate new draft</Button>
              {memoDirty && <span className="text-xs text-[#7a4b00]">Unsaved changes</span>}
            </div>
          </div>
        )}
      </Panel>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <Panel title="Action" right={action && <Status status={action.status} />}>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run('action', { operation: 'saveAction', action_required: act.action_required, due_date: act.due_date, assigned_to: act.assigned_to as CaseInput['assigned_to'], status: act.status as CaseInput['status'] }, 'Action saved'); }}>
            {!action && <p className="text-xs text-muted-foreground">No action yet{notice.notice_type === 'Reinstatement' ? ' — reinstatements need no action.' : '.'} Fill in the fields to create one.</p>}
            <div><label className="label">Action required</label><textarea data-testid="input-action-text" className="field" rows={3} value={act.action_required} onChange={(e) => setAct({ ...act, action_required: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="label">Due date</label><input type="date" data-testid="input-due-date" className={cn('field', act.due_date && act.status !== 'Done' && act.due_date < s.today.slice(0, 10) && 'border-destructive text-[#a32116]')} value={act.due_date} onChange={(e) => setAct({ ...act, due_date: e.target.value })} /></div>
              <div><label className="label">Assigned to</label>
                <select data-testid="select-assigned" className="field" value={act.assigned_to} onChange={(e) => setAct({ ...act, assigned_to: e.target.value })}>
                  <option value="employee">Employee</option><option value="supervisor">Supervisor</option><option value="district staff">District staff</option>
                </select></div>
              <div><label className="label">Status</label>
                <select data-testid="select-action-status" className="field" value={act.status} onChange={(e) => setAct({ ...act, status: e.target.value })}>
                  <option>Open</option><option>Done</option><option>Overdue</option>
                </select></div>
            </div>
            <Button type="submit" data-testid="button-save-action" disabled={!act.action_required || !act.due_date || busy('action')}>{busy('action') ? 'Saving…' : 'Save action'}</Button>
          </form>
        </Panel>

        <Panel title={`Documents (${docs.length})`}>
          <div className="flex flex-wrap gap-2 items-end mb-3">
            <div className="flex-1 min-w-[180px]"><label className="label">Document type</label>
              <select data-testid="select-doc-type" className="field" value={docType} onChange={(e) => setDocType(e.target.value)}>
                {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select></div>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="hidden" data-testid="input-file"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
            <Button data-testid="button-upload" disabled={uploading} onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-2" />{uploading ? 'Uploading…' : 'Upload file'}</Button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">PDF, JPG, or PNG, up to 10 MB.{notice.status === 'Awaiting documents' && ' Uploading moves this case to Ready for ODCAST review.'}</p>
          {docs.length === 0 ? <p className="text-sm text-muted-foreground border border-dashed border-border rounded p-4 text-center">No documents uploaded yet.</p> : (
            <ul className="divide-y divide-border border border-border rounded">
              {docs.map((d) => (
                <li key={d.document_id} className="px-3 py-2 flex items-center gap-3 text-sm" data-testid={`row-doc-${d.document_id}`}>
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0 flex-1"><div className="font-semibold truncate">{d.file_name}</div><div className="text-xs text-muted-foreground">{d.document_type} · {d.uploaded_by} · {fmtDate(d.uploaded_date)}</div></div>
                  <a href={`${API}/documents/${d.document_id}/download`} data-testid={`link-doc-${d.document_id}`} className="text-primary font-semibold text-sm hover:underline">Download</a>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel className="mt-4" title="Activity log">
        {log.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : (
          <ol className="relative border-l-2 border-border ml-1.5 space-y-3">
            {log.map((a) => (
              <li key={a.log_id} className="pl-4 relative text-sm" data-testid={`row-activity-${a.log_id}`}>
                <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                <span className="font-mono text-xs text-muted-foreground mr-2">{fmtDateTime(a.timestamp)}</span>
                <span className="font-semibold">{a.user_name}</span> — {a.action_text}
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
