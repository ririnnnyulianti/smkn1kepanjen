import { AttendanceProvider } from "./context/AttendanceContext";
import { AuthProvider } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import AppRoutes from "./AppRoutes";

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <AttendanceProvider>
          <AppRoutes />
        </AttendanceProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
