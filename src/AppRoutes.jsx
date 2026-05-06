import { Navigate, Route, Routes } from "react-router-dom";

import MainLayout from "./layouts/MainLayout";
import { useAuth } from "./context/AuthContext";
import { useSettings } from "./context/SettingsContext";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

function AppRoutes() {
  const { isLoggedIn, isLoading } = useAuth();
  const { isLoading: isSettingsLoading } = useSettings();

  if (isLoading || isSettingsLoading) {
    return <div className="app-loading">Memuat aplikasi...</div>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isLoggedIn ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/reset-password"
        element={isLoggedIn ? <Navigate to="/" replace /> : <ResetPasswordPage />}
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute isLoggedIn={isLoggedIn}>
            <MainLayout />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function ProtectedRoute({ isLoggedIn, children }) {
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default AppRoutes;
