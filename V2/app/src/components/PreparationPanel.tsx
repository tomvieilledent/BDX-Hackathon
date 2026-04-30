import { PREP_GUIDES } from '../constants';

export default function PreparationPanel() {
  return (
    <section className="panel">
      <h2>Guide de preparation</h2>
      <p className="panel-intro">Des actions claires a appliquer avant et pendant un evenement critique.</p>
      <div className="prep-grid">
        {PREP_GUIDES.map((guide) => (
          <article key={guide.title} className="prep-card">
            <h3>{guide.title}</h3>
            <ul>
              {guide.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
