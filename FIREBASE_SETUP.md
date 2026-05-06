# Firebase Setup

Project ini sekarang memakai kombinasi berikut:

- `Firebase Authentication` untuk login password
- `Cloud Firestore` untuk profil user, role, absensi, dan pengaturan jadwal

## 1. Authentication

Aktifkan provider `Email/Password` di Firebase Authentication.

Setiap akun wajib dibuat di Authentication. Gunakan email yang sama dengan field `email` di Firestore.

Contoh:

- Admin 1: `admin1@sekolah.com`
- Admin 2: `admin2@sekolah.com`
- User 1: `user1@sekolah.com`

## 2. Collection Firestore

Gunakan struktur berikut:

### `login_index/{nisn}`

Dokumen ini dipakai saat halaman login masih meminta `NISN`, tetapi password divalidasi oleh Firebase Authentication.

Contoh:

```json
{
  "email": "admin1@sekolah.com"
}
```

ID dokumen harus sama dengan nilai `nisn`.

### `users/{authUid}`

ID dokumen harus sama dengan `uid` dari Firebase Authentication.

Contoh admin:

```json
{
  "nisn": "9990001111",
  "name": "Admin Sekolah",
  "kelas": "-",
  "jurusan": "-",
  "tanggalLahir": "-",
  "email": "admin1@sekolah.com",
  "phone": "081234567890",
  "alamat": "Kantor Sekolah",
  "avatar": "https://example.com/admin1.jpg",
  "role": "admin"
}
```

Contoh user:

```json
{
  "nisn": "0098331428",
  "name": "Yona",
  "kelas": "XI RPL 1",
  "jurusan": "RPL",
  "tanggalLahir": "10 Januari 2008",
  "email": "user1@sekolah.com",
  "phone": "081234567891",
  "alamat": "Malang",
  "avatar": "https://example.com/user1.jpg",
  "role": "user"
}
```

### `app_settings/attendance`

Dokumen ini adalah sumber pengaturan global yang dibaca semua user saat absen. Saat admin mengubah jadwal, radius, atau lokasi, perubahan akan ikut terbaca client lewat listener real-time.

```json
{
  "name": "Jadwal Utama",
  "radiusMeters": 200,
  "location": {
    "latitude": -7.970912713681007,
    "longitude": 112.66839168592233,
    "name": "Perumda Air Minum Tirta Tugu Malang"
  },
  "weeklySchedule": {
    "senin": { "isActive": true, "checkIn": "08:00", "checkOut": "16:00" },
    "selasa": { "isActive": true, "checkIn": "08:00", "checkOut": "16:00" },
    "rabu": { "isActive": true, "checkIn": "08:00", "checkOut": "16:00" },
    "kamis": { "isActive": true, "checkIn": "08:00", "checkOut": "16:00" },
    "jumat": { "isActive": true, "checkIn": "08:00", "checkOut": "15:00" },
    "sabtu": { "isActive": false, "checkIn": null, "checkOut": null },
    "minggu": { "isActive": false, "checkIn": null, "checkOut": null }
  }
}
```

### `attendance/{nisn_yyyy-mm-dd}`

Contoh:

```json
{
  "id": "0098331428_2026-04-18",
  "date": "2026-04-18",
  "dateLabel": "18 April 2026",
  "dateValue": 1776470400000,
  "school": "SMK NEGERI 1 KEPANJEN",
  "checkInTime": "07.58",
  "checkOutTime": null,
  "status": "hadir",
  "photoUri": "data:image/jpeg;base64,...",
  "userNisn": "0098331428"
}
```

## 3. Cara Menambah Admin dan User

1. Buat akun dulu di Firebase Authentication.
2. Salin `uid` akun tersebut.
3. Buat dokumen di `login_index/{nisn}` lalu isi field `email`.
4. Buat dokumen di collection `users` dengan ID = `uid`.
5. Isi field profil dan set `role` menjadi `admin` atau `user`.

Kalau ada dua admin dan banyak user, semuanya tetap disimpan di collection `users`. Pembedanya hanya field `role`.

Admin pertama biasanya dibuat langsung dari Firebase Console karena rules baru mengizinkan admin untuk mengelola data user dari aplikasi.

## 4. Cara Login di Aplikasi

UI login tetap memakai `NISN + password`.

Alurnya:

1. App membaca `login_index/{nisn}` untuk mengambil `email`.
2. App login ke Firebase Authentication memakai `email + password`.
3. Setelah berhasil, app membaca `users/{authUid}` untuk mengambil profil dan role.

## 5. Deploy Rules

Setelah isi data Firebase, deploy rules:

```bash
npm run deploy:rules
```

Rules sekarang diatur agar:

- admin bisa membaca profil user dan mengubah `app_settings/attendance`
- user biasa hanya bisa membaca profil sendiri
- user hanya bisa membaca dan menulis absensi miliknya
- semua user yang sudah login bisa membaca settings jadwal aktif
