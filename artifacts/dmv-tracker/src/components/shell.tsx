import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { useSignOut, type DemoUser } from '@workspace/api-client-react';
import { LayoutDashboard, FileInput, Users, FileText, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isOdcast, fmtDate } from '@/lib/tracker';
import { useToast } from '@/hooks/use-toast';

export function DemoBanner() {
  return (
    <div data-testid="banner-demo" className="bg-[#1d2a36] text-white text-xs font-semibold text-center py-1 tracking-wide">
      DEMO — sample data only, not real DMV or employee records.
    </div>
  );
}

export function Shell({ user, today, children }: { user: DemoUser; today: string; children: React.ReactNode }) {
  const [loc, setLoc] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const signOut = useSignOut();
  const odcast = isOdcast(user);
  const nav = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { href: '/import', label: 'Daily Import', icon: FileInput, show: odcast },
    { href: '/employees', label: 'Employees', icon: Users, show: true },
    { href: '/templates', label: 'Memo Templates', icon: FileText, show: odcast },
  ].filter((n) => n.show);
  const active = (h: string) => (h === '/' ? loc === '/' || loc.startsWith('/notices') : loc.startsWith(h));

  const doSignOut = () =>
    signOut.mutate(undefined, {
      onSuccess: () => { qc.clear(); setLoc('/'); },
      onError: () => toast({ title: 'Could not sign out', variant: 'destructive' }),
    });

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <DemoBanner />
      <header className="h-14 border-b-4 border-primary bg-white flex items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-3" data-testid="link-home">
          <span className="grid place-items-center h-8 w-8 rounded-sm bg-primary text-white text-[11px] font-extrabold tracking-tight">CT</span>
          <span className="leading-tight">
            <span className="block font-extrabold text-[15px] tracking-tight">DMV Notice Tracker</span>
            <span className="block text-[11px] text-muted-foreground">Caltrans · Driver license eligibility</span>
          </span>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-right leading-tight hidden sm:block">
            <div className="font-semibold" data-testid="text-username">{user.name}</div>
            <div className="text-xs text-muted-foreground" data-testid="text-userrole">
              {user.role} · {user.district ? `District ${user.district}` : 'All districts'}
            </div>
          </div>
          <button data-testid="button-signout" onClick={doSignOut} disabled={signOut.isPending} className="inline-flex items-center gap-1 text-primary font-semibold underline-offset-2 hover:underline disabled:opacity-50">
            <LogOut className="h-4 w-4" /> {signOut.isPending ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>
      <div className="flex flex-1 min-h-0">
        <nav className="w-14 md:w-56 shrink-0 border-r border-border bg-sidebar py-4">
          <ul className="space-y-0.5">
            {nav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} data-testid={`link-nav-${n.label.toLowerCase().replace(/\s/g, '-')}`}
                  className={cn('flex items-center gap-3 px-4 py-2.5 text-sm border-l-4 transition-colors',
                    active(n.href) ? 'border-primary bg-sidebar-accent text-sidebar-accent-foreground font-bold' : 'border-transparent text-sidebar-foreground hover:bg-sidebar-accent/60')}>
                  <n.icon className="h-4 w-4 shrink-0" />
                  <span className="hidden md:inline">{n.label}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden md:block mt-8 mx-4 pt-4 border-t border-border text-xs text-muted-foreground">
            Today<br /><span className="font-mono text-foreground" data-testid="text-today">{fmtDate(today)}</span>
          </div>
        </nav>
        <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight" data-testid="text-page-title">{title}</h1>
        {sub && <p className="text-sm text-muted-foreground mt-1">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
