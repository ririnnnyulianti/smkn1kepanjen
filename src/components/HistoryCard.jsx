import { CheckCircle2, Clock3, TriangleAlert, XCircle } from "lucide-react";

function HistoryCard({ onOpen, record }) {
  const config = {
    hadir: {
      label: "Hadir",
      icon: CheckCircle2,
      tone: "success",
    },
    terlambat: {
      label: "Terlambat",
      icon: Clock3,
      tone: "warning",
    },
    tidak_hadir: {
      label: "Tidak Hadir",
      icon: XCircle,
      tone: "danger",
    },
  }[record.status];

  const Icon = config?.icon ?? TriangleAlert;

  return (
    <article
      className={`history-card history-card-link ${config?.tone ?? ""}`}
      onClick={() => onOpen(record)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(record);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Buka foto absensi ${record.dateLabel}`}
    >
      <div className="history-header">
        <div className="history-date">
          <Icon size={18} />
          <strong>{record.dateLabel}</strong>
        </div>
        <span className={`badge ${config?.tone ?? ""}`}>{config?.label ?? "Unknown"}</span>
      </div>
      <p>{record.school}</p>
      <div className="history-meta">
        <span>Datang: {record.checkInTime ?? "-"}</span>
        <span>Pulang: {record.checkOutTime ?? "-"}</span>
      </div>
    </article>
  );
}

export default HistoryCard;
