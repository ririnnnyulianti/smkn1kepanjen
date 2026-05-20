import {
  DAY_ORDER,
  DEFAULT_ALLOWED_RADIUS_METERS,
  DEFAULT_ATTENDANCE_SETTINGS,
  DEFAULT_TARGET_LOCATION,
  DEFAULT_WEEKLY_SCHEDULE,
} from "./constants";

const JAKARTA_TIMEZONE = "Asia/Jakarta";
const SCHEDULE_FIELDS = [
  "checkInStart",
  "checkInEnd",
  "lateStart",
  "lateEnd",
  "checkOutStart",
  "checkOutEnd",
];

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

function getJakartaTimeParts(date) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: JAKARTA_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const hours = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minutes = Number(parts.find((part) => part.type === "minute")?.value ?? 0);

  return { hours, minutes };
}

function formatWithTimeZone(date, options) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: JAKARTA_TIMEZONE,
    ...options,
  }).format(date);
}

function isValidTimeString(value) {
  return typeof value === "string" && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
}

function sanitizeTime(value, fallbackValue = null) {
  if (value === null) {
    return null;
  }

  if (isValidTimeString(value)) {
    return value;
  }

  return isValidTimeString(fallbackValue) ? fallbackValue : null;
}

function getRangeLabel(start, end) {
  return `${formatScheduleTime(start)} - ${formatScheduleTime(end)}`;
}

function addMinutesToTimeString(value, deltaMinutes) {
  if (!isValidTimeString(value)) {
    return null;
  }

  const nextMinutes = timeStringToMinutes(value) + deltaMinutes;
  const safeMinutes = Math.max(0, Math.min(nextMinutes, 23 * 60 + 59));
  const hours = `${Math.floor(safeMinutes / 60)}`.padStart(2, "0");
  const minutes = `${safeMinutes % 60}`.padStart(2, "0");

  return `${hours}:${minutes}`;
}

function getLegacyFallback(field, rawDay, defaultDay) {
  const legacyCheckIn = sanitizeTime(rawDay?.checkIn, defaultDay.checkInStart);
  const legacyCheckOut = sanitizeTime(rawDay?.checkOut, defaultDay.checkOutEnd);

  switch (field) {
    case "checkInStart":
    case "checkInEnd":
      return legacyCheckIn ?? defaultDay[field];
    case "lateStart":
      return legacyCheckIn ? addMinutesToTimeString(legacyCheckIn, 1) : defaultDay.lateStart;
    case "lateEnd":
    case "checkOutStart":
    case "checkOutEnd":
      return legacyCheckOut ?? defaultDay[field];
    default:
      return defaultDay[field];
  }
}

function normalizeDaySchedule(rawDay, defaultDay) {
  const normalized = {
    isActive:
      typeof rawDay?.isActive === "boolean" ? rawDay.isActive : defaultDay.isActive,
  };

  for (const field of SCHEDULE_FIELDS) {
    normalized[field] = sanitizeTime(
      rawDay?.[field],
      getLegacyFallback(field, rawDay, defaultDay)
    );
  }

  if (!normalized.isActive) {
    for (const field of SCHEDULE_FIELDS) {
      normalized[field] = null;
    }
  }

  return normalized;
}

export function haversineDistance(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
}

export function isWithinAllowedRadius(latitude, longitude, settings) {
  const safeSettings = normalizeAttendanceSettings(settings);

  return (
    haversineDistance(
      latitude,
      longitude,
      safeSettings.location.latitude,
      safeSettings.location.longitude
    ) <= safeSettings.radiusMeters
  );
}

export function getAttendanceWindow(settings, now = new Date(), holidayInfo = null) {
  const safeSettings = normalizeAttendanceSettings(settings);
  const dayKey = getDayKey(now);
  const schedule = safeSettings.weeklySchedule[dayKey] ?? DEFAULT_WEEKLY_SCHEDULE[dayKey];
  const holiday = normalizeHolidayInfo(holidayInfo);

  if (holiday.isNationalHoliday) {
    return {
      dayKey,
      schedule,
      holiday,
      isOffDay: true,
      offReason: "national_holiday",
      checkInStatus: "closed",
      checkOutStatus: "closed",
      canCheckIn: false,
      canCheckOut: false,
      attendanceStatus: null,
      isLate: false,
      withinHours: false,
    };
  }

  if (!schedule?.isActive || !isScheduleConfigured(schedule)) {
    return {
      dayKey,
      schedule,
      holiday,
      isOffDay: true,
      offReason: "inactive_schedule",
      checkInStatus: "closed",
      checkOutStatus: "closed",
      canCheckIn: false,
      canCheckOut: false,
      attendanceStatus: null,
      isLate: false,
      withinHours: false,
    };
  }

  const { hours, minutes } = getJakartaTimeParts(now);
  const currentMinutes = hours * 60 + minutes;
  const checkInStartMinutes = timeStringToMinutes(schedule.checkInStart);
  const checkInEndMinutes = timeStringToMinutes(schedule.checkInEnd);
  const lateStartMinutes = timeStringToMinutes(schedule.lateStart);
  const lateEndMinutes = timeStringToMinutes(schedule.lateEnd);
  const checkOutStartMinutes = timeStringToMinutes(schedule.checkOutStart);
  const checkOutEndMinutes = timeStringToMinutes(schedule.checkOutEnd);

  let checkInStatus = "closed";
  let attendanceStatus = null;

  if (currentMinutes < checkInStartMinutes) {
    checkInStatus = "not_open";
  } else if (currentMinutes <= checkInEndMinutes) {
    checkInStatus = "normal";
    attendanceStatus = "hadir";
  } else if (currentMinutes >= lateStartMinutes && currentMinutes <= lateEndMinutes) {
    checkInStatus = "late";
    attendanceStatus = "terlambat";
  }

  let checkOutStatus = "closed";
  if (currentMinutes < checkOutStartMinutes) {
    checkOutStatus = "not_open";
  } else if (currentMinutes <= checkOutEndMinutes) {
    checkOutStatus = "open";
  }

  return {
    dayKey,
    schedule,
    holiday,
    isOffDay: false,
    offReason: null,
    checkInStatus,
    checkOutStatus,
    canCheckIn: checkInStatus === "normal" || checkInStatus === "late",
    canCheckOut: checkOutStatus === "open",
    attendanceStatus,
    isLate: attendanceStatus === "terlambat",
    withinHours: checkInStatus === "normal" || checkInStatus === "late" || checkOutStatus === "open",
  };
}

export function getAttendanceBlockedMessage(attendanceWindow, mode, dayLabel) {
  if (attendanceWindow.isOffDay) {
    if (attendanceWindow.offReason === "national_holiday") {
      const holidayName = attendanceWindow.holiday.name
        ? ` (${attendanceWindow.holiday.name})`
        : "";
      return `Hari ini Hari Libur Nasional${holidayName}. Presensi tidak bisa dilakukan.`;
    }

    return `Hari ini ${dayLabel} libur. Tidak ada presensi yang perlu dikirim.`;
  }

  if (mode === "checkin") {
    if (attendanceWindow.checkInStatus === "not_open") {
      return "Jam presensi datang belum dibuka.";
    }

    if (attendanceWindow.checkInStatus === "closed") {
      return "Jam presensi datang sudah ditutup. Silakan lihat jadwal presensi.";
    }
  }

  if (attendanceWindow.checkOutStatus === "not_open") {
    return "Jam presensi pulang belum dibuka.";
  }

  if (attendanceWindow.checkOutStatus === "closed") {
    return "Jam presensi pulang sudah ditutup.";
  }

  return "";
}

export function getAttendanceScheduleSummary(schedule) {
  if (!schedule?.isActive || !isScheduleConfigured(schedule)) {
    return "Libur";
  }

  return [
    `Datang ${getRangeLabel(schedule.checkInStart, schedule.checkInEnd)}`,
    `Terlambat ${getRangeLabel(schedule.lateStart, schedule.lateEnd)}`,
    `Pulang ${getRangeLabel(schedule.checkOutStart, schedule.checkOutEnd)}`,
  ].join(" • ");
}

export function getScheduleValidationErrors(schedule) {
  if (!schedule?.isActive) {
    return [];
  }

  const missingFields = SCHEDULE_FIELDS.filter((field) => !isValidTimeString(schedule[field]));
  if (missingFields.length > 0) {
    return ["Semua range jam harus diisi lengkap untuk hari aktif."];
  }

  const checkInStart = timeStringToMinutes(schedule.checkInStart);
  const checkInEnd = timeStringToMinutes(schedule.checkInEnd);
  const lateStart = timeStringToMinutes(schedule.lateStart);
  const lateEnd = timeStringToMinutes(schedule.lateEnd);
  const checkOutStart = timeStringToMinutes(schedule.checkOutStart);
  const checkOutEnd = timeStringToMinutes(schedule.checkOutEnd);

  const errors = [];

  if (checkInStart > checkInEnd) {
    errors.push("Jam datang harus berurutan dari waktu lebih awal ke lebih akhir.");
  }

  if (lateStart > lateEnd) {
    errors.push("Jam terlambat harus berurutan dari waktu lebih awal ke lebih akhir.");
  }

  if (checkOutStart > checkOutEnd) {
    errors.push("Jam pulang harus berurutan dari waktu lebih awal ke lebih akhir.");
  }

  if (checkInEnd >= lateStart) {
    errors.push("Jam datang harus berakhir sebelum jam terlambat dimulai.");
  }

  if (lateEnd >= checkOutStart) {
    errors.push("Jam terlambat harus berakhir sebelum jam pulang dibuka.");
  }

  return errors;
}

export function isScheduleConfigured(schedule) {
  return SCHEDULE_FIELDS.every((field) => isValidTimeString(schedule?.[field]));
}

export function normalizeHolidayInfo(holidayInfo) {
  const holidayList = Array.isArray(holidayInfo?.holidayList)
    ? holidayInfo.holidayList.filter((item) => typeof item === "string" && item.trim())
    : [];

  return {
    date: typeof holidayInfo?.date === "string" ? holidayInfo.date : null,
    isHoliday: Boolean(holidayInfo?.isHoliday),
    isNationalHoliday: Boolean(holidayInfo?.isNationalHoliday),
    holidayList,
    name: holidayList[0] ?? null,
  };
}

export function getDayKey(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: JAKARTA_TIMEZONE,
    weekday: "long",
  });
  const weekday = formatter.format(date).toLowerCase();

  return (
    {
      monday: "senin",
      tuesday: "selasa",
      wednesday: "rabu",
      thursday: "kamis",
      friday: "jumat",
      saturday: "sabtu",
      sunday: "minggu",
    }[weekday] ?? "senin"
  );
}

export function getCurrentWeekDates(date = new Date()) {
  const jakartaDate = getJakartaDateParts(date);
  const currentDateUtc = new Date(
    Date.UTC(jakartaDate.year, jakartaDate.month - 1, jakartaDate.day)
  );
  const currentDayIndex = DAY_ORDER.indexOf(getDayKey(date));
  const startOfWeekUtc = new Date(currentDateUtc);

  startOfWeekUtc.setUTCDate(currentDateUtc.getUTCDate() - Math.max(currentDayIndex, 0));

  return DAY_ORDER.reduce((result, dayKey, index) => {
    const nextDate = new Date(startOfWeekUtc);
    nextDate.setUTCDate(startOfWeekUtc.getUTCDate() + index);
    result[dayKey] = nextDate;
    return result;
  }, {});
}

export function formatTime(date) {
  return formatWithTimeZone(date, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).replaceAll(":", ".");
}

export function formatTimeShort(date) {
  return formatWithTimeZone(date, {
    hour: "2-digit",
    minute: "2-digit",
  }).replaceAll(":", ".");
}

export function formatDate(date) {
  return formatWithTimeZone(date, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateShort(date) {
  return formatWithTimeZone(date, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatWeekDate(date) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function buildDateKey(date) {
  const { year, month, day } = getJakartaDateParts(date);

  return `${year}-${`${month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
}

export function getCalendarMatrix(selectedDate) {
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: firstDayOfMonth + daysInMonth }, (_, index) =>
    index < firstDayOfMonth ? null : index - firstDayOfMonth + 1
  );
}

export function timeStringToMinutes(value) {
  if (!isValidTimeString(value)) {
    return 0;
  }

  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatScheduleTime(value) {
  return value ? value.replace(":", ".") : "-";
}

export function normalizeAttendanceSettings(rawSettings) {
  const location = rawSettings?.location ?? {};
  const weeklySchedule = DAY_ORDER.reduce((result, dayKey) => {
    const defaultDay = DEFAULT_WEEKLY_SCHEDULE[dayKey];
    const rawDay = rawSettings?.weeklySchedule?.[dayKey];
    result[dayKey] = normalizeDaySchedule(rawDay, defaultDay);
    return result;
  }, {});

  return {
    name:
      typeof rawSettings?.name === "string" && rawSettings.name.trim()
        ? rawSettings.name.trim()
        : DEFAULT_ATTENDANCE_SETTINGS.name,
    radiusMeters:
      Number.isFinite(Number(rawSettings?.radiusMeters)) && Number(rawSettings.radiusMeters) > 0
        ? Number(rawSettings.radiusMeters)
        : DEFAULT_ALLOWED_RADIUS_METERS,
    location: {
      latitude:
        Number.isFinite(Number(location.latitude))
          ? Number(location.latitude)
          : DEFAULT_TARGET_LOCATION.latitude,
      longitude:
        Number.isFinite(Number(location.longitude))
          ? Number(location.longitude)
          : DEFAULT_TARGET_LOCATION.longitude,
      name:
        typeof location.name === "string" && location.name.trim()
          ? location.name.trim()
          : DEFAULT_TARGET_LOCATION.name,
    },
    weeklySchedule,
  };
}
