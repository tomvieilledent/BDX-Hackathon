import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Alert } from '../types';

interface AlertListProps {
  alerts: Alert[];
}

export default function AlertList({ alerts }: AlertListProps) {
  if (!alerts.length) {
    return <div className="empty">Aucune alerte active sur cette zone.</div>;
  }

  return (
    <div className="list">
      {alerts.map((alert) => (
        <article className="card" key={alert.id}>
          <div className="card-head">
            <h3>{alert.title}</h3>
            <span className={`badge badge-${alert.level}`}>{alert.level}</span>
          </div>
          <p>{alert.description}</p>
          <div className="meta">
            <span>{alert.source}</span>
            <span>{alert.location.name}</span>
            <span>
              {formatDistanceToNow(new Date(alert.timestamp), {
                addSuffix: true,
                locale: fr
              })}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
