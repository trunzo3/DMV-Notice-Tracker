import { useMemo, useState } from 'react';
import { useLocation, Link } from 'wouter';
import type { DemoUser, Notice, TrackerState } from '@workspace/api-client-react';
import { PageHead } from '@/components/shell';
import { cn } from '@/lib/utils';
import { actionFor, daysBetween, empName, ErrorBox, Flag, fmtDate, Impact, isOdcast, Skel, sortNotices, Status, useTracker } from '@/lib/tracker';

const CARDS = ['New today', 'Current issues', 'Upcoming issues', 'Not cleared to drive', 'Overdue actions', 'Awaiting documents'] as const;
export const NOTICE_TYPES = ['Conviction/Violation', 'Failure to Appear', 'Suspension', 'Revocation', 'License Expiring', 'License Expired', 'Medical Certificate Expiring', 'Accident Reported', 'Reinstatement'];
const STATUSES = ['New', 'Memo sent', 'Awaiting documents', 'Ready for ODCAST review', 'Resolved', 'Overdue'];

function cardMatch(card: string, n: Notice, s: TrackerState) {
  switch (card) {
    case 'New today': return n.received_date.slice(0, 10) === s.today.slice(0, 10);
    case 'Current issues': return n.flag === 'Current issue' && n.status !== 'Resolved';
    case 'Upcoming issues': return n.flag === 'Upcoming issue' && n.status !== 'Resolved';
    case 'Not cleared to drive': return n.driving_impact === 'Not cleared to drive';
    case 'Overdue actions': return n.status === 'Overdue' || s.actions.some((a) => a.notice_id === n.notice_id && a.status === 'Overdue');
    case 'Awaiting documents': return n.status === 'Awaiting documents';
  }
  return true;
}

export default function Dashboard({ user }: { user: DemoUser }) {
  const q = useTracker();
  const [, go] = useLocation();
  const [card, setCard] = useState<string | null>(null);
  const [district, setDistrict] = useState('all');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const s = q.data;
  const odcast = isOdcast(user);

  const empById = useMemo(() => new Map((s?.employees ?? []).map((e) => [e.employee_id, e])), [s]);
  const rows = useMemo(() => {
    if (!s) return [];
    const list = s.notices.filter((n) => {
      const e = n.matched_employee_id != null ? empById.get(n.matched_employee_id) : undefined;
      if (district !== 'all' && String(e?.district ?? '') !== district) return false;
      if (type !== 'all' && n.notice_type !== type) return false;
      if (status !== 'all' && n.status !== status) return false;
      if (card && !cardMatch(card, n, s)) return false;
      return true;
    });
    return sortNotices(s, list);
  }, [s, empById, district, type, status, card]);

  const expiring = useMemo(() => {
    if (!s) return [];
    return s.employees.flatMap((e) => {
      const out: { e: typeof e; what: string; date: string }[] = [];
      const lic = daysBetween(s.today, e.license_expiration_date);
      if (lic >= 0 && lic <= 60) out.push({ e, what: 'License expires', date: e.license_expiration_date });
      if (e.medical_certificate_expiration_date) {
        const m = daysBetween(s.today, e.medical_certificate_expiration_date);
        if (m >= 0 && m <= 60) out.push({ e, what: 'Medical certificate expires', date: e.medical_certificate_expiration_date });
      }
      return out;
    }).filter((x) => district === 'all' || String(x.e.district) === district).sort((a, b) => a.date.localeCompare(b.date));
  }, [s, district]);

  const districts = useMemo(() => [...new Set((s?.employees ?? []).map((e) => e.district))].sort((a, b) => a - b), [s]);
  const anyFilter = card || district !== 'all' || type !== 'all' || status !== 'all';

  return (
    <div>
      <PageHead title="Dashboard" sub={odcast ? 'All districts. Overdue cases first, then by action due date.' : `District ${user.district} notices. Overdue cases first, then by action due date.`} />
      {q.isError && <ErrorBox message="Could not load notices." onRetry={() => q.refetch()} />}

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        {CARDS.map((c) => {
          const val = s?.summary[c];
          const on = card === c;
          const alarm = c === 'Not cleared to drive' || c === 'Overdue actions';
          return (
            <button key={c} data-testid={`card-${c.toLowerCase().replace(/\s/g, '-')}`} onClick={() => setCard(on ? null : c)} aria-pressed={on}
              className={cn('text-left border rounded px-3.5 py-3 transition-colors', on ? 'border-primary bg-primary text-white' : 'border-border bg-card hover:border-primary')}>
              <div className={cn('text-xs font-semibold', on ? 'text-white/85' : 'text-muted-foreground')}>{c}</div>
              {s ? (
                <div className={cn('mt-1 text-3xl font-extrabold tabular-nums', !on && alarm && (val ?? 0) > 0 && 'text-[#a32116]', !on && !alarm && 'text-primary')}>{val ?? 0}</div>
              ) : <Skel className="mt-2 h-8 w-12" />}
              <div className={cn('text-[11px] mt-0.5', on ? 'text-white/85' : 'text-muted-foreground')}>{on ? 'Filtering — click to clear' : 'Click to filter'}</div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-3">
        {odcast ? (
          <div className="w-40"><label className="label">District</label>
            <select data-testid="select-district" className="field" value={district} onChange={(e) => setDistrict(e.target.value)}>
              <option value="all">All districts</option>
              {districts.map((d) => <option key={d} value={d}>District {d}</option>)}
            </select></div>
        ) : (
          <div><span className="label">District</span><div className="h-9 flex items-center px-2.5 border border-border rounded bg-muted text-sm">District {user.district} (locked)</div></div>
        )}
        <div className="w-56"><label className="label">Notice type</label>
          <select data-testid="select-type" className="field" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All types</option>
            {NOTICE_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select></div>
        <div className="w-56"><label className="label">Status</label>
          <select data-testid="select-status" className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All statuses</option>
            {STATUSES.map((t) => <option key={t}>{t}</option>)}
          </select></div>
        {anyFilter && <button data-testid="button-clear-filters" className="h-9 text-sm font-semibold text-primary underline" onClick={() => { setCard(null); setDistrict('all'); setType('all'); setStatus('all'); }}>Clear filters</button>}
        <div className="ml-auto text-sm text-muted-foreground" data-testid="text-count">{s ? `${rows.length} notice${rows.length === 1 ? '' : 's'}` : ''}</div>
      </div>

      <div className="border border-border rounded overflow-x-auto">
        <table className="w-full text-sm min-w-[980px]">
          <thead className="bg-muted/70 text-left text-xs text-muted-foreground">
            <tr>{['Received', 'Employee', 'District', 'Notice type', 'Flag', 'Driving impact', 'Action due', 'Status'].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {!s && Array.from({ length: 6 }).map((_, i) => <tr key={i} className="border-t border-border"><td colSpan={8} className="px-3 py-3"><Skel className="h-4 w-full" /></td></tr>)}
            {s && rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-12 text-center">
                <div className="font-semibold">No notices match these filters.</div>
                <div className="text-muted-foreground text-sm mt-1">Try another card or clear the filters.</div>
              </td></tr>
            )}
            {s && rows.map((n) => {
              const e = n.matched_employee_id != null ? empById.get(n.matched_employee_id) : undefined;
              const a = actionFor(s, n.notice_id);
              const late = a && a.status !== 'Done' && n.status !== 'Resolved' && a.due_date.slice(0, 10) < s.today.slice(0, 10);
              return (
                <tr key={n.notice_id} data-testid={`row-notice-${n.notice_id}`} onClick={() => go(`/notices/${n.notice_id}`)}
                  className={cn('border-t border-border cursor-pointer hover:bg-accent/50', n.status === 'Overdue' && 'bg-[#fdf3f2]')}>
                  <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{fmtDate(n.received_date)}</td>
                  <td className="px-3 py-2.5"><Link href={`/notices/${n.notice_id}`} className="font-semibold text-primary hover:underline" onClick={(ev) => ev.stopPropagation()}>{e ? empName(e) : <span className="text-muted-foreground italic">Unmatched ({n.license_number})</span>}</Link></td>
                  <td className="px-3 py-2.5">{e?.district ?? '—'}</td>
                  <td className="px-3 py-2.5">{n.notice_type}</td>
                  <td className="px-3 py-2.5"><Flag flag={n.flag} /></td>
                  <td className="px-3 py-2.5"><Impact impact={n.driving_impact} /></td>
                  <td className={cn('px-3 py-2.5 font-mono text-xs whitespace-nowrap', late && 'text-[#a32116] font-bold')}>{a ? fmtDate(a.due_date) : '—'}</td>
                  <td className="px-3 py-2.5"><Status status={n.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="mt-6 border border-border rounded">
        <header className="px-4 py-2.5 bg-[#fff8e8] border-b border-[#ecc977] flex justify-between items-center">
          <h2 className="text-sm font-bold">Upcoming issues from employee records (next 60 days)</h2>
          <span className="text-xs text-muted-foreground">Checked daily, no DMV notice needed</span>
        </header>
        {!s ? <div className="p-4"><Skel className="h-12" /></div> : expiring.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No licenses or medical certificates expire in the next 60 days.</p>
        ) : (
          <ul className="divide-y divide-border">
            {expiring.map((x, i) => (
              <li key={i} className="px-4 py-2 flex flex-wrap items-center gap-3 text-sm" data-testid={`row-expiring-${i}`}>
                <Flag flag="Upcoming issue" />
                <Link href={`/employees/${x.e.employee_id}`} className="font-semibold text-primary hover:underline">{empName(x.e)}</Link>
                <span className="text-muted-foreground">District {x.e.district} · Class {x.e.license_class}</span>
                <span className="ml-auto">{x.what} <span className="font-mono text-xs font-semibold">{fmtDate(x.date)}</span> ({daysBetween(s.today, x.date)} days)</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
