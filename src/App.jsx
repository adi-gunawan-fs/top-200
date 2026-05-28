import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, KeyRound, LogOut, Settings } from "lucide-react";
import LoginPage from "./components/LoginPage";
import BrandListPage from "./components/BrandListPage";
import LargeBrandDishPage from "./components/LargeBrandDishPage";
import ExperimentPage from "./components/ExperimentPage";
import { ChangePasswordModal } from "./components/ui/ChangePasswordModal";
import { SettingsModal } from "./components/ui/SettingsModal";
import { getSession, onAuthStateChange, signOut } from "./lib/auth";
import { WeightsProvider } from "./contexts/WeightsContext";

const MODE_LARGE_BRAND = "large-brand";
const MODE_EXPERIMENT = "experiment";
const IS_LOCAL_ENV = String(import.meta.env.VITE_LOCAL_ENV).toLowerCase() === "true";
const ROUTES = {
  [MODE_LARGE_BRAND]: "/top-200/large-brand-list",
  [MODE_EXPERIMENT]: "/top-200/experiments",
};

function getDefaultMode() {
  return IS_LOCAL_ENV ? MODE_LARGE_BRAND : MODE_EXPERIMENT;
}

function getModeFromPathname(pathname) {
  if (pathname === ROUTES[MODE_LARGE_BRAND]) return MODE_LARGE_BRAND;
  if (pathname === ROUTES[MODE_EXPERIMENT]) return MODE_EXPERIMENT;
  return null;
}

function App() {
  const [session, setSession] = useState(undefined);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const topMenuRef = useRef(null);

  const [mode, setMode] = useState(() => getModeFromPathname(window.location.pathname) ?? getDefaultMode());
  const [selectedLargeBrand, setSelectedLargeBrand] = useState(null);

  useEffect(() => {
    getSession().then(setSession).catch(() => setSession(null));
    const unsubscribe = onAuthStateChange(setSession);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (topMenuRef.current && !topMenuRef.current.contains(event.target)) {
        setTopMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    const syncRoute = (nextMode, { replace = false } = {}) => {
      const nextPath = ROUTES[nextMode];
      if (!nextPath || window.location.pathname === nextPath) return;
      const method = replace ? "replaceState" : "pushState";
      window.history[method]({}, "", nextPath);
    };

    const initialMode = getModeFromPathname(window.location.pathname);
    if (!initialMode) {
      const fallbackMode = getDefaultMode();
      setMode(fallbackMode);
      syncRoute(fallbackMode, { replace: true });
    }

    const handlePopState = () => {
      const nextMode = getModeFromPathname(window.location.pathname) ?? getDefaultMode();
      setMode(nextMode);
      setSelectedLargeBrand(null);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleSwitchMode = useCallback((newMode) => {
    setMode(newMode);
    setSelectedLargeBrand(null);
    const nextPath = ROUTES[newMode];
    if (nextPath && window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    setSelectedLargeBrand(null);
  }, []);

  if (session === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-xs text-slate-500">Loading...</p>
      </main>
    );
  }

  if (!session) return <LoginPage />;

  const showBrandList = IS_LOCAL_ENV && mode === MODE_LARGE_BRAND;
  const workspaceOptions = [
    { id: MODE_LARGE_BRAND, label: "Large Brand", enabled: IS_LOCAL_ENV },
    { id: MODE_EXPERIMENT, label: "Experiment", enabled: true },
  ].filter((option) => option.enabled);

  return (
    <WeightsProvider userId={session.user.id}>
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <header className="sticky top-0 z-[200] border-b border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4">
            <div className="flex min-h-14 items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-5">
                <p className="truncate text-base font-semibold italic text-slate-900">Report - FoodStyles</p>

                <nav className="hidden items-center gap-2 md:flex" aria-label="Primary">
                  <div className="relative" ref={topMenuRef}>
                    <button
                      type="button"
                      onClick={() => setTopMenuOpen((v) => !v)}
                      className={`border-b-2 px-3 py-4 text-sm transition-colors ${topMenuOpen ? "border-blue-500 text-blue-600" : "border-blue-500 text-blue-600"}`}
                    >
                      Top 200
                    </button>

                    {topMenuOpen ? (
                      <div className="absolute left-0 top-full z-[260] mt-1 w-44 overflow-hidden rounded-sm border border-slate-200 bg-white shadow-lg">
                        {workspaceOptions.map((option) => {
                          const optionActive = option.id === mode;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => {
                                handleSwitchMode(option.id);
                                setTopMenuOpen(false);
                              }}
                              className={`flex w-full items-center gap-2 px-4 py-3 text-left text-sm transition-colors ${
                                optionActive
                                  ? "text-blue-600 hover:bg-blue-50"
                                  : "text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              <span>{option.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </nav>
              </div>

              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-100"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold uppercase text-slate-600">
                    {session.user.email?.[0] ?? "?"}
                  </div>
                  <span className="hidden max-w-[160px] truncate text-xs text-slate-600 lg:block">
                    {session.user.email}
                  </span>
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </button>

                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 top-[calc(100%+4px)] z-[250] w-48 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md">
                      <div className="border-b border-slate-100 px-3 py-2">
                        <p className="truncate text-[10px] text-slate-400">{session.user.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          setSettingsOpen(true);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        <Settings className="h-3.5 w-3.5 text-slate-400" />
                        Settings
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          setChangePasswordOpen(true);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        <KeyRound className="h-3.5 w-3.5 text-slate-400" />
                        Change Password
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          handleSignOut();
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

        </header>

        {changePasswordOpen && <ChangePasswordModal onClose={() => setChangePasswordOpen(false)} />}
        {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

        <div className="flex flex-col gap-4 p-4">
          {showBrandList && selectedLargeBrand ? (
            <LargeBrandDishPage
              brand={selectedLargeBrand}
              viewMode={selectedLargeBrand.viewMode ?? "latest"}
              onBack={() => setSelectedLargeBrand(null)}
              sessionUserId={session.user.id}
            />
          ) : showBrandList ? (
            <BrandListPage
              onBack={() => setSelectedLargeBrand(null)}
              onSelectBrand={(brand, viewMode) => setSelectedLargeBrand({ ...brand, viewMode })}
            />
          ) : mode === MODE_EXPERIMENT ? (
            <ExperimentPage sessionUserId={session.user.id} />
          ) : (
            <BrandListPage
              onBack={() => setSelectedLargeBrand(null)}
              onSelectBrand={(brand, viewMode) => setSelectedLargeBrand({ ...brand, viewMode })}
            />
          )}
        </div>
      </div>
    </WeightsProvider>
  );
}

export default App;
