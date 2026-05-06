export const COLORS = {
  primary: "#1B3A7B",
  primaryDark: "#0F2555",
  primaryLight: "#2B5AAB",
  white: "#FFFFFF",
  background: "#F0F4F8",
  card: "#FFFFFF",
  text: "#1A1A2E",
  textSecondary: "#6B7280",
  green: "#22C55E",
  greenLight: "#DCFCE7",
  orange: "#F97316",
  orangeLight: "#FFF7ED",
  red: "#EF4444",
  redLight: "#FEE2E2",
  blue: "#3B82F6",
  blueLight: "#DBEAFE",
  border: "#E5E7EB",
  inputBg: "#F9FAFB",
  shadow: "#000000",
};

export const DAY_ORDER = [
  "senin",
  "selasa",
  "rabu",
  "kamis",
  "jumat",
  "sabtu",
  "minggu",
];

export const DAY_LABELS = {
  senin: "Senin",
  selasa: "Selasa",
  rabu: "Rabu",
  kamis: "Kamis",
  jumat: "Jumat",
  sabtu: "Sabtu",
  minggu: "Minggu",
};

export const DEFAULT_TARGET_LOCATION = {
  latitude: -7.970912713681007,
  longitude: 112.66839168592233,
  name: "Perumda Air Minum Tirta Tugu Malang",
};

export const DEFAULT_ALLOWED_RADIUS_METERS = 200;

export const DEFAULT_WEEKLY_SCHEDULE = {
  senin: { isActive: true, checkIn: "08:00", checkOut: "16:00" },
  selasa: { isActive: true, checkIn: "08:00", checkOut: "16:00" },
  rabu: { isActive: true, checkIn: "08:00", checkOut: "16:00" },
  kamis: { isActive: true, checkIn: "08:00", checkOut: "16:00" },
  jumat: { isActive: true, checkIn: "08:00", checkOut: "15:00" },
  sabtu: { isActive: false, checkIn: null, checkOut: null },
  minggu: { isActive: false, checkIn: null, checkOut: null },
};

export const DEFAULT_ATTENDANCE_SETTINGS = {
  name: "Default Schedule",
  radiusMeters: DEFAULT_ALLOWED_RADIUS_METERS,
  location: DEFAULT_TARGET_LOCATION,
  weeklySchedule: DEFAULT_WEEKLY_SCHEDULE,
};

export const SCHOOL_NAME = "SMK NEGERI 1 KEPANJEN";
export const IS_ATTENDANCE_TEST_MODE =
  import.meta.env.VITE_ALLOW_TEST_ATTENDANCE === "true";

export const USER_ROLES = {
  admin: "admin",
  user: "user",
};

export const MOCK_USER = {
  nisn: "0098765432",
  password: "123456",
  role: USER_ROLES.user,
  name: "Ririn Yulianti",
  id: "123456789",
  kelas: "XI RPL 2",
  jurusan: "Rekayasa Perangkat Lunak",
  tanggalLahir: "20 Juli 2009",
  email: "ririnww1234@gmail.com",
  phone: "08123456789",
  alamat: "Jln. ruhhef SKJ",
  avatar:
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face",
};
