import Papa from "papaparse";

function toTimestamp(value) {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function parseCsv(file, { onRow, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    let rowCount = 0;
    let skippedRows = 0;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      worker: typeof Worker !== "undefined",
      step: (result) => {
        const row = result.data;
        rowCount += 1;

        if (!row?.message) {
          skippedRows += 1;
        } else {
          try {
            const message = JSON.parse(row.message);
            onRow?.({
              id: row.id,
              createdAt: row.createdAt,
              createdAtMs: toTimestamp(row.createdAt),
              updatedAt: row.updatedAt,
              updatedAtMs: toTimestamp(row.updatedAt),
              message,
            });
          } catch {
            skippedRows += 1;
          }
        }

        if (rowCount % 1000 === 0) {
          onProgress?.({ rowCount, skippedRows });
        }
      },
      complete: () => {
        onProgress?.({ rowCount, skippedRows, done: true });
        resolve({ rowCount, skippedRows });
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}
