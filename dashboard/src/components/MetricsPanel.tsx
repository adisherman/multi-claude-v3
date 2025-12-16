import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { MetricsResponse } from '../services/api';
import './MetricsPanel.css';

export const MetricsPanel = () => {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [previousMetrics, setPreviousMetrics] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const data = await api.getMetrics();
        setPreviousMetrics(metrics);
        setMetrics(data);
      } catch (err) {
        console.error('Failed to fetch metrics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000); // Refresh every 3 seconds

    return () => clearInterval(interval);
  }, [metrics]);

  if (loading || !metrics) return <div className="metrics-panel loading">Loading metrics...</div>;

  const getDelta = (current: number, previous: number | undefined): number => {
    if (previous === undefined) return 0;
    return current - previous;
  };

  const metricsData = [
    {
      label: 'Events Processed',
      value: metrics.eventsProcessed,
      delta: previousMetrics ? getDelta(metrics.eventsProcessed, previousMetrics.eventsProcessed) : 0,
      icon: '📥',
      color: '#2196f3'
    },
    {
      label: 'Decisions Made',
      value: metrics.decisionsMade,
      delta: previousMetrics ? getDelta(metrics.decisionsMade, previousMetrics.decisionsMade) : 0,
      icon: '🧠',
      color: '#9c27b0'
    },
    {
      label: 'Actions Executed',
      value: metrics.actionsExecuted,
      delta: previousMetrics ? getDelta(metrics.actionsExecuted, previousMetrics.actionsExecuted) : 0,
      icon: '⚡',
      color: '#ff9800'
    },
    {
      label: 'Errors',
      value: metrics.errors,
      delta: previousMetrics ? getDelta(metrics.errors, previousMetrics.errors) : 0,
      icon: '❌',
      color: '#f44336'
    },
    {
      label: 'Queue Depth',
      value: metrics.queue_depth,
      delta: 0,
      icon: '📋',
      color: '#00bcd4'
    },
    {
      label: 'Active Agents',
      value: metrics.active_agents,
      delta: 0,
      icon: '🤖',
      color: '#4caf50'
    }
  ];

  return (
    <div className="metrics-panel">
      <h2>System Metrics</h2>
      <div className="metrics-grid">
        {metricsData.map((metric) => (
          <div key={metric.label} className="metric-card" style={{ borderLeftColor: metric.color }}>
            <div className="metric-icon">{metric.icon}</div>
            <div className="metric-content">
              <div className="metric-label">{metric.label}</div>
              <div className="metric-value-row">
                <div className="metric-value">{metric.value}</div>
                {metric.delta !== 0 && (
                  <div className={`metric-delta ${metric.delta > 0 ? 'positive' : 'negative'}`}>
                    {metric.delta > 0 ? '+' : ''}{metric.delta}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="metrics-footer">
        <span className="refresh-indicator">● Live</span>
        <span className="refresh-rate">Refreshing every 3s</span>
      </div>
    </div>
  );
};
