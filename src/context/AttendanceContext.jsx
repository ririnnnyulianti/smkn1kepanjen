import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, query, setDoc, where } from "firebase/firestore";

import { IS_ATTENDANCE_TEST_MODE, SCHOOL_NAME } from "../constants";
import { useAuth } from "./AuthContext";
import { useSettings } from "./SettingsContext";
import { db } from "../firebase";
import { buildDateKey, formatDateShort, formatTimeShort, getAttendanceWindow } from "../utils";

const AttendanceContext = createContext(undefined);
const STORAGE_KEY = "web_attendance_records";

export function AttendanceProvider({ children }) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadAttendance() {
      if (!user?.nisn) {
        setRecords([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      if (IS_ATTENDANCE_TEST_MODE) {
        try {
          const stored = window.localStorage.getItem(getStorageKey(user.nisn));
          if (active && stored) {
            setRecords(JSON.parse(stored));
          } else if (active) {
            setRecords([]);
          }
        } catch (error) {
          console.error("Error loading attendance from local test storage", error);
          if (active) {
            setRecords([]);
          }
        } finally {
          if (active) {
            setIsLoading(false);
          }
        }
        return;
      }

      try {
        const snapshot = await withTimeout(
          getDocs(query(collection(db, "attendance"), where("userNisn", "==", user.nisn))),
          12000,
          "Firebase Firestore terlalu lama merespons. Pastikan rules Firestore sudah dideploy."
        );
        const firestoreRecords = snapshot.docs
          .map((attendanceDoc) => normalizeRecord(attendanceDoc.data(), attendanceDoc.id))
          .sort((left, right) => (right.dateValue ?? 0) - (left.dateValue ?? 0));

        if (!active) {
          return;
        }

        setRecords(firestoreRecords);
        window.localStorage.setItem(getStorageKey(user.nisn), JSON.stringify(firestoreRecords));
      } catch (error) {
        console.error("Error loading attendance from Firestore", error);

        try {
          const stored = window.localStorage.getItem(getStorageKey(user.nisn));
          if (active && stored) {
            setRecords(JSON.parse(stored));
          }
        } catch (storageError) {
          console.error("Error loading attendance from local cache", storageError);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadAttendance();

    return () => {
      active = false;
    };
  }, [user]);

  async function syncRecord(record) {
    if (!user?.nisn) {
      throw new Error("User belum login.");
    }

    const dateMetadata = getDateMetadata(record.date);
    const normalizedRecord = {
      ...record,
      ...dateMetadata,
      userNisn: user.nisn,
      userName: user.name,
      kelas: user.kelas,
      jurusan: user.jurusan,
    };
    const updatedRecords = [normalizedRecord, ...records.filter((item) => item.date !== record.date)]
      .sort((left, right) => (right.dateValue ?? 0) - (left.dateValue ?? 0));

    if (IS_ATTENDANCE_TEST_MODE) {
      setRecords(updatedRecords);
      window.localStorage.setItem(getStorageKey(user.nisn), JSON.stringify(updatedRecords));
      return;
    }

    const recordId = `${user.nisn}_${record.date}`;
    await withTimeout(
      setDoc(doc(db, "attendance", recordId), normalizedRecord, { merge: true }),
      12000,
      "Gagal menyimpan absensi ke Firestore. Cek koneksi dan pastikan rules Firestore sudah dideploy."
    );

    setRecords(updatedRecords);
    window.localStorage.setItem(getStorageKey(user.nisn), JSON.stringify(updatedRecords));
  }

  async function addCheckIn(time, isLate, photoFile) {
    if (!user?.nisn) {
      throw new Error("Sesi login tidak ditemukan.");
    }

    const attendanceWindow = getAttendanceWindow(settings, time);
    if (attendanceWindow.isOffDay) {
      throw new Error("Hari ini libur. Tidak ada absensi masuk yang perlu dikirim.");
    }

    const dateKey = buildDateKey(time);
    const dateLabel = formatDateShort(time);
    const timeLabel = formatTimeShort(time);
    const existing = records.find((record) => record.date === dateKey);
    const photoUri = photoFile
      ? await uploadAttendancePhoto(user.nisn, photoFile, dateKey, "checkin")
      : existing?.photoUri ?? null;

    if (existing) {
      await syncRecord({
        ...existing,
        checkInTime: timeLabel,
        status: isLate ? "terlambat" : "hadir",
        photoUri,
        dateValue: new Date(dateKey).getTime(),
      });
      return;
    }

    await syncRecord({
      id: `${user.nisn}_${dateKey}`,
      date: dateKey,
      dateLabel,
      dateValue: new Date(dateKey).getTime(),
      school: SCHOOL_NAME,
      checkInTime: timeLabel,
      checkOutTime: null,
      status: isLate ? "terlambat" : "hadir",
      photoUri,
    });
  }

  async function addCheckOut(time, photoFile) {
    if (!user?.nisn) {
      throw new Error("Sesi login tidak ditemukan.");
    }

    const attendanceWindow = getAttendanceWindow(settings, time);
    if (attendanceWindow.isOffDay) {
      throw new Error("Hari ini libur. Tidak ada absensi pulang yang perlu dikirim.");
    }

    const dateKey = buildDateKey(time);
    const dateLabel = formatDateShort(time);
    const timeLabel = formatTimeShort(time);
    const existing = records.find((record) => record.date === dateKey);
    const photoUri = photoFile
      ? await uploadAttendancePhoto(user.nisn, photoFile, dateKey, "checkout")
      : existing?.photoUri ?? null;

    if (existing) {
      await syncRecord({
        ...existing,
        checkOutTime: timeLabel,
        photoUri: photoUri ?? existing.photoUri,
        dateValue: new Date(dateKey).getTime(),
      });
      return;
    }

    await syncRecord({
      id: `${user.nisn}_${dateKey}`,
      date: dateKey,
      dateLabel,
      dateValue: new Date(dateKey).getTime(),
      school: SCHOOL_NAME,
      checkInTime: null,
      checkOutTime: timeLabel,
      status: "hadir",
      photoUri,
    });
  }

  const summary = useMemo(() => {
    const hadir = records.filter((record) => record.status === "hadir").length;
    const terlambat = records.filter((record) => record.status === "terlambat").length;
    const tidakHadir = records.filter((record) => record.status === "tidak_hadir").length;

    return { hadir, terlambat, tidakHadir };
  }, [records]);

  return (
    <AttendanceContext.Provider
      value={{ records, isLoading, addCheckIn, addCheckOut, summary }}
    >
      {children}
    </AttendanceContext.Provider>
  );
}

export function useAttendance() {
  const context = useContext(AttendanceContext);
  if (!context) {
    throw new Error("useAttendance must be used within an AttendanceProvider");
  }

  return context;
}

function getStorageKey(nisn) {
  return `${STORAGE_KEY}:${nisn}`;
}

function normalizeRecord(record, fallbackId) {
  return {
    id: record.id ?? fallbackId,
    date: record.date,
    dateLabel: record.dateLabel,
    dateValue: record.dateValue ?? new Date(record.date).getTime(),
    school: record.school ?? SCHOOL_NAME,
    checkInTime: record.checkInTime ?? null,
    checkOutTime: record.checkOutTime ?? null,
    status: record.status ?? "hadir",
    photoUri: record.photoUri ?? null,
    userNisn: record.userNisn ?? null,
  };
}

function getDateMetadata(dateKey) {
  if (!dateKey || !dateKey.includes("-")) {
    return {
      monthKey: null,
      year: null,
      month: null,
      day: null,
    };
  }

  const [year, month, day] = dateKey.split("-").map(Number);

  return {
    monthKey: `${year}-${`${month}`.padStart(2, "0")}`,
    year,
    month,
    day,
  };
}

async function uploadAttendancePhoto(nisn, file, dateKey, type) {
  try {
    return withTimeout(
      optimizeImageToDataUrl(file),
      12000,
      "Foto terlalu lama diproses. Coba pilih foto yang lebih kecil atau lebih ringan."
    );
  } catch (error) {
    console.error("Error processing attendance photo", error);
    throw new Error(getUploadErrorMessage(error));
  }
}

async function optimizeImageToDataUrl(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("File yang dipilih harus berupa gambar.");
  }

  const image = await loadImageFromFile(file);
  const maxDimension = 420;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Browser tidak bisa memproses foto.");
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);
  const attempts = [0.45, 0.3, 0.22];

  for (const quality of attempts) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= 650_000) {
      return dataUrl;
    }
  }

  const tinyCanvas = document.createElement("canvas");
  tinyCanvas.width = Math.max(1, Math.round(targetWidth * 0.7));
  tinyCanvas.height = Math.max(1, Math.round(targetHeight * 0.7));
  const tinyContext = tinyCanvas.getContext("2d");

  if (!tinyContext) {
    throw new Error("Browser tidak bisa memproses foto.");
  }

  tinyContext.drawImage(image, 0, 0, tinyCanvas.width, tinyCanvas.height);
  const fallbackDataUrl = tinyCanvas.toDataURL("image/jpeg", 0.18);

  if (fallbackDataUrl.length > 650_000) {
    throw new Error(
      "Foto masih terlalu besar untuk Firestore. Coba crop atau pilih foto yang lebih kecil."
    );
  }

  return fallbackDataUrl;
}

function getUploadErrorMessage(error) {
  if (error?.message && !error?.code) {
    return error.message;
  }

  switch (error?.code) {
    case "deadline-exceeded":
      return "Proses simpan foto timeout. Coba ulangi dengan foto yang lebih kecil.";
    default:
      return "Foto gagal diproses. Coba pilih foto yang lebih kecil atau lebih ringan.";
  }
}

async function loadImageFromFile(file) {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Foto tidak bisa dibaca."));
      element.src = imageUrl;
    });

    return image;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function withTimeout(promise, timeoutMs, timeoutMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    }),
  ]);
}
