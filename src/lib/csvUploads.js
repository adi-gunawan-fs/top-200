import { supabase } from "./supabase";

const BUCKET = "csv-uploads";
const TABLE = "csv_uploads";

export async function listUploads() {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, name, file_path, uploaded_by, uploaded_at")
    .order("uploaded_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function saveUpload(name, file, userId) {
  const safeName = name.trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
  const timestamp = Date.now();
  const ext = file.name.endsWith(".gz") ? ".csv.gz" : ".csv";
  const filePath = `${timestamp}_${safeName}${ext}`;

  const contentType = file.name.endsWith(".gz") ? "application/gzip" : "text/csv";
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, { contentType, upsert: false });

  if (uploadError) throw uploadError;

  const { data, error: insertError } = await supabase
    .from(TABLE)
    .insert({ name: name.trim(), file_path: filePath, uploaded_by: userId })
    .select("id, name, file_path, uploaded_by, uploaded_at")
    .single();

  if (insertError) {
    await supabase.storage.from(BUCKET).remove([filePath]);
    throw insertError;
  }

  return data;
}

export async function deleteUpload(upload) {
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([upload.file_path]);

  if (storageError) throw storageError;

  const { error: dbError } = await supabase
    .from(TABLE)
    .delete()
    .eq("id", upload.id);

  if (dbError) throw dbError;
}

export async function fetchCsvFile(filePath) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(filePath);

  if (error) throw error;

  if (filePath.endsWith(".gz")) {
    const ds = new DecompressionStream("gzip");
    const writer = ds.writable.getWriter();
    writer.write(await data.arrayBuffer());
    writer.close();
    const chunks = [];
    const reader = ds.readable.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const bytes = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0));
    let off = 0;
    for (const c of chunks) { bytes.set(c, off); off += c.length; }
    const csvName = filePath.split("/").pop().replace(/\.gz$/, "");
    return new File([bytes], csvName, { type: "text/csv" });
  }

  return new File([data], filePath.split("/").pop(), { type: "text/csv" });
}
