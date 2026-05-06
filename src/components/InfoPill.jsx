function InfoPill({ label, value }) {
  return (
    <div className="info-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default InfoPill;
