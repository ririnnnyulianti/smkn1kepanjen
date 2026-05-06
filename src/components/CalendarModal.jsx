function CalendarModal({
  calendarDays,
  monthName,
  onClose,
  onNextMonth,
  onPreviousMonth,
  selectedMonth,
}) {
  const today = new Date();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>Kalender</h3>
          <button className="text-button" onClick={onClose}>
            Tutup
          </button>
        </div>

        <div className="calendar-toolbar">
          <button className="icon-button" onClick={onPreviousMonth}>
            {"<"}
          </button>
          <strong>{monthName}</strong>
          <button className="icon-button" onClick={onNextMonth}>
            {">"}
          </button>
        </div>

        <div className="calendar-grid">
          {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((day) => (
            <span key={day} className="calendar-day-name">
              {day}
            </span>
          ))}
          {calendarDays.map((day, index) => {
            const isToday =
              day &&
              day === today.getDate() &&
              selectedMonth.getMonth() === today.getMonth() &&
              selectedMonth.getFullYear() === today.getFullYear();

            return (
              <div
                key={`${day ?? "empty"}-${index}`}
                className={`calendar-day${isToday ? " today" : ""}`}
              >
                {day ?? ""}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default CalendarModal;
