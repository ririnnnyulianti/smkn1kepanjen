import { CalendarDays, Clock3, FileSpreadsheet, LogOut, Settings2, UserCircle2 } from "lucide-react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { SCHOOL_NAME } from "../constants";
import { useAuth } from "../context/AuthContext";
import AdminSchedulePage from "../pages/AdminSchedulePage";
import AdminMonthlyRecapPage from "../pages/AdminMonthlyRecapPage";
import AttendancePage from "../pages/AttendancePage";
import DashboardPage from "../pages/DashboardPage";
import HistoryPage from "../pages/HistoryPage";
import ProfilePage from "../pages/ProfilePage";

function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, user, logout } = useAuth();

  const navigationItems = [
    { path: "/", label: "Dasbor", icon: CalendarDays },
    { path: "/riwayat", label: "Riwayat", icon: Clock3 },
    { path: "/profil", label: "Profil", icon: UserCircle2 },
    ...(isAdmin
      ? [
          { path: "/admin/jadwal", label: "Edit Jadwal", icon: Settings2 },
          { path: "/admin/rekap-bulanan", label: "Data Absensi", icon: FileSpreadsheet },
        ]
      : []),
  ];

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="layout-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <p className="eyebrow">Absensi Web</p>
          <h2>{SCHOOL_NAME}</h2>
        </div>

        <div className="sidebar-user">
          <img src={user?.avatar} alt={user?.name} />
          <div>
            <strong>{user?.name}</strong>
            <span>{isAdmin ? "Admin" : user?.kelas}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.path);

            return (
              <button
                key={item.path}
                className={`nav-item${isActive ? " active" : ""}`}
                onClick={() => navigate(item.path)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <button className="logout-button" onClick={handleLogout}>
          <LogOut size={18} />
          <span>Keluar</span>
        </button>
      </aside>

      <main className="content-shell">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/riwayat" element={<HistoryPage />} />
          <Route path="/profil" element={<ProfilePage />} />
          <Route path="/absen-datang" element={<AttendancePage mode="checkin" />} />
          <Route path="/absen-pulang" element={<AttendancePage mode="checkout" />} />
          <Route
            path="/admin/jadwal"
            element={isAdmin ? <AdminSchedulePage /> : <Navigate to="/" replace />}
          />
          <Route
            path="/admin/rekap-bulanan"
            element={isAdmin ? <AdminMonthlyRecapPage /> : <Navigate to="/" replace />}
          />
        </Routes>
      </main>
    </div>
  );
}

export default MainLayout;
