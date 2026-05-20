import { useEffect, useMemo, useState } from "react";

function CalendarModal({
  calendarDays,
  holidays,
  monthName,
  onClose,
  onNextMonth,
  onPreviousMonth,
  selectedMonth,
}) {
  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();
  const [selectedHolidayDate, setSelectedHolidayDate] = useState(null);

  const holidayMap = useMemo(
    () =>
      Object.fromEntries(
        (holidays ?? []).map((holiday) => [Number(holiday.date.split("-")[2]), holiday])
      ),
    [holidays]
  );

  useEffect(() => {
    if ((holidays ?? []).length === 0) {
      setSelectedHolidayDate(null);
      return;
    }

    const todayMatchesMonth =
      todayMonth === selectedMonth.getMonth() &&
      todayYear === selectedMonth.getFullYear();
    const todayHoliday = todayMatchesMonth ? holidayMap[todayDay] : null;

    setSelectedHolidayDate(todayHoliday ? todayHoliday.date : holidays[0].date);
  }, [holidayMap, holidays, selectedMonth, todayDay, todayMonth, todayYear]);

  const selectedHoliday = (holidays ?? []).find((holiday) => holiday.date === selectedHolidayDate) ?? null;

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
              day === todayDay &&
              selectedMonth.getMonth() === todayMonth &&
              selectedMonth.getFullYear() === todayYear;
            const holiday = day ? holidayMap[day] : null;
            const isSelectedHoliday = holiday?.date === selectedHolidayDate;

            return (
              <button
                type="button"
                key={`${day ?? "empty"}-${index}`}
                className={`calendar-day${isToday ? " today" : ""}${holiday ? " holiday" : ""}${
                  isSelectedHoliday ? " selected-holiday" : ""
                }`}
                disabled={!day}
                onClick={() => {
                  if (holiday) {
                    setSelectedHolidayDate(holiday.date);
                  }
                }}
              >
                {day ?? ""}
                {holiday ? <span className="calendar-day-dot" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>

        <div className="calendar-holiday-panel">
          <strong>Keterangan Hari Libur</strong>
          {selectedHoliday ? (
            <div className="calendar-holiday-detail">
              <span className="calendar-holiday-date">
                {new Intl.DateTimeFormat("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(new Date(selectedHoliday.date))}
              </span>
              <p>{selectedHoliday.name}</p>
            </div>
          ) : (holidays ?? []).length > 0 ? (
            <div className="calendar-holiday-list">
              {(holidays ?? []).map((holiday) => (
                <button
                  key={holiday.date}
                  type="button"
                  className="calendar-holiday-item"
                  onClick={() => setSelectedHolidayDate(holiday.date)}
                >
                  <span>{holiday.date}</span>
                  <strong>{holiday.name}</strong>
                </button>
              ))}
            </div>
          ) : (
            <p className="calendar-holiday-empty">
              Tidak ada hari libur nasional pada bulan ini.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default CalendarModal;
