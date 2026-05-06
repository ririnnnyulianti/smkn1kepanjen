import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { MOCK_USER, USER_ROLES } from "../constants";
import { auth, db } from "../firebase";

const AuthContext = createContext(undefined);
const USER_COLLECTION = "users";
const LOGIN_INDEX_COLLECTION = "login_index";

export function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setIsLoggedIn(false);
        setIsLoading(false);
        return;
      }

      try {
        const profile = await loadUserProfileByUid(firebaseUser.uid);
        if (!profile) {
          await signOut(auth);
          throw new Error(
            "Profil pengguna tidak ditemukan di Firestore. Pastikan collection users sudah diisi."
          );
        }

        setUser(profile);
        setIsLoggedIn(true);
      } catch (error) {
        console.error("Error checking auth", error);
        setUser(null);
        setIsLoggedIn(false);
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  async function login(nisn, password) {
    try {
      const loginIndexSnapshot = await getDoc(doc(db, LOGIN_INDEX_COLLECTION, nisn));

      if (!loginIndexSnapshot.exists()) {
        return false;
      }

      const loginIndexData = loginIndexSnapshot.data();
      const email =
        typeof loginIndexData.email === "string" ? loginIndexData.email.trim() : "";

      if (!email) {
        throw new Error(
          "Akun ini belum punya email login. Lengkapi dokumen login_index dan users di Firestore."
        );
      }

      const credential = await signInWithEmailAndPassword(auth, email, password);
      const profile = await loadUserProfileByUid(credential.user.uid);

      if (!profile) {
        throw new Error(
          "Login berhasil, tetapi profil users tidak ditemukan. Pastikan dokumen users memakai UID Firebase Auth."
        );
      }

      setUser(profile);
      setIsLoggedIn(true);
      return true;
    } catch (error) {
      console.error("Error logging in with Firebase", error);
      throw new Error(getLoginErrorMessage(error));
    }
  }

  async function logout() {
    await signOut(auth);
    setUser(null);
    setIsLoggedIn(false);
  }

  const value = useMemo(
    () => ({
      isAdmin: user?.role === USER_ROLES.admin,
      isLoggedIn,
      isLoading,
      login,
      logout,
      user,
    }),
    [isLoggedIn, isLoading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

function normalizeProfile(profile) {
  return {
    uid: profile?.uid ?? "-",
    nisn: `${profile?.nisn ?? "-"}`,
    name: profile?.name ?? "-",
    id: profile?.id ?? "-",
    kelas: profile?.kelas ?? "-",
    jurusan: profile?.jurusan ?? "-",
    tanggalLahir: profile?.tanggalLahir ?? "-",
    email: profile?.email ?? "-",
    phone: profile?.phone ?? "-",
    alamat: profile?.alamat ?? "-",
    avatar: profile?.avatar ?? MOCK_USER.avatar,
    role: profile?.role === USER_ROLES.admin ? USER_ROLES.admin : USER_ROLES.user,
  };
}

async function loadUserProfileByUid(uid) {
  if (!uid) {
    return null;
  }

  const snapshot = await getDoc(doc(db, USER_COLLECTION, uid));

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();

  return normalizeProfile({
    uid,
    nisn: `${data.nisn ?? "-"}`,
    name: data.name ?? data.nama ?? "-",
    id: data.id ?? data.studentId ?? uid,
    kelas: data.kelas ?? "-",
    jurusan: data.jurusan ?? "-",
    tanggalLahir: data.tanggalLahir ?? "-",
    email: data.email ?? "-",
    phone: data.phone ?? data.telepon ?? "-",
    alamat: data.alamat ?? "-",
    avatar: data.avatar ?? data.photoUrl ?? MOCK_USER.avatar,
    role: data.role ?? USER_ROLES.user,
  });
}

function getLoginErrorMessage(error) {
  switch (error?.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "NISN atau kata sandi salah.";
    case "auth/too-many-requests":
      return "Terlalu banyak percobaan login. Coba lagi beberapa saat.";
    case "auth/network-request-failed":
      return "Koneksi ke Firebase gagal. Periksa internet lalu coba lagi.";
    default:
      return error?.message || "Gagal login ke Firebase.";
  }
}
