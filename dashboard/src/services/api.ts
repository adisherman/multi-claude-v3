/**
 * API Service for Multi-Claude 3.0 Backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export interface HealthResponse {
  status: string;
  timestamp: string;
  components: Array<{
    name: string;
    status: string;
    last_check: string;
    details: Record<string, unknown>;
  }>;
  metrics: {
    uptime_seconds: number;
    events_processed: number;
    queue_depth: number;
    active_sessions: number;
  };
  database: {
    connected: boolean;
    stats: Record<string, unknown>;
  };
}

export interface MetricsResponse {
  eventsProcessed: number;
  decisionsMade: number;
  actionsExecuted: number;
  errors: number;
  uptime_seconds: number;
  queue_depth: number;
  active_agents: number;
}

export interface QueueStatusResponse {
  depth: number;
  maxSize: number;
  utilization: number;
  processing: boolean;
}

export interface EventSubmission {
  event_type: string;
  source: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  session_id?: string;
  payload: Record<string, unknown>;
}

export interface EventResponse {
  event_id: string;
  status: string;
}

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  async getHealth(): Promise<HealthResponse> {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) throw new Error('Failed to fetch health');
    return response.json();
  }

  async getMetrics(): Promise<MetricsResponse> {
    const response = await fetch(`${this.baseUrl}/metrics`);
    if (!response.ok) throw new Error('Failed to fetch metrics');
    return response.json();
  }

  async getQueueStatus(): Promise<QueueStatusResponse> {
    const response = await fetch(`${this.baseUrl}/queue/status`);
    if (!response.ok) throw new Error('Failed to fetch queue status');
    return response.json();
  }

  async submitEvent(event: EventSubmission): Promise<EventResponse> {
    const response = await fetch(`${this.baseUrl}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });
    if (!response.ok) throw new Error('Failed to submit event');
    return response.json();
  }
}

export const api = new ApiService();
