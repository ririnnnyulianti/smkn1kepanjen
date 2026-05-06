import { useState } from "react";
import { useNavigate } from "react-router-dom";

import logo from "../assets/logo.png";
import { SCHOOL_NAME } from "../constants";
import { useAuth } from "../context/AuthContext";

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [nisn, setNisn] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!nisn.trim() || !password.trim()) {
      setError("NISN dan Kata Sandi harus diisi");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const success = await login(nisn.trim(), password.trim());
      if (success) {
        navigate("/", { replace: true });
        return;
      }

      setError("NISN atau Kata Sandi salah");
    } catch (error) {
      console.error(error);
      setError(error.message || "Terjadi kesalahan, coba lagi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="auth-brand">
          <img className="auth-logo" src={logo} alt="Logo" />
          <p className="eyebrow">Web React Version</p>
          <h1>{SCHOOL_NAME}</h1>
          <p>Sistem Absensi Siswa berbasis browser.</p>
        </div>

        <form className="auth-card" onSubmit={handleSubmit}>
          <label className="field">
            <span>NISN</span>
            <input
              value={nisn}
              onChange={(event) => setNisn(event.target.value)}
              placeholder="Masukkan NISN Anda"
              inputMode="numeric"
            />
          </label>

          <label className="field">
            <span>KATA SANDI</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Masukkan Kata Sandi Anda"
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Memproses..." : "Masuk"}
          </button>

          <button
            className="text-button"
            type="button"
            onClick={() => navigate("/reset-password")}
          >
            Lupa Kata Sandi?
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
