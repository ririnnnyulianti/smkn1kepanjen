import {
  DAY_ORDER,
  DEFAULT_ALLOWED_RADIUS_METERS,
  DEFAULT_ATTENDANCE_SETTINGS,
  DEFAULT_TARGET_LOCATION,
  DEFAULT_WEEKLY_SCHEDULE,
} from "./constants";

const JAKARTA_TIMEZONE = "Asia/Jakarta";

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

export function getAttendanceWindow(settings, now = new Date()) {
  const safeSettings = normalizeAttendanceSettings(settings);
  const dayKey = getDayKey(now);
  const schedule = safeSettings.weeklySchedule[dayKey] ?? DEFAULT_WEEKLY_SCHEDULE[dayKey];

  if (!schedule?.isActive || !schedule?.checkIn || !schedule?.checkOut) {
    return {
      dayKey,
      schedule,
      isOffDay: true,
      withinHours: false,
      isLate: false,
    };
  }

  const { hours, minutes } = getJakartaTimeParts(now);
  const currentMinutes = hours * 60 + minutes;
  const startMinutes = timeStringToMinutes(schedule.checkIn);
  const endMinutes = timeStringToMinutes(schedule.checkOut);

  if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
    return {
      dayKey,
      schedule,
      isOffDay: false,
      withinHours: false,
      isLate: false,
    };
  }

  return {
    dayKey,
    schedule,
    isOffDay: false,
    withinHours: true,
    isLate: currentMinutes > startMinutes,
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
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .format(date)
    .replaceAll(":", ".");
}

export function formatTimeShort(date) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replaceAll(":", ".");
}

export function formatDate(date) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDateShort(date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
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
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
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
  if (!value || !value.includes(":")) {
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

    result[dayKey] = {
      isActive:
        typeof rawDay?.isActive === "boolean" ? rawDay.isActive : defaultDay.isActive,
      checkIn:
        typeof rawDay?.checkIn === "string" || rawDay?.checkIn === null
          ? rawDay.checkIn
          : defaultDay.checkIn,
      checkOut:
        typeof rawDay?.checkOut === "string" || rawDay?.checkOut === null
          ? rawDay.checkOut
          : defaultDay.checkOut,
    };

    if (!result[dayKey].isActive) {
      result[dayKey].checkIn = null;
      result[dayKey].checkOut = null;
    }

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
