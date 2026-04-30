import { EMERGENCY_NUMBERS } from '../constants';

export default function EmergencyPanel() {
  return (
    <section className="panel">
      <h2>Urgence immediate</h2>
      <p className="panel-intro">En cas de danger, appelez les services ci-dessous sans attendre.</p>
      <div className="emergency-grid">
        {EMERGENCY_NUMBERS.map((item) => (
          <a key={item.number} className="emergency-card" href={`tel:${item.number}`}>
            <span>{item.label}</span>
            <strong>{item.number}</strong>
          </a>
        ))}
      </div>
    </section>
  );
}
