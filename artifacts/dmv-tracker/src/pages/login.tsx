import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSignIn, getGetSessionQueryKey, type Session } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { DemoBanner } from '@/components/shell';
import { errMsg } from '@/lib/tracker';

export default function Login({ session }: { session: Session }) {
  const [userId, setUserId] = useState<string>(String(session.users[0]?.id ?? ''));
  const qc = useQueryClient();
  const signIn = useSignIn();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    signIn.mutate({ data: { userId: Number(userId) } }, {
      onSuccess: (s) => { qc.clear(); qc.setQueryData(getGetSessionQueryKey(), s); },
    });
  };
  const sel = session.users.find((u) => String(u.id) === userId);
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <DemoBanner />
      <div className="h-1 bg-primary" />
      <main className="flex-1 grid place-items-center p-6">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <span className="grid place-items-center h-10 w-10 rounded-sm bg-primary text-white text-xs font-extrabold">CT</span>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">DMV Notice Tracker</h1>
              <p className="text-sm text-muted-foreground">California Department of Transportation</p>
            </div>
          </div>
          <form onSubmit={submit} className="border border-border rounded p-6 space-y-4 bg-card">
            <div>
              <h2 className="font-bold">Sign in</h2>
              <p className="text-sm text-muted-foreground">Pick a demo user. No password is needed.</p>
            </div>
            <div>
              <label className="label" htmlFor="user">Demo user</label>
              <select id="user" data-testid="select-user" className="field" value={userId} onChange={(e) => setUserId(e.target.value)}>
                {session.users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} — {u.role} — {u.district ? `District ${u.district} only` : 'all districts'}</option>
                ))}
              </select>
            </div>
            {sel && (
              <p className="text-xs text-muted-foreground border-l-2 border-primary pl-3">
                {sel.district
                  ? `District Staff see District ${sel.district} records only. They can generate memos, update actions, upload documents, and mark cases ready for ODCAST review.`
                  : 'ODCAST Staff see every district. They can import notices, edit memo templates, and close cases.'}
              </p>
            )}
            {signIn.isError && <p role="alert" className="text-sm text-destructive">{errMsg(signIn.error)}</p>}
            <Button data-testid="button-signin" type="submit" className="w-full" disabled={!userId || signIn.isPending}>
              {signIn.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
