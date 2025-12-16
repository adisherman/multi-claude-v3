import { HealthStatus } from './components/HealthStatus';
import { MetricsPanel } from './components/MetricsPanel';
import { EventForm } from './components/EventForm';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>🧠 Multi-Claude 3.0 Dashboard</h1>
          <p className="header-subtitle">Brain Event Processor Control Center</p>
        </div>
      </header>

      <main className="app-main">
        <div className="dashboard-grid">
          <div className="dashboard-left">
            <HealthStatus />
            <MetricsPanel />
          </div>
          <div className="dashboard-right">
            <EventForm />
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <p>Multi-Claude 3.0 Autonomous Coding System | Backend: http://localhost:8080</p>
      </footer>
    </div>
  );
}

export default App;
