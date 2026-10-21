import { useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { ArrowLeft, Search } from 'lucide-react';
import { PageHead } from '@/components/shell';
import { cn } from '@/lib/utils';
import { actionFor, daysBetween, empName, ErrorBox, Flag, fmtDate, Impact, Panel, Row, Skel, sortNotices, Status, useTracker } from '@/lib/tracker';

function Exp({ date, today }: { date: string | null; today: string }) {
  if (!date) return <span className="text-muted-foreground">—</span>;
  const d = daysBetween(today, date);
  return <span className={cn('font-mono text-xs whitespace-nowrap', d < 0 ? 'text-[#a32116] font-bold' : d <= 60 && 'text-[#7a4b00] font-bold')}>{fmtDate(date)}{d < 0 ? ' (expired)' : d <= 60 ? ` (${d}d)` : ''}</span>;
}

export function Employees() {
  const q = useTracker();
  const s = q.data;
  const [, go] = useLocation();
  const [term, setTerm] = useState('');
  const rows = useMemo(() => {
    const t = term.trim().toLowerCase();
    return (s?.employees ?? []).filter((e) => !t || `${e.first_name} ${e.last_name} ${e.employee_id} ${e.license_number} ${e.unit} ${e.job_title}`.toLowerCase().includes(t))
      .sort((a, b) => a.last_name.localeCompare(b.last_name));
  }, [s, term]);
  return (
    <div>
      <PageHead title="Employees" sub="Search by name, employee ID, license number, unit, or job title." />
      {q.isError && <ErrorBox message="Could not load employees." onRetry={() => q.refetch()} />}
      <div className="relative max-w-md mb-4">
        <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
        <input data-testid="input-search" className="field pl-8" placeholder="Search employees" value={term} onChange={(e) => setTerm(e.target.value)} />
      </div>
      <div className="border border-border rounded overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-muted/70 text-left text-xs text-muted-foreground"><tr>{['Name', 'District', 'Drives for dept.', 'License expires', 'Medical cert. expires', 'Open notices', 'Driving impact'].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {!s && Array.from({ length: 8 }).map((_, i) => <tr key={i} className="border-t border-border"><td colSpan={7} className="px-3 py-3"><Skel className="h-4" /></td></tr>)}
            {s && rows.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">No employees match “{term}”.</td></tr>}
            {s && rows.map((e) => (
              <tr key={e.employee_id} data-testid={`row-employee-${e.employee_id}`} onClick={() => go(`/employees/${e.employee_id}`)} className="border-t border-border cursor-pointer hover:bg-accent/50">
                <td className="px-3 py-2.5"><Link href={`/employees/${e.employee_id}`} onClick={(ev) => ev.stopPropagation()} className="font-semibold text-primary hover:underline">{e.last_name}, {e.first_name}</Link><div className="text-xs text-muted-foreground">{e.job_title}</div></td>
                <td className="px-3 py-2.5">{e.district}</td>
                <td className="px-3 py-2.5">{e.drives_for_department ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2.5"><Exp date={e.license_expiration_date} today={s.today} /></td>
                <td className="px-3 py-2.5"><Exp date={e.medical_certificate_expiration_date} today={s.today} /></td>
                <td className="px-3 py-2.5 tabular-nums font-semibold">{e.open_notices_count}</td>
                <td className="px-3 py-2.5"><Impact impact={e.driving_impact} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const q = useTracker();
  const s = q.data;
  const [, go] = useLocation();
  const e = s?.employees.find((x) => x.employee_id === Number(id));
  const notices = useMemo(() => (s && e ? sortNotices(s, s.notices.filter((n) => n.matched_employee_id === e.employee_id)) : []), [s, e]);
  if (q.isError) return <ErrorBox message="Could not load employee." onRetry={() => q.refetch()} />;
  if (!s) return <div className="space-y-4"><Skel className="h-8 w-64" /><Skel className="h-56" /></div>;
  if (!e) return <div className="py-16 text-center"><h1 className="text-xl font-bold">Employee not found</h1><p className="text-sm text-muted-foreground">They may be outside your district.</p><Link href="/employees" className="text-primary underline font-semibold mt-3 inline-block">Back to Employees</Link></div>;
  return (
    <div className="max-w-6xl">
      <Link href="/employees" className="inline-flex items-center gap-1 text-sm text-primary font-semibold mb-3 hover:underline" data-testid="link-back"><ArrowLeft className="h-4 w-4" />Employees</Link>
      <PageHead title={empName(e)} sub={`${e.job_title} · District ${e.district} · ${e.unit}`} right={<Impact impact={e.driving_impact} />} />
      <div className="grid lg:grid-cols-[380px_1fr] gap-4 items-start">
        <Panel title="Employee record">
          <dl>
            <Row k="Employee ID" v={<span className="font-mono">{e.employee_id}</span>} />
            <Row k="Email" v={e.email} />
            <Row k="Drives for dept." v={e.drives_for_department ? 'Yes' : 'No'} />
            <Row k="License" v={<span className="font-mono">{e.license_number} · Class {e.license_class}</span>} />
            <Row k="License expires" v={<Exp date={e.license_expiration_date} today={s.today} />} />
            <Row k="Medical cert." v={e.medical_certificate_expiration_date ? <Exp date={e.medical_certificate_expiration_date} today={s.today} /> : 'Not required'} />
            <Row k="Supervisor" v={<>{e.supervisor_name}<div className="text-xs text-muted-foreground font-normal">{e.supervisor_email}</div></>} />
            <Row k="Open notices" v={e.open_notices_count} />
          </dl>
        </Panel>
        <Panel title={`Notices (${notices.length})`}>
          {notices.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">No DMV notices on file for this employee.</p> : (
            <div className="overflow-x-auto -m-4">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr>{['Received', 'Type', 'Flag', 'Action due', 'Status'].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
                <tbody>{notices.map((n) => (
                  <tr key={n.notice_id} data-testid={`row-notice-${n.notice_id}`} onClick={() => go(`/notices/${n.notice_id}`)} className="border-t border-border cursor-pointer hover:bg-accent/50">
                    <td className="px-3 py-2.5 font-mono text-xs">{fmtDate(n.received_date)}</td>
                    <td className="px-3 py-2.5 font-semibold text-primary">{n.notice_type}</td>
                    <td className="px-3 py-2.5"><Flag flag={n.flag} /></td>
                    <td className="px-3 py-2.5 font-mono text-xs">{fmtDate(actionFor(s, n.notice_id)?.due_date)}</td>
                    <td className="px-3 py-2.5"><Status status={n.status} /></td>
                  </tr>))}</tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
