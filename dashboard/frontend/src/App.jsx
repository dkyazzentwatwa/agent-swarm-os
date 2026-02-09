import { Suspense, lazy, useEffect, useState } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "./components/Layout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LoadingState } from "./components/Spinner";
import { useTheme } from "./hooks/useTheme";
import { isTauri, getAppSettings } from "./lib/transport";
import { FirstLaunchModal } from "@/components/FirstLaunchModal";

const MissionControl = lazy(() => import("./pages/MissionControl"));
const Comms = lazy(() => import("./pages/CoffeeRoom"));
const Artifacts = lazy(() => import("./pages/ContentGallery"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Help = lazy(() => import("./pages/Help"));
const Setup = lazy(() => import("./pages/Setup"));
const Settings = lazy(() => import("./pages/Settings"));
const Summary = lazy(() => import("./pages/Summary"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

function RouteFallback() {
  return (
    <div className="p-8">
      <LoadingState message="Loading dashboard view..." />
    </div>
  );
}

/**
 * Wrapper component that combines ErrorBoundary and Suspense for routes
 * Catches errors and shows fallback while lazy loading
 */
function RouteWrapper({ children }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

function useTauriFileChangeBridge() {
  useEffect(() => {
    if (!isTauri()) return undefined;

    let unlisten = null;
    let cancelled = false;

    const invalidateByPrefix = (prefix) => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query?.queryKey) && query.queryKey[0] === prefix,
      });
    };

    const subscribe = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        if (cancelled) return;

        unlisten = await listen("file-changed", (event) => {
          const kind = event?.payload?.kind;

          if (kind === "teams") {
            invalidateByPrefix("comms");
            invalidateByPrefix("health");
            return;
          }

          if (kind === "tasks") {
            invalidateByPrefix("tasks");
            invalidateByPrefix("agents");
            invalidateByPrefix("health");
            return;
          }

          if (kind === "workspaces") {
            invalidateByPrefix("workspace");
            invalidateByPrefix("tasks");
            invalidateByPrefix("agents");
            invalidateByPrefix("artifacts");
            invalidateByPrefix("summary");
            invalidateByPrefix("health");
            invalidateByPrefix("setup-status");
            return;
          }

          queryClient.invalidateQueries();
        });
      } catch {
        // Ignore event bridge errors and rely on polling as fallback.
      }
    };

    subscribe();

    return () => {
      cancelled = true;
      if (typeof unlisten === "function") {
        unlisten();
      }
    };
  }, []);
}

export default function App() {
  const { activeTheme, cycleTheme } = useTheme();
  const [needsConfiguration, setNeedsConfiguration] = useState(false);
  const [checkingConfig, setCheckingConfig] = useState(true);
  useTauriFileChangeBridge();

  useEffect(() => {
    async function checkConfig() {
      try {
        const settings = await getAppSettings();
        setNeedsConfiguration(settings.needsConfiguration || false);
      } catch (error) {
        console.error("Failed to load settings:", error);
        // On error, assume needs configuration
        setNeedsConfiguration(true);
      } finally {
        setCheckingConfig(false);
      }
    }
    checkConfig();
  }, []);

  if (checkingConfig) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--surface-1)]">
        <p className="text-sm text-[var(--text-secondary)]">Loading configuration...</p>
      </div>
    );
  }

  if (needsConfiguration) {
    return <FirstLaunchModal onComplete={() => window.location.reload()} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          <Route
            element={
              <Layout
                activeThemeLabel={activeTheme?.label || "Theme"}
                onToggleTheme={cycleTheme}
              />
            }
          >
            <Route
              index
              element={
                <RouteWrapper>
                  <MissionControl />
                </RouteWrapper>
              }
            />
            <Route
              path="comms"
              element={
                <RouteWrapper>
                  <Comms />
                </RouteWrapper>
              }
            />
            <Route
              path="artifacts"
              element={
                <RouteWrapper>
                  <Artifacts />
                </RouteWrapper>
              }
            />
            <Route
              path="analytics"
              element={
                <RouteWrapper>
                  <Analytics />
                </RouteWrapper>
              }
            />
            <Route
              path="tasks"
              element={
                <RouteWrapper>
                  <Tasks />
                </RouteWrapper>
              }
            />
            <Route
              path="summary"
              element={
                <RouteWrapper>
                  <Summary />
                </RouteWrapper>
              }
            />
            <Route
              path="help"
              element={
                <RouteWrapper>
                  <Help />
                </RouteWrapper>
              }
            />
            <Route
              path="setup"
              element={
                <RouteWrapper>
                  <Setup />
                </RouteWrapper>
              }
            />
            <Route
              path="settings"
              element={
                <RouteWrapper>
                  <Settings />
                </RouteWrapper>
              }
            />

            {/* Legacy route aliases */}
            <Route path="coffee-room" element={<Navigate to="/comms" replace />} />
            <Route path="content" element={<Navigate to="/artifacts" replace />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  );
}
