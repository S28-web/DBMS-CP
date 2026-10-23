import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import DashboardView from './views/DashboardView';
import AnomalyTrackerView from './views/AnomalyTrackerView';
import PayloadsView from './views/PayloadsView';
import PradanIngestionView from './views/PradanIngestionView';
import LineageQualityView from './views/LineageQualityView';
import SqlWorkbenchView from './views/SqlWorkbenchView';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedPayload, setSelectedPayload] = useState('VELC');
  const [status, setStatus] = useState(null);
  const [payloads, setPayloads] = useState([]);
  const [events, setEvents] = useState([]);
  const [isPolling, setIsPolling] = useState(false);
  const [lastPollResult, setLastPollResult] = useState(null);
  const [liveTelemetry, setLiveTelemetry] = useState(null);
  const [liveConnected, setLiveConnected] = useState(false);

  // Initial data loading
  const loadInitialData = () => {
    fetch('/api/status')
      .then(res => res.json())
      .then(data => setStatus(data))
      .catch(err => console.error('Status fetch failed:', err));

    fetch('/api/payloads')
      .then(res => res.json())
      .then(data => setPayloads(data))
      .catch(err => console.error('Payloads fetch failed:', err));

    fetch('/api/events')
      .then(res => res.json())
      .then(data => setEvents(data))
      .catch(err => console.error('Events fetch failed:', err));
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // WebSocket Live Telemetry Stream
  useEffect(() => {
    let ws;
    let reconnectTimer;

    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.port === '5173' ? '127.0.0.1:8000' : window.location.host;
      const wsUrl = `${protocol}//${wsHost}/ws/telemetry`;

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setLiveConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setLiveTelemetry(data);
          } catch (e) {
            console.error('WS parse error:', e);
          }
        };

        ws.onclose = () => {
          setLiveConnected(false);
          reconnectTimer = setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = () => {
          setLiveConnected(false);
          ws.close();
        };
      } catch (err) {
        setLiveConnected(false);
        reconnectTimer = setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    return () => {
      if (ws) ws.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  // Handle one-click PRADAN poll
  const handlePollTrigger = () => {
    setIsPolling(true);
    fetch('/api/poll')
      .then(res => res.json())
      .then(data => {
        setLastPollResult(data);
        setIsPolling(false);
        // Refresh status and payloads
        loadInitialData();
      })
      .catch(err => {
        console.error('PRADAN poll failed:', err);
        setIsPolling(false);
      });
  };

  const handleSelectPayloadFromDashboard = (code) => {
    setSelectedPayload(code);
    setActiveTab('payloads');
  };

  return (
    <div className="min-h-screen flex flex-col bg-space-900 text-slate-100 font-sans">
      {/* Top Header */}
      <Header
        onPollTrigger={handlePollTrigger}
        isPolling={isPolling}
        lastViewState={lastPollResult?.viewstate_token || status?.last_ingestion_run?.jsf_viewstate_hash}
        liveConnected={liveConnected}
      />

      {/* Main Workspace: Sidebar + View Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabSelect={setActiveTab}
          spaceWeather={status?.space_weather}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 max-w-7xl mx-auto w-full">
          {activeTab === 'dashboard' && (
            <DashboardView
              status={status}
              payloads={payloads}
              events={events}
              onSelectPayload={handleSelectPayloadFromDashboard}
              liveTelemetry={liveTelemetry}
            />
          )}

          {activeTab === 'anomaly' && (
            <AnomalyTrackerView events={events} />
          )}

          {activeTab === 'payloads' && (
            <PayloadsView
              payloads={payloads}
              initialPayload={selectedPayload}
            />
          )}

          {activeTab === 'pradan' && (
            <PradanIngestionView
              onPollTrigger={handlePollTrigger}
              isPolling={isPolling}
              lastPollResult={lastPollResult}
            />
          )}

          {activeTab === 'lineage' && (
            <LineageQualityView />
          )}

          {activeTab === 'sql' && (
            <SqlWorkbenchView />
          )}
        </main>
      </div>
    </div>
  );
}
