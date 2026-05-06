import ProfileRow from "../components/ProfileRow";
import { useAuth } from "../context/AuthContext";

function ProfilePage() {
  const { user } = useAuth();

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Profil</p>
          <h1>Data Siswa</h1>
        </div>
      </div>

      <div className="profile-grid">
        <article className="profile-card">
          <img className="profile-photo-large" src={user?.avatar} alt={user?.name} />
          <h2>{user?.name}</h2>
          <p>{user?.nisn}</p>
          <span className="class-chip">{user?.kelas}</span>
        </article>

        <article className="details-card">
          <ProfileRow label="Role" value={user?.role} />
          <ProfileRow label="NISN" value={user?.nisn} />
          <ProfileRow label="Jurusan" value={user?.jurusan} />
          <ProfileRow label="Tanggal Lahir" value={user?.tanggalLahir} />
          <ProfileRow label="Email" value={user?.email} />
          <ProfileRow label="No. Telepon" value={user?.phone} />
          <ProfileRow label="Alamat" value={user?.alamat} />
        </article>
      </div>
    </section>
  );
}

export default ProfilePage;
