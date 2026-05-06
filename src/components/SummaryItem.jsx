function SummaryItem({ label, value }) {
  return (
    <div className="summary-item">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export default SummaryItem;
