import { useState } from "react";
import { Clock3 } from "lucide-react";

import HistoryCard from "../components/HistoryCard";
import { useAttendance } from "../context/AttendanceContext";

function HistoryPage() {
  const { records } = useAttendance();
  const [selectedRecord, setSelectedRecord] = useState(null);

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Riwayat</p>
          <h1>Riwayat Kehadiran</h1>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="empty-state">
          <Clock3 size={42} />
          <p>Belum ada riwayat kehadiran.</p>
        </div>
      ) : (
        <div className="history-list">
          {records.map((record) => (
            <HistoryCard key={record.id} record={record} onOpen={setSelectedRecord} />
          ))}
        </div>
      )}

      {selectedRecord ? (
        <div className="modal-backdrop" onClick={() => setSelectedRecord(null)}>
          <div className="modal-card history-photo-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Foto Absensi</h3>
              <button className="text-button" onClick={() => setSelectedRecord(null)}>
                Tutup
              </button>
            </div>
            <p className="history-photo-date">{selectedRecord.dateLabel}</p>
            {selectedRecord.photoUri ? (
              <img
                className="history-photo-modal-image"
                src={selectedRecord.photoUri}
                alt={`Foto absensi ${selectedRecord.dateLabel}`}
              />
            ) : (
              <div className="history-photo-empty">Foto untuk riwayat ini belum tersedia.</div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default HistoryPage;
