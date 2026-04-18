import { useEffect, useRef } from "react";
import { ClerkProvider, Show, useClerk } from "@clerk/react";
import { plPL } from "@clerk/localizations";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
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

const queryClient = new QueryClient();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Brak VITE_CLERK_PUBLISHABLE_KEY w pliku .env");
}

const bg = "hsl(220, 30%, 6%)";
const bgCard = "hsl(220, 25%, 10%)";
const primary = "hsl(210, 100%, 55%)";
const textMain = "hsl(210, 20%, 98%)";
const textSecondary = "hsl(215, 20%, 65%)";
const border = "hsl(220, 20%, 16%)";

const clerkAppearance = {
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: primary,
    colorBackground: bgCard,
    colorInputBackground: "hsl(220, 30%, 8%)",
    colorText: textMain,
    colorTextSecondary: textSecondary,
    colorInputText: textMain,
    colorNeutral: textSecondary,
    borderRadius: "0.5rem",
    fontFamily: "system-ui, sans-serif",
    fontFamilyButtons: "system-ui, sans-serif",
    fontSize: "14px",
  },
  elements: {
    rootBox: "w-full",
    cardBox: `shadow-2xl border border-[${border}] rounded-2xl w-full overflow-hidden`,
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    badge: "!hidden",
    tagInputContainer: "!hidden",
    headerTitle: { color: textMain, fontSize: "1.25rem", fontWeight: "700" },
    headerSubtitle: { color: textSecondary, fontSize: "0.875rem" },
    socialButtonsBlockButtonText: { color: textMain },
    formFieldLabel: { color: textSecondary, fontSize: "0.8rem" },
    footerActionLink: { color: primary },
    footerActionText: { color: textSecondary },
    dividerText: { color: textSecondary },
    identityPreviewEditButton: { color: primary },
    formFieldSuccessText: { color: "hsl(142,71%,45%)" },
    alertText: { color: textMain },
    logoBox: "flex justify-center mb-2",
    logoImage: "h-10",
    socialButtonsBlockButton: `border border-[${border}] bg-transparent hover:bg-white/5`,
    formButtonPrimary: `bg-[${primary}] hover:opacity-90 text-white font-semibold`,
    formFieldInput: `bg-[hsl(220,30%,8%)] border-[${border}] text-[${textMain}] focus:ring-1 focus:ring-[${primary}]`,
    footerAction: `bg-[hsl(220,25%,8%)] border-t border-[${border}]`,
    dividerLine: `bg-[${border}]`,
    alert: `bg-[hsl(220,25%,12%)] border border-[${border}]`,
    otpCodeFieldInput: `border-[${border}] bg-[hsl(220,30%,8%)]`,
    formFieldRow: "gap-2",
    main: "gap-4",
  },
};

const clerkLocalization = {
  ...plPL,
  signIn: {
    ...plPL.signIn,
    start: {
      ...((plPL.signIn as any)?.start ?? {}),
      title: "Witaj ponownie",
      subtitle: "Zaloguj się, aby kontynuować",
    },
  },
  signUp: {
    ...plPL.signUp,
    start: {
      ...((plPL.signUp as any)?.start ?? {}),
      title: "Utwórz konto",
      subtitle: "Dołącz do DocSage już dziś",
    },
  },
  formFieldInputPlaceholder__password: "Wprowadź swoje hasło",
  formFieldInputPlaceholder__newPassword: "Utwórz hasło",
  formFieldInputPlaceholder__confirmPassword: "Potwierdź hasło",
  formFieldInputPlaceholder__emailAddress: "Wprowadź adres email",
};


function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Landing />
      </Show>
    </>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <Layout>
          <Component />
        </Layout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function HideDevBadge() {
  useEffect(() => {
    const hide = () => {
      // Target Clerk's development mode badge by various methods
      document.querySelectorAll<HTMLElement>(
        '[data-localization-key="badge__devMode"], .cl-badge, [class*="devBadge"], [class*="dev-badge"]'
      ).forEach(el => { el.style.display = "none"; });

      // Also find by link href pointing to Clerk docs about dev mode
      document.querySelectorAll<HTMLElement>('a[href*="clerk.com/docs/deployments"]').forEach(el => {
        const parent = el.closest('[class*="cl-"]') ?? el.parentElement;
        if (parent) (parent as HTMLElement).style.display = "none";
      });

      // Fallback: find elements with "Development mode" text
      document.querySelectorAll<HTMLElement>('*').forEach(el => {
        if (el.children.length === 0 && el.textContent?.trim() === 'Development mode') {
          const wrapper = el.closest('[class*="cl-"]') ?? el.parentElement;
          if (wrapper) (wrapper as HTMLElement).style.display = "none";
        }
      });
    };
    hide();
    const obs = new MutationObserver(hide);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);
  return null;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
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
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      localization={clerkLocalization}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <HideDevBadge />
          <ClerkQueryClientCacheInvalidator />
          <AppRoutes />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}
