import { useMemo, useState } from 'react';
import type { RiskCategory, UserReport } from '../types';
import { CATEGORY_LABEL } from '../constants';

interface ReportsPanelProps {
  reports: UserReport[];
  onCreate: (payload: {
    category: RiskCategory;
    description: string;
    reporter?: string;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function ReportsPanel({ reports, onCreate, onDelete }: ReportsPanelProps) {
  const [category, setCategory] = useState<RiskCategory>('other');
  const [description, setDescription] = useState('');
  const [reporter, setReporter] = useState('');
  const [saving, setSaving] = useState(false);

  const sorted = useMemo(
    () => [...reports].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)),
    [reports]
  );

  return (
    <section className="grid-2">
      <div className="panel">
        <h2>Nouveau signalement</h2>
        <form
          className="report-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (description.trim().length < 10) {
              return;
            }
            setSaving(true);
            try {
              await onCreate({
                category,
                description: description.trim(),
                reporter: reporter.trim() || undefined
              });
              setDescription('');
            } finally {
              setSaving(false);
            }
          }}
        >
          <label>
            Categorie
            <select value={category} onChange={(e) => setCategory(e.target.value as RiskCategory)}>
              {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Ex: Fumee epaisse proche de la zone industrielle..."
            />
          </label>

          <label>
            Nom (optionnel)
            <input value={reporter} onChange={(e) => setReporter(e.target.value)} placeholder="Prenom Nom" />
          </label>

          <button type="submit" disabled={saving || description.trim().length < 10}>
            {saving ? 'Envoi...' : 'Publier le signalement'}
          </button>
        </form>
      </div>

      <div className="panel">
        <h2>Signalements recents</h2>
        <div className="list compact">
          {sorted.map((report) => (
            <article key={report.id} className="card">
              <div className="card-head">
                <h3>{CATEGORY_LABEL[report.category]}</h3>
                <button className="danger" type="button" onClick={() => onDelete(report.id)}>
                  Supprimer
                </button>
              </div>
              <p>{report.description}</p>
              <div className="meta">
                <span>{report.reporter}</span>
                <span>{report.location.name}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
