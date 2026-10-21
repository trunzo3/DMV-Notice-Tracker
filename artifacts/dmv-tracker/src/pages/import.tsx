import { useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useImportNotices, useUpdateCase, type ImportResult } from '@workspace/api-client-react';
import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHead } from '@/components/shell';
import { useToast } from '@/hooks/use-toast';
import { empName, ErrorBox, errMsg, fmtDate, Panel, Skel, useRefreshState, useTracker } from '@/lib/tracker';

const SAMPLE = 'license_number,notice_type,violation_or_event_date,effective_date,description\nD1234567,Conviction/Violation,2025-01-10,,Speeding 15 mph over limit Sacramento County\n';

export default function ImportPage() {
  const q = useTracker();
  const s = q.data;
  const refresh = useRefreshState();
  const { toast } = useToast();
  const imp = useImportNotices();
  const match = useUpdateCase();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [picks, setPicks] = useState<Record<number, string>>({});
  const [matchingId, setMatchingId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = (body: { csv?: string }) =>
    imp.mutate({ data: body }, {
      onSuccess: (r) => { setResult(r); refresh(); toast({ title: r.message }); if (body.csv) { setCsv(''); setFileName(''); } },
      onError: (e) => toast({ title: 'Import failed', description: errMsg(e), variant: 'destructive' }),
    });

  const unmatched = useMemo(() => (s?.notices ?? []).filter((n) => n.matched_employee_id == null), [s]);
  const emps = useMemo(() => [...(s?.employees ?? [])].sort((a, b) => a.last_name.localeCompare(b.last_name)), [s]);

  const doMatch = (id: number) => {
    const empId = Number(picks[id]);
    if (!empId) return;
    setMatchingId(id);
    match.mutate({ id, data: { operation: 'match', employeeId: empId } }, {
      onSuccess: (r) => { toast({ title: r.message || 'Notice matched' }); refresh(); },
      onError: (e) => toast({ title: 'Match failed', description: errMsg(e), variant: 'destructive' }),
      onSettled: () => setMatchingId(null),
    });
  };

  return (
    <div className="max-w-5xl">
      <PageHead title="Daily Import" sub="Load the day's DMV notices and match each one to an employee by license number." />
      {q.isError && <ErrorBox message="Could not load data." onRetry={() => q.refetch()} />}
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Today's DMV batch">
          <p className="text-sm text-muted-foreground mb-4">Loads 6 sample notices dated today. This can be done once per day.</p>
          {s?.batchLoaded && <p className="text-sm mb-3 font-semibold text-[#1f5e3a]" data-testid="text-batch-loaded">Today's batch has already been loaded.</p>}
          <Button data-testid="button-load-batch" onClick={() => run({})} disabled={imp.isPending || !s || s.batchLoaded}>
            <Download className="h-4 w-4 mr-2" />{imp.isPending && !csv ? 'Loading…' : "Load today's DMV notices"}
          </Button>
        </Panel>
        <Panel title="Upload a CSV file">
          <p className="text-xs text-muted-foreground mb-2">Columns: <span className="font-mono">license_number, notice_type, violation_or_event_date, effective_date, description</span></p>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" data-testid="input-csv"
            onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setFileName(f.name); setCsv(await f.text()); } e.target.value = ''; }} />
          <div className="flex flex-wrap gap-2 items-center">
            <Button variant="outline" data-testid="button-choose-csv" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-2" />Choose CSV</Button>
            <span className="text-sm truncate max-w-[200px]">{fileName || 'No file chosen'}</span>
            <Button data-testid="button-import-csv" onClick={() => run({ csv })} disabled={!csv || imp.isPending}>{imp.isPending && csv ? 'Importing…' : 'Import CSV'}</Button>
          </div>
          <a className="text-xs text-primary underline mt-3 inline-block" data-testid="link-sample-csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE)}`} download="sample-notices.csv">Download a sample CSV</a>
        </Panel>
      </div>

      {result && (
        <div className="mt-4 border border-primary rounded grid grid-cols-3 divide-x divide-border" data-testid="panel-import-result">
          {[['Imported', result.imported], ['Matched', result.matched], ['Unmatched', result.unmatched]].map(([k, v]) => (
            <div key={k} className="p-4"><div className="text-xs text-muted-foreground font-semibold">{k}</div><div className="text-3xl font-extrabold text-primary tabular-nums" data-testid={`text-result-${String(k).toLowerCase()}`}>{v}</div></div>
          ))}
        </div>
      )}

      <Panel className="mt-6" title={`Unmatched notices (${unmatched.length})`}>
        {!s ? <Skel className="h-20" /> : unmatched.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Every notice is matched to an employee.</p>
        ) : (
          <ul className="divide-y divide-border -my-2">
            {unmatched.map((n) => (
              <li key={n.notice_id} className="py-3 grid md:grid-cols-[1fr_280px_auto] gap-3 items-center" data-testid={`row-unmatched-${n.notice_id}`}>
                <div className="text-sm">
                  <Link href={`/notices/${n.notice_id}`} className="font-semibold text-primary hover:underline">{n.notice_type}</Link>
                  <span className="font-mono text-xs ml-2 px-1.5 py-0.5 bg-muted rounded">{n.license_number}</span>
                  <div className="text-muted-foreground text-xs mt-0.5">Received {fmtDate(n.received_date)} · {n.description}</div>
                </div>
                <select className="field" data-testid={`select-match-${n.notice_id}`} value={picks[n.notice_id] ?? ''} onChange={(e) => setPicks({ ...picks, [n.notice_id]: e.target.value })}>
                  <option value="">Pick an employee…</option>
                  {emps.map((e) => <option key={e.employee_id} value={e.employee_id}>{empName(e)} · D{e.district} · {e.license_number}</option>)}
                </select>
                <Button data-testid={`button-match-${n.notice_id}`} onClick={() => doMatch(n.notice_id)} disabled={!picks[n.notice_id] || matchingId === n.notice_id}>
                  {matchingId === n.notice_id ? 'Matching…' : 'Match'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
