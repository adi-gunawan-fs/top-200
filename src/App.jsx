import { useCallback, useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import LoginPage from "./components/LoginPage";
import SummaryTable from "./components/SummaryTable";
import BrandComparePage from "./components/BrandComparePage";
import UploadSelector from "./components/UploadSelector";
import { parseCsv } from "./utils/parseCsv";
import { createMenuGrouper } from "./utils/groupByMenu";
import { getSession, onAuthStateChange, signOut } from "./lib/auth";
import { fetchCsvFile } from "./lib/csvUploads";

function App() {
  const [session, setSession] = useState(undefined);
  const [activeUpload, setActiveUpload] = useState(null);
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

  const handleSignOut = useCallback(async () => {
    await signOut();
    setActiveUpload(null);
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

  if (!session) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-900">
              <span className="text-[11px] font-bold text-white">T2</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">Top 200 Brands</span>
              <span className="hidden h-4 w-px bg-slate-200 sm:block" />
              <span className="hidden text-xs text-slate-400 sm:block">Menu Review</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <UploadSelector
              session={session}
              activeUploadId={activeUpload?.id ?? null}
              onUploadSelect={handleUploadSelect}
              onFileReady={handleFileReady}
            />
            <span className="hidden h-4 w-px bg-slate-200 sm:block" />
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold uppercase text-slate-600">
                {session.user.email?.[0] ?? "?"}
              </div>
              <span className="hidden max-w-[160px] truncate text-xs text-slate-500 lg:block">
                {session.user.email}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-screen-2xl flex-col gap-4 p-4">
        {error ? (
          <section className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 shadow-sm">
            {error}
          </section>
        ) : null}

        {selectedGroup ? (
          <BrandComparePage group={selectedGroup} onBack={() => setSelectedGroup(null)} />
        ) : (
          <SummaryTable groups={groups} loading={loading} onSelectGroup={setSelectedGroup} />
        )}
      </div>
    </div>
  );
}

export default App;
