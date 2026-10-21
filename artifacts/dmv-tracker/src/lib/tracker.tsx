import { useQueryClient } from '@tanstack/react-query';
import {
  useGetSession,
  useGetTrackerState,
  getGetTrackerStateQueryKey,
  getGetSessionQueryKey,
  type DemoUser,
  type Employee,
  type Notice,
  type TrackerState,
} from '@workspace/api-client-react';
import { cn } from '@/lib/utils';

export function useSession() {
  return useGetSession({ query: { queryKey: getGetSessionQueryKey(), staleTime: 30_000 } });
}

export function useTracker(enabled = true) {
  return useGetTrackerState({
    query: { queryKey: getGetTrackerStateQueryKey(), enabled, refetchInterval: 60_000 },
  });
}

export function useRefreshState() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: getGetTrackerStateQueryKey() });
}

export const isOdcast = (u?: DemoUser | null) => !!u && u.role.toLowerCase().includes('odcast');

export const empName = (e?: Employee | null) => (e ? `${e.first_name} ${e.last_name}` : 'Unmatched');

export function errMsg(e: unknown): string {
  if (!e) return 'Something went wrong.';
  const anyE = e as { data?: { error?: string; message?: string }; message?: string };
  return anyE.data?.error || anyE.data?.message || anyE.message || 'Something went wrong.';
}

export function fmtDate(d?: string | null) {
  if (!d) return '—';
  const s = d.slice(0, 10);
  const [y, m, day] = s.split('-').map(Number);
  if (!y) return d;
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
export function fmtDateTime(d?: string | null) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 86400000);
}

export function actionFor(state: TrackerState, noticeId: number) {
  return state.actions.filter((a) => a.notice_id === noticeId).sort((a, b) => b.action_id - a.action_id)[0];
}

export function Flag({ flag }: { flag: string }) {
  const cls = flag.startsWith('Current')
    ? 'bg-[#fbe9e7] text-[#a32116] border-[#e9b4ad]'
    : flag.startsWith('Upcoming')
      ? 'bg-[#fff4dc] text-[#7a4b00] border-[#ecc977]'
      : 'bg-[#eef1f4] text-[#4a5561] border-[#cfd6dd]';
  return <span data-testid="status-flag" className={cn('inline-flex items-center rounded-sm border px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap', cls)}>{flag}</span>;
}

export function Impact({ impact }: { impact: string }) {
  const dot = impact.startsWith('Not cleared') ? 'bg-[#c0281b]' : impact.startsWith('Review') ? 'bg-[#d08a00]' : impact.startsWith('Cleared') ? 'bg-[#2e7d4f]' : 'bg-[#8a96a3]';
  return (
    <span data-testid="status-impact" className={cn('inline-flex items-center gap-1.5 text-sm whitespace-nowrap', impact.startsWith('Not cleared') && 'font-semibold text-[#a32116]')}>
      <span className={cn('h-2 w-2 rounded-full', dot)} />
      {impact}
    </span>
  );
}

export function Status({ status }: { status: string }) {
  const cls =
    status === 'Overdue' ? 'bg-[#a32116] text-white border-[#a32116]'
    : status === 'Resolved' || status === 'Done' || status === 'Sent' ? 'bg-[#e7f3ec] text-[#1f5e3a] border-[#b5d8c2]'
    : status === 'Ready for ODCAST review' ? 'bg-[#e3eef8] text-[#004a80] border-[#a9c8e3]'
    : status === 'New' ? 'bg-white text-[#005A9C] border-[#005A9C]'
    : 'bg-[#f3f5f7] text-[#33404d] border-[#cfd6dd]';
  return <span data-testid="status-notice" className={cn('inline-flex items-center rounded-sm border px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap', cls)}>{status}</span>;
}

export function Panel({ title, right, children, className }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('border border-border rounded bg-card', className)}>
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 bg-muted/60">
        <h2 className="text-sm font-bold tracking-tight">{title}</h2>
        {right}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3 py-1.5 border-b border-border/60 last:border-0 text-sm">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium min-w-0 break-words">{v}</dd>
    </div>
  );
}

export function Skel({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-muted', className)} />;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="border-l-4 border-destructive bg-[#fbe9e7] px-4 py-3 text-sm flex items-center justify-between gap-4">
      <span className="text-[#7d1a11]">{message}</span>
      {onRetry && <button data-testid="button-retry" onClick={onRetry} className="font-semibold text-primary underline">Try again</button>}
    </div>
  );
}

export function sortNotices(state: TrackerState, list: Notice[]) {
  return [...list].sort((a, b) => {
    const ao = a.status === 'Overdue' ? 0 : 1, bo = b.status === 'Overdue' ? 0 : 1;
    if (ao !== bo) return ao - bo;
    const ad = actionFor(state, a.notice_id)?.due_date ?? '9999', bd = actionFor(state, b.notice_id)?.due_date ?? '9999';
    return ad.localeCompare(bd);
  });
}
