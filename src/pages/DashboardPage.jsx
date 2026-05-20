import { useEffect, useState } from "react";
import { CalendarDays, Clock3, FileSpreadsheet, Settings2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import CalendarModal from "../components/CalendarModal";
import SummaryItem from "../components/SummaryItem";
import { DAY_LABELS } from "../constants";
import { useAttendance } from "../context/AttendanceContext";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import {
  getNationalHolidayInfo,
  getNationalHolidaysByMonth,
} from "../services/holidayService";
import {
  formatDate,
  buildDateKey,
  getAttendanceScheduleSummary,
  formatTime,
  getAttendanceWindow,
  getCalendarMatrix,
} from "../utils";

function DashboardPage() {
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const { summary } = useAttendance();
  const { settings } = useSettings();
  const [now, setNow] = useState(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [holidayInfo, setHolidayInfo] = useState(null);
  const [monthHolidays, setMonthHolidays] = useState([]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;

    getNationalHolidayInfo(now).then((result) => {
      if (active) {
        setHolidayInfo(result);
      }
    });

    return () => {
      active = false;
    };
  }, [buildDateKey(now)]);

  useEffect(() => {
    let active = true;

    getNationalHolidaysByMonth(selectedMonth).then((result) => {
      if (active) {
        setMonthHolidays(result.filter((item) => item.isNationalHoliday));
      }
    });

    return () => {
      active = false;
    };
  }, [selectedMonth]);

  const monthName = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(selectedMonth);
  const calendarDays = getCalendarMatrix(selectedMonth);
  const attendanceWindow = getAttendanceWindow(settings, now, holidayInfo);
  const todaySchedule = attendanceWindow.schedule;
  const isOffDay = attendanceWindow.isOffDay;
  const dayLabel = DAY_LABELS[attendanceWindow.dayKey];
  const isNationalHoliday = attendanceWindow.holiday.isNationalHoliday;

  return (
    <section className="page">
      <header
        className="hero-panel hero-panel-link"
        onClick={() => navigate("/profil")}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            navigate("/profil");
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Buka halaman profil"
      >
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Halo, {user?.name}</h1>
          <p>{user?.kelas}</p>
        </div>
        <img className="profile-thumb" src={user?.avatar} alt={user?.name} />
      </header>

      <div className="dashboard-grid">
        <article className="time-card">
          <div className="card-head">
            <div>
              <span className="card-label">Waktu Saat Ini</span>
              <h2>{formatTime(now)}</h2>
              <p>{formatDate(now)}</p>
              <p className="time-card-caption">
                {isOffDay
                  ? `${dayLabel} libur`
                  : `${dayLabel} ${getAttendanceScheduleSummary(todaySchedule)}`}
              </p>
            </div>
            <button className="icon-button calendar-toggle-button" onClick={() => setCalendarOpen(true)}>
              <CalendarDays size={20} />
            </button>
          </div>
        </article>

        <article
          className="summary-card summary-card-link"
          onClick={() => navigate("/riwayat")}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              navigate("/riwayat");
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Buka halaman riwayat"
        >
          <h3>Ringkasan Kehadiran</h3>
          <div className="summary-row">
            <SummaryItem label="Hadir" value={summary.hadir} />
            <SummaryItem label="Terlambat" value={summary.terlambat} />
            <SummaryItem label="Tidak Hadir" value={summary.tidakHadir} />
          </div>
        </article>
      </div>

      {isNationalHoliday ? (
        <div className="holiday-label">
          Hari Libur Nasional{attendanceWindow.holiday.name ? ` - ${attendanceWindow.holiday.name}` : ""}
        </div>
      ) : null}

      {isOffDay ? (
        <div className={`inline-message ${isNationalHoliday ? "error" : "warning"}`}>
          {isNationalHoliday
            ? `Hari Libur Nasional${
                attendanceWindow.holiday.name ? `: ${attendanceWindow.holiday.name}` : ""
              }. Presensi dinonaktifkan hari ini.`
            : `Hari ini ${dayLabel} libur. Form foto absen tidak ditampilkan.`}
        </div>
      ) : null}

      <div className="action-grid">
        {!isOffDay ? (
          <>
            <button className="action-card action-green" onClick={() => navigate("/absen-datang")}>
              <Clock3 size={32} />
              <strong>Datang</strong>
              <span>Absen Datang</span>
            </button>
            <button className="action-card action-orange" onClick={() => navigate("/absen-pulang")}>
              <Clock3 size={32} />
              <strong>Pulang</strong>
              <span>Absen Pulang</span>
            </button>
          </>
        ) : null}

        {isAdmin ? (
          <>
            <button className="action-card action-blue" onClick={() => navigate("/admin/jadwal")}>
              <Settings2 size={32} />
              <strong>Edit Jadwal</strong>
              <span>Kelola jam kerja, lokasi, dan radius</span>
            </button>
            <button
              className="action-card action-blue"
              onClick={() => navigate("/admin/rekap-bulanan")}
            >
              <FileSpreadsheet size={32} />
              <strong>Data Absensi</strong>
              <span>Lihat absensi per kelas dan periode</span>
            </button>
          </>
        ) : null}
      </div>

      {calendarOpen ? (
        <CalendarModal
          calendarDays={calendarDays}
          holidays={monthHolidays}
          monthName={monthName}
          onClose={() => setCalendarOpen(false)}
          onNextMonth={() =>
            setSelectedMonth(
              (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
            )
          }
          onPreviousMonth={() =>
            setSelectedMonth(
              (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
            )
          }
          selectedMonth={selectedMonth}
        />
      ) : null}
    </section>
  );
}

export default DashboardPage;
