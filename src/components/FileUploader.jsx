import { useCallback, useState } from "react";
import { Upload } from "lucide-react";

function FileUploader({ fileName, loading, onFileSelect, inline = false }) {
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback(
    (files) => {
      if (!files?.length) {
        return;
      }

      const [file] = files;
      if (!file || !file.name.toLowerCase().endsWith(".csv")) {
        return;
      }

      onFileSelect(file);
    },
    [onFileSelect],
  );

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      setDragActive(false);
      handleFiles(event.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleChange = useCallback(
    (event) => {
      handleFiles(event.target.files);
      event.target.value = "";
    },
    [handleFiles],
  );

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((event) => {
    event.preventDefault();
    setDragActive(false);
  }, []);

  const containerClass = inline ? "" : "rounded-lg border border-slate-200 bg-white p-4 shadow-sm";
  const dropzoneClass = `rounded-md border border-dashed px-3 py-2 text-center transition ${
    dragActive ? "border-blue-400 bg-blue-50" : "border-slate-300 bg-slate-50"
  }`;

  return (
    <section className={containerClass}>
      <div
        className={dropzoneClass}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <label className="flex cursor-pointer items-center justify-center gap-2 text-slate-700">
          <Upload className="h-4 w-4" />
          <span className="text-xs font-medium">Drop CSV here or click to upload</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            disabled={loading}
            onChange={handleChange}
          />
        </label>
      </div>

      <div className={`text-xs text-slate-600 ${inline ? "mt-1 text-right" : "mt-2"}`}>
        {fileName ? `Loaded file: ${fileName}` : "No file uploaded"}
      </div>
    </section>
  );
}

export default FileUploader;
