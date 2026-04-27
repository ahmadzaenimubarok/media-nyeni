/**
 * Menghasilkan slug dari sebuah string.
 * @param {string} str - String yang akan diubah menjadi slug.
 * @returns {string} Slug yang dihasilkan.
 */
export const slugify = (str) => {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Hapus karakter non-word (kecuali spasi dan dash)
    .replace(/[\s_-]+/g, "-") // Ganti spasi dan underscore dengan dash tunggal
    .replace(/^-+|-+$/g, ""); // Hapus dash di awal dan akhir
};

/**
 * Menghasilkan slug untuk nama file dengan tetap mempertahankan ekstensi.
 * @param {string} filename - Nama file lengkap (misal: "Dokumen Saya.pdf").
 * @returns {string} Nama file yang sudah di-slugify (misal: "dokumen-saya.pdf").
 */
export const slugifyFile = (filename) => {
  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex === -1) return slugify(filename);

  const name = filename.substring(0, lastDotIndex);
  const ext = filename.substring(lastDotIndex + 1);
  
  // Ganti titik di bagian nama dengan dash agar tetap terbaca sebagai pemisah
  const nameWithDashes = name.replace(/\./g, "-");
  
  return slugify(nameWithDashes) + "." + ext.toLowerCase();
};
