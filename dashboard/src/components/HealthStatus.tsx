import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { HealthResponse } from '../services/api';
import './HealthStatus.css';

export const HealthStatus = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const data = await api.getHealth();
        setHealth(data);
        setError(null);
      } catch (err) {
        setError('Failed to fetch health data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="health-status loading">Loading health data...</div>;
  if (error) return <div className="health-status error">{error}</div>;
  if (!health) return null;

  const statusColor = health.status === 'healthy' ? 'green' : 'red';

  return (
    <div className="health-status">
      <div className="health-header">
        <h2>System Health</h2>
        <div className={`status-badge ${statusColor}`}>
          <span className="status-dot"></span>
          {health.status.toUpperCase()}
        </div>
      </div>

      <div className="health-grid">
        <div className="health-card">
          <div className="card-icon">⏱️</div>
          <div className="card-content">
            <div className="card-label">Uptime</div>
            <div className="card-value">
              {Math.floor(health.metrics.uptime_seconds / 60)}m {health.metrics.uptime_seconds % 60}s
            </div>
          </div>
        </div>

        <div className="health-card">
          <div className="card-icon">📊</div>
          <div className="card-content">
            <div className="card-label">Events Processed</div>
            <div className="card-value">{health.metrics.events_processed}</div>
          </div>
        </div>

        <div className="health-card">
          <div className="card-icon">📋</div>
          <div className="card-content">
            <div className="card-label">Queue Depth</div>
            <div className="card-value">{health.metrics.queue_depth}</div>
          </div>
        </div>

        <div className="health-card">
          <div className="card-icon">💾</div>
          <div className="card-content">
            <div className="card-label">Database</div>
            <div className={`card-value ${health.database.connected ? 'connected' : 'disconnected'}`}>
              {health.database.connected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
        </div>
      </div>

      <div className="components-section">
        <h3>Components Status</h3>
        <div className="components-grid">
          {health.components.map((component) => (
            <div key={component.name} className="component-card">
              <div className="component-header">
                <span className="component-name">{component.name.replace(/_/g, ' ')}</span>
                <span className={`component-status ${component.status}`}>
                  {component.status === 'healthy' ? '✓' : '✗'}
                </span>
              </div>
              <div className="component-details">
                {Object.entries(component.details).map(([key, value]) => (
                  <div key={key} className="detail-row">
                    <span className="detail-key">{key.replace(/_/g, ' ')}:</span>
                    <span className="detail-value">{JSON.stringify(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
