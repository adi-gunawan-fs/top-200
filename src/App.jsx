import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, KeyRound, LogOut, Settings, Upload, Building2, FlaskConical } from "lucide-react";
import LoginPage from "./components/LoginPage";
import SummaryTable from "./components/SummaryTable";
import BrandComparePage from "./components/BrandComparePage";
import BrandListPage from "./components/BrandListPage";
import LargeBrandDishPage from "./components/LargeBrandDishPage";
import ExperimentPage from "./components/ExperimentPage";
import UploadSelector from "./components/UploadSelector";
import { EmptyState } from "./components/ui/EmptyState";
import { ChangePasswordModal } from "./components/ui/ChangePasswordModal";
import { SettingsModal } from "./components/ui/SettingsModal";
import { parseCsv } from "./utils/parseCsv";
import { createMenuGrouper } from "./utils/groupByMenu";
import { getSession, onAuthStateChange, signOut } from "./lib/auth";
import { fetchCsvFile } from "./lib/csvUploads";
import { WeightsProvider } from "./contexts/WeightsContext";

const MODE_CSV = "csv";
const MODE_LARGE_BRAND = "large-brand";
const MODE_EXPERIMENT = "experiment";
const IS_LOCAL_ENV = String(import.meta.env.VITE_LOCAL_ENV).toLowerCase() === "true";
const NAV_ITEMS = [
  { id: "brand-curation", label: "Brand curation tasks" },
  { id: "top-200", label: "Top 200" },
  { id: "misc", label: "Misc" },
];
const MISC_MENU_ITEMS = [
  { id: "users", label: "Users", disabled: true },
  { id: "about", label: "About" },
  { id: "documentation", label: "Documentation", disabled: true, hasChildren: true },
  { id: "priority", label: "Priority tasks", disabled: true },
  { id: "reports", label: "Reports", hasChildren: true, active: true },
];

function App() {
  const [session, setSession] = useState(undefined);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [miscMenuOpen, setMiscMenuOpen] = useState(false);
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const miscMenuRef = useRef(null);
  const topMenuRef = useRef(null);

  const [mode, setMode] = useState(MODE_CSV);
  const [activeUpload, setActiveUpload] = useState(null);
  const [selectedLargeBrand, setSelectedLargeBrand] = useState(null);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getSession().then(setSession).catch(() => setSession(null));
    const unsubscribe = onAuthStateChange(setSession);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (miscMenuRef.current && !miscMenuRef.current.contains(event.target)) {
        setMiscMenuOpen(false);
      }
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

  const parseFile = useCallback(async (file) => {
    setLoading(true);
    setError("");
    setGroups([]);
    setSelectedGroup(null);
    const grouper = createMenuGrouper();
    try {
      await parseCsv(file, { onRow: (row) => grouper.addRow(row) });
      setGroups(grouper.finalize());
    } catch {
      setError("Unable to parse this CSV file.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUploadSelect = useCallback(async (upload) => {
    setActiveUpload(upload);
    if (!upload) {
      setGroups([]);
      setSelectedGroup(null);
      return;
    }

    setLoading(true);
    setError("");
    setGroups([]);
    setSelectedGroup(null);
    try {
      const file = await fetchCsvFile(upload.file_path);
      await parseFile(file);
    } catch (err) {
      setError(err.message ?? "Failed to load the selected CSV.");
      setLoading(false);
    }
  }, [parseFile]);

  const handleFileReady = useCallback((file, upload) => {
    setActiveUpload(upload);
    parseFile(file);
  }, [parseFile]);

  const handleSwitchMode = useCallback((newMode) => {
    setMode(newMode);
    setGroups([]);
    setSelectedGroup(null);
    setError("");
    setActiveUpload(null);
    setSelectedLargeBrand(null);
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    setActiveUpload(null);
    setGroups([]);
    setSelectedGroup(null);
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
    { id: MODE_CSV, label: "Recent CSV", enabled: true },
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
                <p className="truncate text-lg font-semibold italic text-slate-900">Report - FoodStyles</p>

                <nav className="hidden items-center gap-2 md:flex" aria-label="Primary">
                  {NAV_ITEMS.map((item) => {
                    const isActive = item.id === "top-200";
                    if (item.id === "top-200") {
                      return (
                        <div key={item.id} className="relative" ref={topMenuRef}>
                          <button
                            type="button"
                            onClick={() => setTopMenuOpen((v) => !v)}
                            className={`border-b-2 px-3 py-4 text-sm transition-colors ${isActive || topMenuOpen ? "border-blue-500 text-blue-600" : "border-transparent text-slate-700 hover:text-slate-900"}`}
                          >
                            {item.label}
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
                      );
                    }

                    if (item.id === "misc") {
                      return (
                        <div key={item.id} className="relative" ref={miscMenuRef}>
                          <button
                            type="button"
                            onClick={() => setMiscMenuOpen((v) => !v)}
                            className={`border-b-2 px-3 py-4 text-sm transition-colors ${miscMenuOpen ? "border-blue-500 text-blue-600" : "border-transparent text-slate-700 hover:text-slate-900"}`}
                          >
                            {item.label}
                          </button>

                          {miscMenuOpen ? (
                            <div className="absolute left-0 top-full z-[260] mt-1 w-40 overflow-hidden rounded-sm border border-slate-200 bg-white shadow-lg">
                              {MISC_MENU_ITEMS.map((menuItem) => (
                                <button
                                  key={menuItem.id}
                                  type="button"
                                  disabled={menuItem.disabled}
                                  className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors ${
                                    menuItem.disabled
                                      ? "cursor-not-allowed text-slate-300"
                                      : menuItem.active
                                        ? "text-blue-600 hover:bg-blue-50"
                                        : "text-slate-700 hover:bg-slate-50"
                                  }`}
                                >
                                  <span>{menuItem.label}</span>
                                  {menuItem.hasChildren ? <ChevronRight className="h-3.5 w-3.5" /> : null}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    }

                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`border-b-2 px-3 py-4 text-sm transition-colors ${isActive ? "border-blue-500 text-blue-600" : "border-transparent text-slate-700 hover:text-slate-900"}`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
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

          <div className="bg-slate-50/80 px-4 py-2">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-700">
                    Active workspace
                  </span>
                  <span className="text-sm font-semibold text-slate-900">Top 200</span>
                </div>
                <p className="text-xs text-slate-500">
                  Recent CSV uploads, Large Brand review, and Experiment are grouped here as one Top 200 workflow.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {mode === MODE_CSV ? (
                  <UploadSelector
                    session={session}
                    activeUploadId={activeUpload?.id ?? null}
                    onUploadSelect={handleUploadSelect}
                    onFileReady={handleFileReady}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </header>

        {changePasswordOpen && <ChangePasswordModal onClose={() => setChangePasswordOpen(false)} />}
        {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

        <div className="flex flex-col gap-4 p-4">
          {error ? <EmptyState message={error} tone="danger" /> : null}

          {selectedGroup ? (
            <BrandComparePage
              group={selectedGroup}
              session={session}
              onExportDone={(saved) => {
                setMode(MODE_CSV);
                setSelectedGroup(null);
                handleUploadSelect(saved);
              }}
              onBack={() => {
                setSelectedGroup(null);
              }}
            />
          ) : showBrandList && selectedLargeBrand ? (
            <LargeBrandDishPage
              brand={selectedLargeBrand}
              viewMode={selectedLargeBrand.viewMode ?? "latest"}
              onBack={() => setSelectedLargeBrand(null)}
              sessionUserId={session.user.id}
            />
          ) : showBrandList ? (
            <BrandListPage
              onBack={() => handleSwitchMode(MODE_CSV)}
              onSelectBrand={(brand, viewMode) => setSelectedLargeBrand({ ...brand, viewMode })}
            />
          ) : mode === MODE_EXPERIMENT ? (
            <ExperimentPage sessionUserId={session.user.id} />
          ) : loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-32">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500" />
              <p className="text-sm text-slate-500">Loading...</p>
            </div>
          ) : (
            <SummaryTable groups={groups} loading={false} onSelectGroup={setSelectedGroup} />
          )}
        </div>
      </div>
    </WeightsProvider>
  );
}

export default App;
