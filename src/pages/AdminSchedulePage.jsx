import { useEffect, useMemo, useState } from "react";
import { Save, RotateCcw } from "lucide-react";

import {
  DAY_LABELS,
  DAY_ORDER,
  DEFAULT_ATTENDANCE_SETTINGS,
} from "../constants";
import { useSettings } from "../context/SettingsContext";
import { getNationalHolidayInfo } from "../services/holidayService";
import {
  buildDateKey,
  formatWeekDate,
  getAttendanceScheduleSummary,
  getCurrentWeekDates,
  getScheduleValidationErrors,
} from "../utils";

function AdminSchedulePage() {
  const { settings, saveSettings, resetSettings } = useSettings();
  const [form, setForm] = useState(settings);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [holidayMap, setHolidayMap] = useState({});

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentDate(new Date());
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  const weekDates = useMemo(() => getCurrentWeekDates(currentDate), [currentDate]);

  useEffect(() => {
    let active = true;
    const weekDateEntries = Object.entries(weekDates);

    Promise.all(
      weekDateEntries.map(async ([dayKey, date]) => [
        dayKey,
        await getNationalHolidayInfo(buildDateKey(date)),
      ])
    ).then((entries) => {
      if (!active) {
        return;
      }

      setHolidayMap(Object.fromEntries(entries));
    });

    return () => {
      active = false;
    };
  }, [weekDates]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateLocation(field, value) {
    setForm((current) => ({
      ...current,
      location: {
        ...current.location,
        [field]: value,
      },
    }));
  }

  function updateSchedule(dayKey, field, value) {
    setForm((current) => {
      const nextDay = {
        ...current.weeklySchedule[dayKey],
        [field]: value,
      };

      if (field === "isActive" && value === false) {
        nextDay.checkInStart = null;
        nextDay.checkInEnd = null;
        nextDay.lateStart = null;
        nextDay.lateEnd = null;
        nextDay.checkOutStart = null;
        nextDay.checkOutEnd = null;
      }

      if (field === "isActive" && value === true) {
        nextDay.checkInStart =
          nextDay.checkInStart ?? DEFAULT_ATTENDANCE_SETTINGS.weeklySchedule[dayKey].checkInStart;
        nextDay.checkInEnd =
          nextDay.checkInEnd ?? DEFAULT_ATTENDANCE_SETTINGS.weeklySchedule[dayKey].checkInEnd;
        nextDay.lateStart =
          nextDay.lateStart ?? DEFAULT_ATTENDANCE_SETTINGS.weeklySchedule[dayKey].lateStart;
        nextDay.lateEnd =
          nextDay.lateEnd ?? DEFAULT_ATTENDANCE_SETTINGS.weeklySchedule[dayKey].lateEnd;
        nextDay.checkOutStart =
          nextDay.checkOutStart ??
          DEFAULT_ATTENDANCE_SETTINGS.weeklySchedule[dayKey].checkOutStart;
        nextDay.checkOutEnd =
          nextDay.checkOutEnd ?? DEFAULT_ATTENDANCE_SETTINGS.weeklySchedule[dayKey].checkOutEnd;
      }

      return {
        ...current,
        weeklySchedule: {
          ...current.weeklySchedule,
          [dayKey]: nextDay,
        },
      };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    setMessage({ type: "", text: "" });

    const invalidDay = DAY_ORDER
      .map((dayKey) => ({
        dayKey,
        errors: getScheduleValidationErrors(form.weeklySchedule?.[dayKey]),
      }))
      .find((item) => item.errors.length > 0);

    if (invalidDay) {
      setIsSaving(false);
      setMessage({
        type: "error",
        text: `${DAY_LABELS[invalidDay.dayKey]}: ${invalidDay.errors[0]}`,
      });
      return;
    }

    try {
      await saveSettings({
        ...form,
        radiusMeters: Number(form.radiusMeters),
        location: {
          ...form.location,
          latitude: Number(form.location.latitude),
          longitude: Number(form.location.longitude),
        },
      });
      setMessage({ type: "success", text: "Jadwal absensi berhasil diperbarui." });
    } catch (error) {
      console.error(error);
      setMessage({
        type: "error",
        text: error.message || "Gagal menyimpan jadwal ke Firebase.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReset() {
    setIsSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const nextSettings = await resetSettings();
      setForm(nextSettings);
      setMessage({ type: "success", text: "Jadwal berhasil dikembalikan ke Default Schedule." });
    } catch (error) {
      console.error(error);
      setMessage({
        type: "error",
        text: error.message || "Gagal mengembalikan default schedule.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Edit Jadwal</h1>
          <p className="page-description">
            Atur nama jadwal, jam kerja, lokasi absensi, dan radius untuk tiap hari.
          </p>
        </div>
      </div>

      <form className="admin-settings-form" onSubmit={handleSubmit}>
        <article className="details-card">
          <div className="section-header">
            <div>
              <h2>Default Schedule</h2>
              <p>Nilai ini dipakai sebagai jadwal aktif aplikasi.</p>
            </div>
          </div>

          <div className="settings-grid">
            <label className="field">
              <span>Nama Jadwal</span>
              <input
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Default Schedule"
              />
            </label>

            <label className="field">
              <span>Radius (meter)</span>
              <input
                type="number"
                min="1"
                value={form.radiusMeters}
                onChange={(event) => updateField("radiusMeters", event.target.value)}
              />
            </label>

            <label className="field">
              <span>Nama Lokasi</span>
              <input
                value={form.location?.name ?? ""}
                onChange={(event) => updateLocation("name", event.target.value)}
              />
            </label>

            <label className="field">
              <span>Latitude</span>
              <input
                type="number"
                step="any"
                value={form.location?.latitude ?? ""}
                onChange={(event) => updateLocation("latitude", event.target.value)}
              />
            </label>

            <label className="field">
              <span>Longitude</span>
              <input
                type="number"
                step="any"
                value={form.location?.longitude ?? ""}
                onChange={(event) => updateLocation("longitude", event.target.value)}
              />
            </label>
          </div>
        </article>

        <article className="details-card">
          <div className="section-header">
            <div>
              <h2>Jadwal Mingguan</h2>
              <p>
                Jika hari dinonaktifkan, sistem menganggap hari itu libur dan foto absen tidak
                akan diminta.
              </p>
            </div>
          </div>

          <div className="schedule-editor-list">
            {DAY_ORDER.map((dayKey) => {
              const daySchedule = form.weeklySchedule?.[dayKey];
              const dayDate = weekDates[dayKey];
              const holidayInfo = holidayMap[dayKey];
              const validationErrors = getScheduleValidationErrors(daySchedule);

              return (
                <div className="schedule-day-card" key={dayKey}>
                  <div className="schedule-day-head">
                    <div className="schedule-day-title">
                      <strong>
                        {DAY_LABELS[dayKey]}
                        {dayDate ? `, ${formatWeekDate(dayDate)}` : ""}
                      </strong>
                      <span>{daySchedule?.isActive ? "Hari kerja" : "Libur"}</span>
                      {holidayInfo?.isNationalHoliday ? (
                        <span className="holiday-label">
                          Hari Libur Nasional{holidayInfo.name ? ` - ${holidayInfo.name}` : ""}
                        </span>
                      ) : null}
                    </div>

                    <label className="switch-field">
                      <input
                        type="checkbox"
                        checked={Boolean(daySchedule?.isActive)}
                        onChange={(event) =>
                          updateSchedule(dayKey, "isActive", event.target.checked)
                        }
                      />
                      <span>{daySchedule?.isActive ? "Aktif" : "Libur"}</span>
                    </label>
                  </div>

                  <div className="schedule-range-grid">
                    <div className="schedule-range-card">
                      <strong>Jam Datang</strong>
                      <div className="schedule-time-grid">
                        <label className="field">
                          <span>Dari</span>
                          <input
                            type="time"
                            value={daySchedule?.checkInStart ?? ""}
                            disabled={!daySchedule?.isActive}
                            onChange={(event) =>
                              updateSchedule(dayKey, "checkInStart", event.target.value)
                            }
                          />
                        </label>

                        <label className="field">
                          <span>Sampai</span>
                          <input
                            type="time"
                            value={daySchedule?.checkInEnd ?? ""}
                            disabled={!daySchedule?.isActive}
                            onChange={(event) =>
                              updateSchedule(dayKey, "checkInEnd", event.target.value)
                            }
                          />
                        </label>
                      </div>
                    </div>

                    <div className="schedule-range-card">
                      <strong>Jam Terlambat</strong>
                      <div className="schedule-time-grid">
                        <label className="field">
                          <span>Dari</span>
                          <input
                            type="time"
                            value={daySchedule?.lateStart ?? ""}
                            disabled={!daySchedule?.isActive}
                            onChange={(event) =>
                              updateSchedule(dayKey, "lateStart", event.target.value)
                            }
                          />
                        </label>

                        <label className="field">
                          <span>Sampai</span>
                          <input
                            type="time"
                            value={daySchedule?.lateEnd ?? ""}
                            disabled={!daySchedule?.isActive}
                            onChange={(event) =>
                              updateSchedule(dayKey, "lateEnd", event.target.value)
                            }
                          />
                        </label>
                      </div>
                    </div>

                    <div className="schedule-range-card">
                      <strong>Jam Pulang</strong>
                      <div className="schedule-time-grid">
                        <label className="field">
                          <span>Dari</span>
                          <input
                            type="time"
                            value={daySchedule?.checkOutStart ?? ""}
                            disabled={!daySchedule?.isActive}
                            onChange={(event) =>
                              updateSchedule(dayKey, "checkOutStart", event.target.value)
                            }
                          />
                        </label>

                        <label className="field">
                          <span>Sampai</span>
                          <input
                            type="time"
                            value={daySchedule?.checkOutEnd ?? ""}
                            disabled={!daySchedule?.isActive}
                            onChange={(event) =>
                              updateSchedule(dayKey, "checkOutEnd", event.target.value)
                            }
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  {daySchedule?.isActive ? (
                    <div className="schedule-preview-text">
                      {getAttendanceScheduleSummary(daySchedule)}
                    </div>
                  ) : null}

                  {validationErrors.length > 0 ? (
                    <div className="inline-message error">{validationErrors[0]}</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </article>

        {message.text ? <div className={`inline-message ${message.type}`}>{message.text}</div> : null}

        <div className="settings-action-row">
          <button className="secondary-button settings-secondary" type="button" onClick={handleReset}>
            <RotateCcw size={18} />
            <span>Reset Default</span>
          </button>

          <button className="primary-button settings-primary" type="submit" disabled={isSaving}>
            <Save size={18} />
            <span>{isSaving ? "Menyimpan..." : "Simpan Jadwal"}</span>
          </button>
        </div>
      </form>
    </section>
  );
}

export default AdminSchedulePage;
