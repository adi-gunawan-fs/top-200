import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Trash2, ChevronDown } from "lucide-react";
import { listUploads, saveUpload, deleteUpload } from "../lib/csvUploads";
import { formatDate } from "../utils/formatDate";

function UploadSelector({ session, activeUploadId, onUploadSelect, onFileReady }) {
  const [uploads, setUploads] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [uploadName, setUploadName] = useState("");
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const loadUploads = useCallback(async () => {
    setLoadingList(true);
    setError("");
    try {
      const data = await listUploads();
      setUploads(data);
    } catch (err) {
      setError(err.message ?? "Failed to load uploads.");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadUploads();
  }, [loadUploads]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleFileChange = useCallback((event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.name.toLowerCase().endsWith(".csv")) return;

    const suggested = file.name.replace(/\.csv$/i, "").replace(/[_-]+/g, " ").trim();
    setPendingFile(file);
    setUploadName(suggested);
  }, []);

  const handleSave = useCallback(async () => {
    if (!pendingFile || !uploadName.trim()) return;

    setUploading(true);
    setError("");

    try {
      const saved = await saveUpload(uploadName, pendingFile, session.user.id);
      setUploads((prev) => [saved, ...prev]);
      setPendingFile(null);
      setUploadName("");
      onUploadSelect(saved);
      onFileReady(pendingFile, saved);
      setOpen(false);
    } catch (err) {
      setError(err.message ?? "Upload failed.");
    } finally {
      setUploading(false);
    }
  }, [pendingFile, uploadName, session, onUploadSelect, onFileReady]);

  const handleDelete = useCallback(async (event, upload) => {
    event.stopPropagation();
    setDeletingId(upload.id);
    setError("");

    try {
      await deleteUpload(upload);
      setUploads((prev) => prev.filter((u) => u.id !== upload.id));
      if (activeUploadId === upload.id) {
        onUploadSelect(null);
      }
    } catch (err) {
      setError(err.message ?? "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }, [activeUploadId, onUploadSelect]);

  const handleSelectUpload = useCallback((upload) => {
    onUploadSelect(upload);
    setOpen(false);
  }, [onUploadSelect]);

  const activeUpload = uploads.find((u) => u.id === activeUploadId);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className="max-w-[200px] truncate">
          {activeUpload ? activeUpload.name : "Select a CSV upload"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-80 rounded-lg border border-slate-200 bg-white shadow-md">
          <div className="border-b border-slate-200 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Saved Uploads</p>
          </div>

          {error ? (
            <p className="px-3 py-2 text-xs text-rose-600">{error}</p>
          ) : null}

          <div className="max-h-60 overflow-y-auto">
            {loadingList ? (
              <p className="px-3 py-3 text-xs text-slate-500">Loading…</p>
            ) : uploads.length === 0 ? (
              <p className="px-3 py-3 text-xs text-slate-500">No uploads yet.</p>
            ) : (
              uploads.map((upload) => {
                const isActive = upload.id === activeUploadId;
                const isDeleting = deletingId === upload.id;
                return (
                  <div
                    key={upload.id}
                    onClick={() => handleSelectUpload(upload)}
                    className={`flex cursor-pointer items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 last:border-b-0 hover:bg-slate-50 ${isActive ? "bg-blue-50" : ""}`}
                  >
                    <div className="min-w-0">
                      <p className={`truncate text-xs font-medium ${isActive ? "text-blue-700" : "text-slate-800"}`}>
                        {upload.name}
                      </p>
                      <p className="text-[10px] text-slate-400">{formatDate(upload.uploaded_at)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, upload)}
                      disabled={isDeleting}
                      className="shrink-0 rounded border border-slate-200 p-1 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Delete upload"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-slate-200 p-3">
            {pendingFile ? (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] text-slate-500">Name this upload:</p>
                <input
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="e.g. April 2025 snapshot"
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!uploadName.trim() || uploading}
                    className="flex-1 rounded-md border border-blue-300 bg-blue-50 px-2 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {uploading ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPendingFile(null); setUploadName(""); }}
                    disabled={uploading}
                    className="rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600 hover:bg-slate-100">
                <Upload className="h-3.5 w-3.5 shrink-0" />
                <span>Upload new CSV</span>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default UploadSelector;
