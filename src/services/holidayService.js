import { buildDateKey, normalizeHolidayInfo } from "../utils";

const API_BASE_URL = "https://libur.deno.dev/api";
const STORAGE_PREFIX = "national-holiday:";
const MONTH_STORAGE_PREFIX = "national-holiday-month:";
const memoryCache = new Map();
const monthMemoryCache = new Map();

export async function getNationalHolidayInfo(date) {
  const dateKey = typeof date === "string" ? date : buildDateKey(date);

  if (memoryCache.has(dateKey)) {
    return memoryCache.get(dateKey);
  }

  const cached = readCachedHoliday(dateKey);
  if (cached) {
    memoryCache.set(dateKey, Promise.resolve(cached));
    return cached;
  }

  const request = fetchHoliday(dateKey)
    .then((result) => {
      writeCachedHoliday(dateKey, result);
      return result;
    })
    .catch((error) => {
      console.error("Error loading national holiday info", error);
      return normalizeHolidayInfo({
        date: dateKey,
        isHoliday: false,
        isNationalHoliday: false,
        holidayList: [],
      });
    });

  memoryCache.set(dateKey, request);
  return request;
}

export async function getNationalHolidaysByMonth(date) {
  const targetDate = typeof date === "string" ? new Date(date) : date;
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth() + 1;
  const monthKey = `${year}-${`${month}`.padStart(2, "0")}`;

  if (monthMemoryCache.has(monthKey)) {
    return monthMemoryCache.get(monthKey);
  }

  const cached = readCachedHolidayMonth(monthKey);
  if (cached) {
    monthMemoryCache.set(monthKey, Promise.resolve(cached));
    return cached;
  }

  const request = fetchHolidayMonth(year, month)
    .then((result) => {
      writeCachedHolidayMonth(monthKey, result);

      for (const holiday of result) {
        const normalized = normalizeHolidayInfo({
          date: holiday.date,
          isHoliday: true,
          isNationalHoliday: holiday.isNationalHoliday,
          holidayList: [holiday.name],
        });
        memoryCache.set(holiday.date, Promise.resolve(normalized));
        writeCachedHoliday(holiday.date, normalized);
      }

      return result;
    })
    .catch((error) => {
      console.error("Error loading holiday month info", error);
      return [];
    });

  monthMemoryCache.set(monthKey, request);
  return request;
}

async function fetchHoliday(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const response = await fetch(`${API_BASE_URL}?year=${year}&month=${month}&day=${day}`);

  if (!response.ok) {
    throw new Error(`Holiday API returned ${response.status}`);
  }

  const data = await response.json();

  return normalizeHolidayInfo({
    date: data?.date ?? dateKey,
    isHoliday: data?.is_holiday,
    isNationalHoliday: data?.is_national_holiday,
    holidayList: data?.holiday_list,
  });
}

async function fetchHolidayMonth(year, month) {
  const response = await fetch(`${API_BASE_URL}?year=${year}&month=${month}`);

  if (!response.ok) {
    throw new Error(`Holiday API returned ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter((item) => item?.date && item?.name)
    .map((item) => ({
      date: item.date,
      name: item.name,
      isNationalHoliday: Boolean(item.is_national_holiday),
    }));
}

function readCachedHoliday(dateKey) {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${dateKey}`);
    if (!raw) {
      return null;
    }

    return normalizeHolidayInfo(JSON.parse(raw));
  } catch (error) {
    console.error("Error reading cached holiday", error);
    return null;
  }
}

function writeCachedHoliday(dateKey, holidayInfo) {
  try {
    window.localStorage.setItem(
      `${STORAGE_PREFIX}${dateKey}`,
      JSON.stringify(holidayInfo)
    );
  } catch (error) {
    console.error("Error caching holiday info", error);
  }
}

function readCachedHolidayMonth(monthKey) {
  try {
    const raw = window.localStorage.getItem(`${MONTH_STORAGE_PREFIX}${monthKey}`);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    console.error("Error reading cached holiday month", error);
    return null;
  }
}

function writeCachedHolidayMonth(monthKey, holidays) {
  try {
    window.localStorage.setItem(
      `${MONTH_STORAGE_PREFIX}${monthKey}`,
      JSON.stringify(holidays)
    );
  } catch (error) {
    console.error("Error caching holiday month info", error);
  }
}
