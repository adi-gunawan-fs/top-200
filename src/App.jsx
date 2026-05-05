import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Database, KeyRound, LogOut, Settings, Upload } from "lucide-react";
import LoginPage from "./components/LoginPage";
import SummaryTable from "./components/SummaryTable";
import BrandComparePage from "./components/BrandComparePage";
import BrandPickerPage from "./components/BrandPickerPage";
import UploadSelector from "./components/UploadSelector";
import { EmptyState } from "./components/ui/EmptyState";
import { ChangePasswordModal } from "./components/ui/ChangePasswordModal";
import { SettingsModal } from "./components/ui/SettingsModal";
import { parseCsv } from "./utils/parseCsv";
import { createMenuGrouper } from "./utils/groupByMenu";
import { getSession, onAuthStateChange, signOut } from "./lib/auth";
import { fetchCsvFile } from "./lib/csvUploads";
import { fetchMenuMessages } from "./lib/dbFetch";
import { WeightsProvider } from "./contexts/WeightsContext";

const MODE_CSV = "csv";
const MODE_DB = "db";

function App() {
  const [session, setSession] = useState(undefined);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  const [mode, setMode] = useState(MODE_CSV);
  const [activeUpload, setActiveUpload] = useState(null);
  const [activeBrand, setActiveBrand] = useState(null);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getSession().then(setSession).catch(() => setSession(null));
    const unsubscribe = onAuthStateChange(setSession);
    return unsubscribe;
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
    if (!upload) { setGroups([]); setSelectedGroup(null); return; }
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

  // Called when user clicks a menu row in BrandPickerPage — navigate immediately then fetch
  const handleSelectMenuRow = useCallback(async (row) => {
    setActiveBrand({ id: row.brandId, name: row.brandName });
    setSelectedGroup(null);
    setGroups([]);
    setLoading(true);
    setError("");

    try {
      const records = await fetchMenuMessages(row.menuId);
      if (records.length === 0) {
        setError(`No messages found for menu ${row.menuId} since Jan 2025.`);
        setLoading(false);
        return;
      }

      const grouper = createMenuGrouper();
      records.forEach((r) => grouper.addRow(r));
      const finalGroups = grouper.finalize();
      setGroups(finalGroups);
      setSelectedGroup(finalGroups[0] ?? null);
    } catch (err) {
      setError(err.message ?? "Failed to fetch messages.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSwitchMode = useCallback((newMode) => {
    setMode(newMode);
    setGroups([]);
    setSelectedGroup(null);
    setError("");
    setActiveBrand(null);
    setActiveUpload(null);
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    setActiveUpload(null);
    setActiveBrand(null);
    setGroups([]);
    setSelectedGroup(null);
  }, []);

  if (session === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-xs text-slate-500">Loading…</p>
      </main>
    );
  }

  if (!session) return <LoginPage />;

  const showBrandPicker = mode === MODE_DB && activeBrand === null;

  return (
    <WeightsProvider userId={session.user.id}>
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
        <div className="flex h-14 items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-900">
              <span className="text-[11px] font-semibold text-white">T2</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-slate-900">Top 200 Brands</span>
              <span className="hidden h-4 w-px bg-slate-200 sm:block" />
              <span className="hidden text-xs text-slate-500 sm:block">Menu Review</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => handleSwitchMode(MODE_CSV)}
                className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors ${mode === MODE_CSV ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                <Upload className="h-3 w-3" />
                CSV
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMode(MODE_DB)}
                className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors ${mode === MODE_DB ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                <Database className="h-3 w-3" />
                Database
              </button>
            </div>

            {mode === MODE_CSV ? (
              <UploadSelector
                session={session}
                activeUploadId={activeUpload?.id ?? null}
                onUploadSelect={handleUploadSelect}
                onFileReady={handleFileReady}
              />
            ) : null}

            {mode === MODE_DB && activeBrand ? (
              <button
                type="button"
                onClick={() => { setActiveBrand(null); setGroups([]); setSelectedGroup(null); setError(""); }}
                className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                <Database className="h-3 w-3 text-slate-400" />
                <span className="max-w-[160px] truncate">{activeBrand.name}</span>
                <span className="text-slate-300">×</span>
              </button>
            ) : null}

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
                  <div className="absolute right-0 top-[calc(100%+4px)] z-30 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md">
                    <div className="border-b border-slate-100 px-3 py-2">
                      <p className="truncate text-[10px] text-slate-400">{session.user.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setUserMenuOpen(false); setSettingsOpen(true); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      <Settings className="h-3.5 w-3.5 text-slate-400" />
                      Settings
                    </button>
                    <button
                      type="button"
                      onClick={() => { setUserMenuOpen(false); setChangePasswordOpen(true); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      <KeyRound className="h-3.5 w-3.5 text-slate-400" />
                      Change Password
                    </button>
                    <button
                      type="button"
                      onClick={() => { setUserMenuOpen(false); handleSignOut(); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>

            {changePasswordOpen && <ChangePasswordModal onClose={() => setChangePasswordOpen(false)} />}
            {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-4 p-4">
        {error ? <EmptyState message={error} tone="danger" /> : null}

        {selectedGroup ? (
          <BrandComparePage group={selectedGroup} onBack={() => {
            setSelectedGroup(null);
            if (mode === MODE_DB) {
              setActiveBrand(null);
              setGroups([]);
            }
          }} />
        ) : showBrandPicker ? (
          <BrandPickerPage
          onSelectRow={handleSelectMenuRow}
          session={session}
          onExportDone={(saved) => {
            setMode(MODE_CSV);
            setActiveBrand(null);
            handleUploadSelect(saved);
          }}
        />
        ) : loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-32">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500" />
            <p className="text-sm text-slate-500">Loading {activeBrand?.name}…</p>
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
