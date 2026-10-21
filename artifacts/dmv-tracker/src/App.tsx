import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Login from '@/pages/login';
import Dashboard from '@/pages/dashboard';
import ImportPage from '@/pages/import';
import NoticeDetail from '@/pages/notice';
import { Employees, EmployeeDetail } from '@/pages/employees';
import Templates from '@/pages/templates';
import { DemoBanner, Shell } from '@/components/shell';
import { ErrorBox, isOdcast, Skel, useSession } from '@/lib/tracker';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } } });

function NoAccess() {
  return <div className="py-16 text-center"><h1 className="text-xl font-bold">ODCAST Staff only</h1><p className="text-sm text-muted-foreground mt-1">This page is available to ODCAST Staff.</p></div>;
}

function Root() {
  const q = useSession();
  if (q.isLoading) return <div className="min-h-[100dvh]"><DemoBanner /><div className="p-8 space-y-3"><Skel className="h-10 w-64" /><Skel className="h-40" /></div></div>;
  if (q.isError || !q.data) return <div className="min-h-[100dvh]"><DemoBanner /><div className="p-8 max-w-xl mx-auto"><ErrorBox message="Could not reach the server." onRetry={() => q.refetch()} /></div></div>;
  const { user, today } = q.data;
  if (!user) return <Login session={q.data} />;
  const odcast = isOdcast(user);
  return (
    <Shell user={user} today={today}>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/">{() => <Dashboard user={user} />}</Route>
          <Route path="/import">{() => (odcast ? <ImportPage /> : <NoAccess />)}</Route>
          <Route path="/notices/:id">{() => <NoticeDetail user={user} />}</Route>
          <Route path="/employees" component={Employees} />
          <Route path="/employees/:id" component={EmployeeDetail} />
          <Route path="/templates">{() => (odcast ? <Templates /> : <NoAccess />)}</Route>
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Root />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
