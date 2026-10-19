// Heuristik "lokasi tak biasa": kota GA4 yang tidak ada di daftar ini ditandai untuk divalidasi.
// GA4 connector hanya menyimpan nama kota (tanpa negara); tambahkan kota Indonesia bila muncul false positive.
export const ID_CITIES = new Set(
  [
    "Kudus", "Jepara", "Pati", "Demak", "Rembang", "Blora", "Grobogan", "Purwodadi", "Semarang", "Salatiga", "Kendal", "Ungaran",
    "Surakarta", "Solo", "Klaten", "Boyolali", "Sukoharjo", "Karanganyar", "Sragen", "Wonogiri", "Magelang", "Temanggung", "Wonosobo",
    "Purworejo", "Kebumen", "Banjarnegara", "Purbalingga", "Purwokerto", "Banyumas", "Cilacap", "Tegal", "Brebes", "Pemalang",
    "Pekalongan", "Batang", "Yogyakarta", "Sleman", "Bantul", "Jakarta", "Bogor", "Depok", "Tangerang", "Bekasi", "Bandung",
    "Cimahi", "Cirebon", "Tasikmalaya", "Sukabumi", "Karawang", "Serang", "Cilegon", "Surabaya", "Malang", "Sidoarjo", "Gresik",
    "Kediri", "Madiun", "Jember", "Banyuwangi", "Tuban", "Bojonegoro", "Lamongan", "Mojokerto", "Pasuruan", "Probolinggo",
    "Blitar", "Tulungagung", "Denpasar", "Mataram", "Kupang", "Medan", "Pekanbaru", "Padang", "Palembang", "Jambi", "Bengkulu",
    "Bandar Lampung", "Batam", "Pontianak", "Banjarmasin", "Balikpapan", "Samarinda", "Palangkaraya", "Makassar", "Manado",
    "Palu", "Kendari", "Gorontalo", "Ambon", "Jayapura", "Sorong", "Banda Aceh",
  ].map((c) => c.toLowerCase()),
);

export const isIndonesianCity = (city: string) => ID_CITIES.has(city.trim().toLowerCase());
