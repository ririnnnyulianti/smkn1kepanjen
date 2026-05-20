import { useEffect, useMemo, useState } from "react";
import { Camera, LocateFixed, MapPin } from "lucide-react";
import { Circle, MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import { useNavigate } from "react-router-dom";

import InfoPill from "../components/InfoPill";
import { DAY_LABELS, IS_ATTENDANCE_TEST_MODE } from "../constants";
import { useAttendance } from "../context/AttendanceContext";
import { useSettings } from "../context/SettingsContext";
import { getNationalHolidayInfo } from "../services/holidayService";
import {
  buildDateKey,
  getAttendanceBlockedMessage,
  getAttendanceScheduleSummary,
  formatScheduleTime,
  formatDateShort,
  getAttendanceWindow,
  haversineDistance,
  isWithinAllowedRadius,
} from "../utils";

const targetLocationIcon = L.divIcon({
  className: "attendance-map-marker attendance-map-marker-target",
  html: '<span class="attendance-map-marker-dot"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const currentLocationIcon = L.divIcon({
  className: "attendance-map-marker attendance-map-marker-current",
  html: '<span class="attendance-map-marker-dot"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function AttendancePage({ mode }) {
  const navigate = useNavigate();
  const { addCheckIn, addCheckOut } = useAttendance();
  const { settings } = useSettings();
  const [mapInstance, setMapInstance] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [locationLoading, setLocationLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [now, setNow] = useState(() => new Date());
  const [holidayInfo, setHolidayInfo] = useState(null);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let active = true;

    if (!("geolocation" in navigator)) {
      setLocationLoading(false);
      setMessage({ type: "error", text: "Browser ini tidak mendukung geolocation." });
      return undefined;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!active) {
          return;
        }

        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLocationLoading(false);
      },
      (error) => {
        if (!active) {
          return;
        }

        setMessage({
          type: "error",
          text:
            error.code === 1
              ? "Izin lokasi ditolak. Aktifkan izin lokasi browser lalu coba lagi."
              : "Lokasi tidak bisa diambil. Pastikan GPS aktif lalu coba lagi.",
        });
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    );

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!photoFile) {
      setPreviewUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(photoFile);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [photoFile]);

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

  const distance = useMemo(() => {
    if (!currentLocation) {
      return null;
    }

    return haversineDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      settings.location.latitude,
      settings.location.longitude
    );
  }, [currentLocation, settings]);

  const withinRadius =
    currentLocation &&
    isWithinAllowedRadius(currentLocation.latitude, currentLocation.longitude, settings);
  const attendanceWindow = getAttendanceWindow(settings, now, holidayInfo);
  const isOffDay = attendanceWindow.isOffDay;
  const canSubmitByTime = IS_ATTENDANCE_TEST_MODE
    ? true
    : mode === "checkin"
      ? attendanceWindow.canCheckIn
      : attendanceWindow.canCheckOut;
  const canSubmitByRadius = IS_ATTENDANCE_TEST_MODE || withinRadius;
  const activeDayLabel = DAY_LABELS[attendanceWindow.dayKey];
  const activeScheduleLabel = getAttendanceScheduleSummary(attendanceWindow.schedule);
  const activeSchedule = attendanceWindow.schedule;
  const locationAccuracy =
    currentLocation?.accuracy != null ? `${Math.round(currentLocation.accuracy)} m` : "Tidak tersedia";
  const radiusStatusText = locationLoading
    ? "Sedang mengambil lokasi browser."
    : currentLocation
      ? `Jarak Anda dari titik absensi sekitar ${Math.round(distance)} meter.`
      : "Lokasi belum tersedia.";
  const radiusHelperText = currentLocation
    ? canSubmitByRadius
      ? IS_ATTENDANCE_TEST_MODE && !withinRadius
        ? "Mode uji mengizinkan absensi di luar radius."
        : "Posisi Anda sudah masuk area absensi."
      : `Anda perlu mendekat ke titik absensi maksimal ${settings.radiusMeters} meter.`
    : "Perlu izin lokasi untuk mengecek radius.";
  const blockedMessage = getAttendanceBlockedMessage(attendanceWindow, mode, activeDayLabel);

  const mapCenter = currentLocation
    ? [
        (settings.location.latitude + currentLocation.latitude) / 2,
        (settings.location.longitude + currentLocation.longitude) / 2,
      ]
    : [settings.location.latitude, settings.location.longitude];

  function handleReturnToCurrentLocation() {
    if (!mapInstance || !currentLocation) {
      return;
    }

    mapInstance.flyTo([currentLocation.latitude, currentLocation.longitude], 18, {
      animate: true,
      duration: 1.2,
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isOffDay) {
      setMessage({
        type: "warning",
        text: blockedMessage,
      });
      return;
    }

    if (!photoFile) {
      setMessage({ type: "error", text: "Foto absensi wajib diunggah." });
      return;
    }

    if (!currentLocation) {
      setMessage({ type: "error", text: "Lokasi belum siap." });
      return;
    }

    if (!canSubmitByTime) {
      setMessage({
        type: "warning",
        text: blockedMessage || `Presensi hanya aktif pada jadwal ${activeScheduleLabel}.`,
      });
      return;
    }

    if (!canSubmitByRadius) {
      setMessage({
        type: "error",
        text: "Lokasi Anda berada di luar radius absensi yang diizinkan.",
      });
      return;
    }

    setSubmitLoading(true);
    setMessage({ type: "", text: "" });

    try {
      if (mode === "checkin") {
        await addCheckIn(now, photoFile);
      } else {
        await addCheckOut(now, photoFile);
      }

      setMessage({ type: "success", text: "Data absensi berhasil dikirim." });
      window.setTimeout(() => navigate(mode === "checkin" ? "/" : "/riwayat"), 800);
    } catch (error) {
      console.error(error);
      setMessage({
        type: "error",
        text: error.message || "Gagal memproses foto atau menyimpan data absensi.",
      });
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">{mode === "checkin" ? "Absen Datang" : "Absen Pulang"}</p>
          <h1>{settings.location.name}</h1>
        </div>
        <button className="secondary-button" onClick={() => navigate(-1)}>
          Kembali
        </button>
      </div>

      <div className="attendance-layout">
        <article className="map-panel">
          <div className="map-frame-wrap">
            <button
              className="map-location-button"
              type="button"
              onClick={handleReturnToCurrentLocation}
              disabled={!currentLocation}
            >
              <LocateFixed size={16} />
              <span>My Location</span>
            </button>
            <MapContainer
              key={currentLocation ? "with-current-location" : "target-only"}
              center={mapCenter}
              zoom={17}
              scrollWheelZoom
              className="map-frame"
              ref={setMapInstance}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Circle
                center={[settings.location.latitude, settings.location.longitude]}
                radius={settings.radiusMeters}
                pathOptions={{
                  color: "#1b3a7b",
                  fillColor: "#3b82f6",
                  fillOpacity: 0.2,
                  weight: 2,
                }}
              />
              <Marker
                position={[settings.location.latitude, settings.location.longitude]}
                icon={targetLocationIcon}
              >
                <Popup>
                  Titik absensi
                  <br />
                  {settings.location.name}
                </Popup>
              </Marker>
              {currentLocation ? (
                <Marker
                  position={[currentLocation.latitude, currentLocation.longitude]}
                  icon={currentLocationIcon}
                >
                  <Popup>Posisi Anda saat ini</Popup>
                </Marker>
              ) : null}
            </MapContainer>
          </div>
          <div className="map-caption">
            <div className="map-caption-head">
              <MapPin size={18} />
              <strong>{settings.location.name}</strong>
            </div>
            <span>
              {settings.location.latitude.toFixed(6)}, {settings.location.longitude.toFixed(6)}
            </span>
            <span>Area biru menunjukkan radius absensi {settings.radiusMeters} meter.</span>
            <a
              href={`https://www.google.com/maps?q=${settings.location.latitude},${settings.location.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              Buka di Google Maps
            </a>
          </div>
        </article>

        <form className="attendance-card" onSubmit={handleSubmit}>
          {IS_ATTENDANCE_TEST_MODE ? (
            <div className="inline-message warning">
              Mode uji aktif. Batas jam dan radius absensi dilewati untuk testing lokal.
            </div>
          ) : null}

          <div className="attendance-info-grid">
            <InfoPill label="Tanggal" value={formatDateShort(now)} />
            <InfoPill label="Hari Aktif" value={activeDayLabel} />
            <InfoPill
              label="Status Hari"
              value={
                attendanceWindow.holiday.isNationalHoliday
                  ? "Hari Libur Nasional"
                  : isOffDay
                    ? "Libur"
                    : "Hari Kerja"
              }
            />
            <div className="info-pill schedule-pill">
              <span>Jadwal Presensi</span>
              <div className="schedule-pill-list">
                <div className="schedule-pill-row">
                  <strong>Datang</strong>
                  <b>
                    {formatScheduleTime(activeSchedule?.checkInStart)} -{" "}
                    {formatScheduleTime(activeSchedule?.checkInEnd)}
                  </b>
                </div>
                <div className="schedule-pill-row">
                  <strong>Terlambat</strong>
                  <b>
                    {formatScheduleTime(activeSchedule?.lateStart)} -{" "}
                    {formatScheduleTime(activeSchedule?.lateEnd)}
                  </b>
                </div>
                <div className="schedule-pill-row">
                  <strong>Pulang</strong>
                  <b>
                    {formatScheduleTime(activeSchedule?.checkOutStart)} -{" "}
                    {formatScheduleTime(activeSchedule?.checkOutEnd)}
                  </b>
                </div>
              </div>
            </div>
            <InfoPill label="Radius Maks." value={`${settings.radiusMeters} meter`} />
            <InfoPill label="Akurasi GPS" value={locationAccuracy} />
            <InfoPill
              label="Lokasi Saat Ini"
              value={
                locationLoading
                  ? "Memuat..."
                  : currentLocation
                    ? `${currentLocation.latitude.toFixed(5)}, ${currentLocation.longitude.toFixed(5)}`
                    : "Tidak tersedia"
              }
            />
          </div>

          {attendanceWindow.holiday.isNationalHoliday ? (
            <div className="holiday-label">
              Hari Libur Nasional{attendanceWindow.holiday.name ? ` - ${attendanceWindow.holiday.name}` : ""}
            </div>
          ) : null}

          {isOffDay ? (
            <div
              className={`inline-message ${
                attendanceWindow.holiday.isNationalHoliday ? "error" : "warning"
              }`}
            >
              {blockedMessage}
            </div>
          ) : null}

          {!isOffDay && !canSubmitByTime ? (
            <div className="inline-message warning">{blockedMessage}</div>
          ) : null}

          <div className={`status-box radius-status ${canSubmitByRadius ? "success" : "warning"}`}>
            <span className="radius-status-label">Status Radius</span>
            <strong>{radiusStatusText}</strong>
            <p>{radiusHelperText}</p>
          </div>

          {!isOffDay ? (
            <label className="upload-card">
              <div className="upload-header">
                <Camera size={20} />
                <span>Unggah Foto Absensi</span>
              </div>
              <input
                type="file"
                accept="image/*"
                capture="user"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] ?? null;

                  if (!nextFile) {
                    setPhotoFile(null);
                    return;
                  }

                  if (!nextFile.type.startsWith("image/")) {
                    setMessage({ type: "error", text: "File yang dipilih harus berupa gambar." });
                    event.target.value = "";
                    return;
                  }

                  if (nextFile.size > 15 * 1024 * 1024) {
                    setMessage({
                      type: "error",
                      text: "Ukuran foto terlalu besar. Pilih foto di bawah 15 MB.",
                    });
                    event.target.value = "";
                    return;
                  }

                  setMessage({
                    type: "warning",
                    text:
                      nextFile.size > 1_500_000
                        ? "Foto akan dikompres dulu sebelum diupload supaya lebih cepat."
                        : "",
                  });
                  setPhotoFile(nextFile);
                }}
              />
              {previewUrl ? (
                <img className="upload-preview" src={previewUrl} alt="Preview absensi" />
              ) : null}
            </label>
          ) : null}

          {message.text ? <div className={`inline-message ${message.type}`}>{message.text}</div> : null}

          {!isOffDay ? (
            <button
              className="primary-button"
              type="submit"
              disabled={locationLoading || submitLoading}
            >
              {submitLoading
                ? "Mengirim..."
                : mode === "checkin"
                  ? "Kirim Absen Datang"
                  : "Kirim Absen Pulang"}
            </button>
          ) : null}
        </form>
      </div>
    </section>
  );
}

export default AttendancePage;
