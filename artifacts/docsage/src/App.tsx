import { type ComponentType } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Prompts from "@/pages/prompts";
import Jobs from "@/pages/jobs";
import JobDetail from "@/pages/job-detail";
import Landing from "@/pages/landing";
import Layout from "@/components/layout";
import CustomSignInPage from "@/pages/custom-sign-in";
import CustomSignUpPage from "@/pages/custom-sign-up";
import AdminUsersPage from "@/pages/admin-users";
import AdminRolesPage from "@/pages/admin-roles";
import WizardPage from "@/pages/wizard";
import { AuthProvider, useAuth } from "@/lib/auth-context";

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Redirect to="/dashboard" />;
  return <Landing />;
}

function ProtectedRoute({ component: Component }: { component: ComponentType }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Redirect to="/sign-in" />;
  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={CustomSignInPage} />
      <Route path="/sign-up/*?" component={CustomSignUpPage} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/prompts" component={() => <ProtectedRoute component={Prompts} />} />
      <Route path="/jobs" component={() => <ProtectedRoute component={Jobs} />} />
      <Route path="/jobs/:id" component={() => <ProtectedRoute component={JobDetail} />} />
      <Route path="/wizard" component={() => <ProtectedRoute component={WizardPage} />} />
      <Route path="/admin/users" component={() => <ProtectedRoute component={AdminUsersPage} />} />
      <Route path="/admin/roles" component={() => <ProtectedRoute component={AdminRolesPage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <WouterRouter base={basePath}>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <AppRoutes />
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </AuthProvider>
    </WouterRouter>
  );
}
