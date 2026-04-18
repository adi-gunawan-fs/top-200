import { useCallback, useState } from "react";
import FileUploader from "./components/FileUploader";
import SummaryTable from "./components/SummaryTable";
import BrandComparePage from "./components/BrandComparePage";
import { parseCsv } from "./utils/parseCsv";
import { createMenuGrouper } from "./utils/groupByMenu";

function App() {
  const [fileName, setFileName] = useState("");
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileSelect = useCallback(async (file) => {
    setLoading(true);
    setError("");
    setGroups([]);
    setSelectedGroup(null);
    setFileName(file.name);

    const grouper = createMenuGrouper();

    try {
      await parseCsv(file, {
        onRow: (row) => {
          grouper.addRow(row);
        },
      });

      setGroups(grouper.finalize());
    } catch {
      setError("Unable to parse this CSV file.");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-800">
      <div className="flex w-full flex-col gap-4">
        <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-lg font-semibold">Top 200 Brands</h1>
              <p className="mt-1 text-xs text-slate-600">Upload one CSV and review grouped menu metadata by menu ID.</p>
            </div>
            <div className="w-full lg:w-[380px]">
              <FileUploader fileName={fileName} loading={loading} onFileSelect={handleFileSelect} inline />
            </div>
          </div>
        </header>

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
    </main>
  );
}

export default App;
