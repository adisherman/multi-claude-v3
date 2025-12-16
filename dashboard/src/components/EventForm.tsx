import { useState } from 'react';
import { api } from '../services/api';
import './EventForm.css';

const EVENT_TEMPLATES = {
  'user.request.create_project': {
    name: 'Create Project',
    payload: {
      user_id: 'demo_user',
      project_name: 'demo-app',
      project_type: 'react-typescript',
      description: 'A demo application',
      features: ['authentication', 'crud']
    }
  },
  'agent_completed': {
    name: 'Agent Completed',
    payload: {
      agent_name: 'ProjectScaffolder',
      task_id: 'task_001',
      status: 'success',
      duration_ms: 3500,
      results: { files_created: 42 }
    }
  },
  'agent_failed': {
    name: 'Agent Failed',
    payload: {
      agent_name: 'ContextFetcher',
      task_id: 'task_002',
      error: 'Database connection timeout',
      retry_count: 2
    }
  },
  'system.health_check': {
    name: 'Health Check',
    payload: {
      check_type: 'scheduled',
      components: ['database', 'queue', 'agents']
    }
  }
};

export const EventForm = () => {
  const [eventType, setEventType] = useState('user.request.create_project');
  const [priority, setPriority] = useState<'high' | 'normal' | 'low'>('normal');
  const [sessionId, setSessionId] = useState('demo_session_' + Date.now());
  const [payload, setPayload] = useState(JSON.stringify(EVENT_TEMPLATES['user.request.create_project'].payload, null, 2));
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleTemplateChange = (type: string) => {
    setEventType(type);
    const template = EVENT_TEMPLATES[type as keyof typeof EVENT_TEMPLATES];
    if (template) {
      setPayload(JSON.stringify(template.payload, null, 2));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      const payloadObj = JSON.parse(payload);
      const response = await api.submitEvent({
        event_type: eventType,
        source: 'dashboard',
        priority,
        session_id: sessionId,
        payload: payloadObj
      });

      setResult({
        type: 'success',
        message: `Event submitted successfully! ID: ${response.event_id}`
      });

      // Reset form after 3 seconds
      setTimeout(() => setResult(null), 5000);
    } catch (err: any) {
      setResult({
        type: 'error',
        message: err.message || 'Failed to submit event'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="event-form">
      <h2>Submit Test Event</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label>Event Template</label>
            <select
              value={eventType}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="form-select"
            >
              {Object.entries(EVENT_TEMPLATES).map(([type, template]) => (
                <option key={type} value={type}>{template.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="form-select"
            >
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Session ID</label>
          <input
            type="text"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="form-input"
            placeholder="demo_session_001"
          />
        </div>

        <div className="form-group">
          <label>Payload (JSON)</label>
          <textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            className="form-textarea"
            rows={12}
          />
        </div>

        {result && (
          <div className={`result-message ${result.type}`}>
            {result.message}
          </div>
        )}

        <button
          type="submit"
          className="submit-button"
          disabled={submitting}
        >
          {submitting ? 'Submitting...' : 'Submit Event'}
        </button>
      </form>
    </div>
  );
};
