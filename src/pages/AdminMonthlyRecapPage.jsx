import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { collection, onSnapshot, query, where } from "firebase/firestore";

import { db } from "../firebase";
import { useSettings } from "../context/SettingsContext";

const MONTH_OPTIONS = [
  { value: 0, label: "Januari" },
  { value: 1, label: "Februari" },
  { value: 2, label: "Maret" },
  { value: 3, label: "April" },
  { value: 4, label: "Mei" },
  { value: 5, label: "Juni" },
  { value: 6, label: "Juli" },
  { value: 7, label: "Agustus" },
  { value: 8, label: "September" },
  { value: 9, label: "Oktober" },
  { value: 10, label: "November" },
  { value: 11, label: "Desember" },
];

const GRADE_OPTIONS = ["X", "XI", "XII"];
const MAJOR_OPTIONS = [
  { code: "RPL", name: "Rekayasa Perangkat Lunak", classNumbers: [1, 2, 3, 4] },
  { code: "TKJ", name: "Teknik Komputer dan Jaringan", classNumbers: [1, 2, 3, 4] },
  { code: "TBSM", name: "Teknik Bisnis Sepeda Motor", classNumbers: [1, 2] },
  { code: "TEI", name: "Teknik Elektronika Industri", classNumbers: [1, 2, 3, 4, 5] },
  { code: "TKR", name: "Teknik Kendaraan Ringan", classNumbers: [1, 2, 3, 4, 5] },
];
const ATTENDANCE_COLLECTION = "attendance";
const USER_COLLECTION = "users";
const EMPTY_FILTER_MESSAGE = "Pilih bulan, tahun, kelas, jurusan, dan nomor kelas lalu klik Tampilkan.";
const JAKARTA_TIMEZONE = "Asia/Jakarta";

function AdminMonthlyRecapPage() {
  const { settings } = useSettings();
  const [today, setToday] = useState(() => new Date());
  const todayJakartaParts = useMemo(() => getJakartaDateParts(today), [today]);
  const [filters, setFilters] = useState(() => ({
    month: getJakartaDateParts(new Date()).month - 1,
    year: getJakartaDateParts(new Date()).year,
    grade: "XI",
    majorCode: "RPL",
    classNumber: "1",
  }));
  const [activeFilters, setActiveFilters] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(EMPTY_FILTER_MESSAGE);
  const [studentKeyword, setStudentKeyword] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const yearOptions = useMemo(() => {
    const currentYear = todayJakartaParts.year;

    return Array.from({ length: 7 }, (_, index) => currentYear - 2 + index);
  }, [todayJakartaParts.year]);

  const selectedMajor = useMemo(
    () => MAJOR_OPTIONS.find((major) => major.code === filters.majorCode) ?? null,
    [filters.majorCode]
  );
  const selectedMajorForActiveFilter = useMemo(
    () => MAJOR_OPTIONS.find((major) => major.code === activeFilters?.majorCode) ?? null,
    [activeFilters]
  );
  const classNumberOptions = selectedMajor?.classNumbers ?? [];
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setToday(new Date());
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!selectedMajor) {
      return;
    }

    const hasCurrentNumber = selectedMajor.classNumbers.includes(Number(filters.classNumber));

    if (!hasCurrentNumber) {
      setFilters((current) => ({
        ...current,
        classNumber: String(selectedMajor.classNumbers[0] ?? ""),
      }));
    }
  }, [filters.classNumber, selectedMajor]);

  useEffect(() => {
    if (!activeFilters) {
      return undefined;
    }

    const classLabel = buildClassLabel(activeFilters);
    const monthRange = getMonthRange(activeFilters.year, activeFilters.month);
    const usersQuery = query(collection(db, USER_COLLECTION), where("kelas", "==", classLabel));

    setIsLoading(true);
    setMessage(`Memuat data kelas ${classLabel}...`);

    let attendanceUnsubscribers = [];

    const usersUnsubscribe = onSnapshot(
      usersQuery,
      (userSnapshot) => {
        attendanceUnsubscribers.forEach((unsubscribe) => unsubscribe());
        attendanceUnsubscribers = [];

        const nextStudents = userSnapshot.docs
          .map((studentDoc) => normalizeStudent(studentDoc.id, studentDoc.data()))
          .sort((left, right) => left.name.localeCompare(right.name, "id-ID"));

        setStudents(nextStudents);

        if (!nextStudents.length) {
          setAttendanceRecords([]);
          setMessage(`Belum ada data siswa untuk kelas ${classLabel}.`);
          setIsLoading(false);
          return;
        }

        const nisnChunks = chunkArray(
          nextStudents.map((student) => student.nisn).filter(Boolean),
          10
        );

        if (!nisnChunks.length) {
          setAttendanceRecords([]);
          setMessage(`Data siswa kelas ${classLabel} belum memiliki NISN yang bisa dipakai untuk query absensi.`);
          setIsLoading(false);
          return;
        }

        const chunkRecords = new Map();
        const pendingChunks = new Set(nisnChunks.map((_, index) => index));

        attendanceUnsubscribers = nisnChunks.map((nisnChunk, chunkIndex) =>
          onSnapshot(
            query(
              collection(db, ATTENDANCE_COLLECTION),
              where("userNisn", "in", nisnChunk),
              where("date", ">=", monthRange.startDateKey),
              where("date", "<=", monthRange.endDateKey)
            ),
            (attendanceSnapshot) => {
              chunkRecords.set(
                chunkIndex,
                attendanceSnapshot.docs.map((attendanceDoc) =>
                  normalizeAttendanceRecord(attendanceDoc.id, attendanceDoc.data())
                )
              );
              pendingChunks.delete(chunkIndex);

              const mergedRecords = Array.from(chunkRecords.values()).flat();
              setAttendanceRecords(mergedRecords);
              setIsLoading(pendingChunks.size > 0);
              if (pendingChunks.size === 0) {
                setMessage(
                  mergedRecords.length
                    ? `Menampilkan rekap ${classLabel} untuk ${MONTH_OPTIONS[activeFilters.month].label} ${activeFilters.year}.`
                    : `Belum ada data absensi tersimpan untuk ${classLabel} pada ${MONTH_OPTIONS[activeFilters.month].label} ${activeFilters.year}.`
                );
              }
            },
            (error) => {
              console.error("Error loading attendance recap", error);
              setAttendanceRecords([]);
              setMessage(
                error?.message ||
                  "Gagal mengambil data absensi. Pastikan index Firestore untuk query rekap sudah tersedia."
              );
              setIsLoading(false);
            }
          )
        );
      },
      (error) => {
        console.error("Error loading student recap list", error);
        setStudents([]);
        setAttendanceRecords([]);
        setMessage(error?.message || "Gagal mengambil data siswa dari Firebase.");
        setIsLoading(false);
      }
    );

    return () => {
      usersUnsubscribe();
      attendanceUnsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [activeFilters, refreshKey]);

  const recapRows = useMemo(() => {
    if (!activeFilters) {
      return [];
    }

    const monthRange = getMonthRange(activeFilters.year, activeFilters.month);
    const attendanceByNisnAndDate = attendanceRecords.reduce((result, record) => {
      if (!record.userNisnKey || !record.date) {
        return result;
      }

      result[`${record.userNisnKey}_${record.date}`] = record;
      return result;
    }, {});

    return students.map((student, index) => {
      const counts = { hadir: 0, terlambat: 0, tidakHadir: 0, libur: 0 };
      const days = Array.from({ length: 31 }, (_, dayIndex) => {
        const dayNumber = dayIndex + 1;

        if (dayNumber > monthRange.daysInMonth) {
          return {
            dayNumber,
            label: "-",
            statusType: "outside",
            title: "Tanggal di luar bulan terpilih",
          };
        }

        const dateKey = buildMonthDateKey(activeFilters.year, activeFilters.month, dayNumber);
        const currentDateUtc = createUtcDate(activeFilters.year, activeFilters.month, dayNumber);
        const dayStatus = getCalendarDayStatus({
          date: currentDateUtc,
          dateKey,
          todayKey: buildMonthDateKey(
            todayJakartaParts.year,
            todayJakartaParts.month - 1,
            todayJakartaParts.day
          ),
          schedule: settings.weeklySchedule,
          record: attendanceByNisnAndDate[`${student.nisnKey}_${dateKey}`],
        });

        if (dayStatus.statusType === "hadir") {
          counts.hadir += 1;
        }

        if (dayStatus.statusType === "terlambat") {
          counts.terlambat += 1;
        }

        if (dayStatus.statusType === "tidak_hadir") {
          counts.tidakHadir += 1;
        }

        if (dayStatus.statusType === "libur") {
          counts.libur += 1;
        }

        return {
          dayNumber,
          label: getStatusLabel(dayStatus.statusType),
          statusType: dayStatus.statusType,
          title: dayStatus.title,
        };
      });

      return {
        id: student.uid,
        no: index + 1,
        student,
        days,
        totals: counts,
      };
    });
  }, [activeFilters, attendanceRecords, settings.weeklySchedule, students, todayJakartaParts]);

  const filteredRecapRows = useMemo(() => {
    const keyword = studentKeyword.trim().toLowerCase();

    if (!keyword) {
      return recapRows;
    }

    return recapRows.filter((row) => {
      const studentName = row.student.name.toLowerCase();
      const studentNisn = row.student.nisn.toLowerCase();

      return studentName.includes(keyword) || studentNisn.includes(keyword);
    });
  }, [recapRows, studentKeyword]);

  const activeClassLabel = activeFilters ? buildClassLabel(activeFilters) : "-";
  const activePeriodLabel = activeFilters
    ? `${MONTH_OPTIONS[activeFilters.month].label} ${activeFilters.year}`
    : "-";
  const legendItems = [
    { label: "Hadir", className: "hadir", shortLabel: "H" },
    { label: "Terlambat", className: "terlambat", shortLabel: "T" },
    { label: "Tidak hadir", className: "tidak_hadir", shortLabel: "A" },
    { label: "Hari libur", className: "libur", shortLabel: "L" },
  ];

  function handleFilterChange(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!filters.grade || !filters.majorCode || !filters.classNumber) {
      setMessage("Lengkapi filter kelas, jurusan, dan nomor kelas terlebih dahulu.");
      return;
    }

    setActiveFilters({
      month: Number(filters.month),
      year: Number(filters.year),
      grade: filters.grade,
      majorCode: filters.majorCode,
      classNumber: String(filters.classNumber),
    });
  }

  function handleRefresh() {
    if (!activeFilters) {
      setMessage("Pilih filter lalu klik Tampilkan terlebih dahulu sebelum sinkronisasi ulang.");
      return;
    }

    setMessage(
      `Menyinkronkan ulang data absensi ${buildClassLabel(activeFilters)} untuk ${MONTH_OPTIONS[activeFilters.month].label} ${activeFilters.year}...`
    );
    setRefreshKey((current) => current + 1);
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Data Absensi Bulanan</h1>
          <p className="page-description">
            Filter kelas dan periode untuk melihat data absensi bulanan siswa secara realtime.
          </p>
        </div>
      </div>

      <article className="details-card">
        <form className="monthly-recap-filter" onSubmit={handleSubmit}>
          <label className="field">
            <span>Bulan</span>
            <select
              value={filters.month}
              onChange={(event) => handleFilterChange("month", Number(event.target.value))}
            >
              {MONTH_OPTIONS.map((monthOption) => (
                <option key={monthOption.value} value={monthOption.value}>
                  {monthOption.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Tahun</span>
            <select
              value={filters.year}
              onChange={(event) => handleFilterChange("year", Number(event.target.value))}
            >
              {yearOptions.map((yearOption) => (
                <option key={yearOption} value={yearOption}>
                  {yearOption}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Kelas</span>
            <select
              value={filters.grade}
              onChange={(event) => handleFilterChange("grade", event.target.value)}
            >
              {GRADE_OPTIONS.map((gradeOption) => (
                <option key={gradeOption} value={gradeOption}>
                  {gradeOption}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Jurusan</span>
            <select
              value={filters.majorCode}
              onChange={(event) => handleFilterChange("majorCode", event.target.value)}
            >
              {MAJOR_OPTIONS.map((majorOption) => (
                <option key={majorOption.code} value={majorOption.code}>
                  {majorOption.code} - {majorOption.name}
                </option>
              ))}
            </select>
          </label>

          {selectedMajor ? (
            <label className="field">
              <span>Nomor Kelas</span>
              <select
                value={filters.classNumber}
                onChange={(event) => handleFilterChange("classNumber", event.target.value)}
              >
                {classNumberOptions.map((classNumber) => (
                  <option key={classNumber} value={classNumber}>
                    {selectedMajor.code} {classNumber}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <button className="primary-button monthly-recap-submit" type="submit">
            <Search size={18} />
            <span>Tampilkan</span>
          </button>

          <button
            className="secondary-button monthly-recap-refresh"
            type="button"
            onClick={handleRefresh}
            disabled={!activeFilters || isLoading}
          >
            <RefreshCw size={18} />
            <span>{isLoading ? "Sinkron..." : "Sinkronkan Ulang"}</span>
          </button>
        </form>
      </article>

      <article className="details-card monthly-recap-card">
        <div className="monthly-recap-toolbar">
          <div>
            <h2>{activeClassLabel}</h2>
            <p>{activePeriodLabel}</p>
          </div>

          <div className="monthly-recap-legend">
            {legendItems.map((item) => (
              <span className="monthly-recap-legend-item" key={item.className}>
                <span className={`monthly-recap-dot ${item.className}`}>{item.shortLabel}</span>
                <span>{item.label}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="monthly-recap-search-row">
          <label className="field monthly-recap-search-field">
            <span>Cari Siswa Cepat</span>
            <input
              value={studentKeyword}
              onChange={(event) => setStudentKeyword(event.target.value)}
              placeholder="Contoh: Yona atau NISN"
            />
          </label>
        </div>

        {message ? <div className="inline-message">{message}</div> : null}

        <div className="monthly-recap-table-wrap">
          <table className="monthly-recap-table">
            <thead>
              <tr>
                <th className="sticky-col sticky-col-no" rowSpan={2}>
                  No
                </th>
                <th className="sticky-col sticky-col-name" rowSpan={2}>
                  Nama Siswa
                </th>
                {Array.from({ length: 31 }, (_, index) => (
                  <th key={index + 1} rowSpan={2}>
                    {index + 1}
                  </th>
                ))}
                <th className="sticky-col sticky-col-total-group" colSpan={4}>
                  Jumlah
                </th>
              </tr>
              <tr>
                <th className="sticky-col sticky-col-total-sub">H</th>
                <th className="sticky-col sticky-col-total-sub">T</th>
                <th className="sticky-col sticky-col-total-sub">A</th>
                <th className="sticky-col sticky-col-total-sub">L</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecapRows.map((row) => (
                <tr key={row.id}>
                  <td className="sticky-col sticky-col-no">{row.no}</td>
                  <td className="sticky-col sticky-col-name">
                    <div className="monthly-recap-student-cell">
                      <strong>{row.student.name}</strong>
                      <span>
                        {row.student.nisn}
                        {selectedMajorForActiveFilter ? ` • ${selectedMajorForActiveFilter.name}` : ""}
                      </span>
                    </div>
                  </td>
                  {row.days.map((day) => (
                    <td
                      key={`${row.id}-${day.dayNumber}`}
                      className={`attendance-status-cell ${day.statusType}`}
                      title={day.title}
                    >
                      {day.label}
                    </td>
                  ))}
                  <td className="sticky-col sticky-col-total-value">{row.totals.hadir}</td>
                  <td className="sticky-col sticky-col-total-value">{row.totals.terlambat}</td>
                  <td className="sticky-col sticky-col-total-value">{row.totals.tidakHadir}</td>
                  <td className="sticky-col sticky-col-total-value">{row.totals.libur ?? 0}</td>
                </tr>
              ))}

              {!filteredRecapRows.length ? (
                <tr>
                  <td className="monthly-recap-empty" colSpan={37}>
                    {isLoading
                      ? "Memuat data absensi..."
                      : studentKeyword.trim()
                        ? "Siswa yang dicari tidak ditemukan pada filter ini."
                        : "Belum ada data untuk filter ini."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

function normalizeStudent(uid, data) {
  const rawNisn = `${data.nisn ?? ""}`.trim();

  return {
    uid,
    nisn: rawNisn,
    nisnKey: normalizeNisnKey(rawNisn),
    name: data.name ?? data.nama ?? "Tanpa Nama",
    kelas: data.kelas ?? "-",
    jurusan: data.jurusan ?? "-",
  };
}

function normalizeAttendanceRecord(id, data) {
  const normalizedDate = normalizeDateKey(data.date, data.dateValue);
  const normalizedStatus = normalizeStatus(data.status);

  return {
    id,
    date: normalizedDate,
    dateValue: Number(data.dateValue ?? new Date(normalizedDate || 0).getTime()),
    status: normalizedStatus,
    userNisn: `${data.userNisn ?? ""}`.trim(),
    userNisnKey: normalizeNisnKey(data.userNisn),
  };
}

function buildClassLabel(filters) {
  return `${filters.grade} ${filters.majorCode} ${filters.classNumber}`;
}

function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function getMonthRange(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDateKey = buildMonthDateKey(year, month, 1);
  const endDateKey = buildMonthDateKey(year, month, daysInMonth);

  return { daysInMonth, startDateKey, endDateKey };
}

function buildMonthDateKey(year, month, day) {
  const safeMonth = `${month + 1}`.padStart(2, "0");
  const safeDay = `${day}`.padStart(2, "0");
  return `${year}-${safeMonth}-${safeDay}`;
}

function createUtcDate(year, month, day) {
  return new Date(Date.UTC(year, month, day));
}

function getCalendarDayStatus({ date, dateKey, todayKey, schedule, record }) {
  const dayKey = getDayKeyFromUtcDate(date);
  const daySchedule = schedule?.[dayKey];

  if (!daySchedule?.isActive) {
    return {
      statusType: "libur",
      title: `${dateKey} - Hari libur`,
    };
  }

  if (dateKey > todayKey) {
    return {
      statusType: "future",
      title: `${dateKey} - Belum berjalan`,
    };
  }

  if (record?.status === "terlambat") {
    return {
      statusType: "terlambat",
      title: `${dateKey} - Terlambat`,
    };
  }

  if (record?.status === "hadir") {
    return {
      statusType: "hadir",
      title: `${dateKey} - Hadir`,
    };
  }

  if (record?.status === "tidak_hadir") {
    return {
      statusType: "tidak_hadir",
      title: `${dateKey} - Tidak hadir`,
    };
  }

  return {
    statusType: "tidak_hadir",
    title: `${dateKey} - Tidak hadir`,
  };
}

function getDayKeyFromUtcDate(date) {
  return (
    {
      1: "senin",
      2: "selasa",
      3: "rabu",
      4: "kamis",
      5: "jumat",
      6: "sabtu",
      0: "minggu",
    }[date.getUTCDay()] ?? "senin"
  );
}

function getStatusLabel(statusType) {
  switch (statusType) {
    case "hadir":
      return "H";
    case "terlambat":
      return "T";
    case "tidak_hadir":
      return "A";
    case "libur":
      return "L";
    default:
      return "-";
  }
}

function getJakartaDateParts(date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? 0),
    month: Number(parts.find((part) => part.type === "month")?.value ?? 1),
    day: Number(parts.find((part) => part.type === "day")?.value ?? 1),
  };
}

function normalizeStatus(status) {
  const safeStatus = `${status ?? "hadir"}`
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_");

  if (safeStatus === "terlambat" || safeStatus === "hadir" || safeStatus === "tidak_hadir") {
    return safeStatus;
  }

  if (safeStatus === "alpha" || safeStatus === "alfa") {
    return "tidak_hadir";
  }

  return "hadir";
}

function normalizeDateKey(rawDate, rawDateValue) {
  const safeRawDate = `${rawDate ?? ""}`.trim();

  if (safeRawDate) {
    const dateMatch = safeRawDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

    if (dateMatch) {
      const [, year, month, day] = dateMatch;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  }

  const fallbackDate = Number(rawDateValue);
  if (!Number.isFinite(fallbackDate) || fallbackDate <= 0) {
    return "";
  }

  const date = new Date(fallbackDate);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeNisnKey(value) {
  const rawValue = `${value ?? ""}`.trim();
  const digitOnlyValue = rawValue.replace(/\D/g, "");

  if (!digitOnlyValue) {
    return rawValue.toLowerCase();
  }

  return digitOnlyValue.replace(/^0+/, "") || "0";
}

export default AdminMonthlyRecapPage;
