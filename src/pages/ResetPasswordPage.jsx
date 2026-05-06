import { useNavigate } from "react-router-dom";

function ResetPasswordPage() {
  const navigate = useNavigate();

  return (
    <div className="simple-page">
      <div className="simple-card">
        <h1>Reset Kata Sandi</h1>
        <p>
          Password sekarang sebaiknya dikelola lewat Firebase Authentication.
          Jika diperlukan, admin bisa reset dari Firebase Console atau kita lanjutkan
          dengan fitur reset via email.
        </p>
        <button className="primary-button" onClick={() => navigate("/login")}>
          Kembali ke Login
        </button>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
