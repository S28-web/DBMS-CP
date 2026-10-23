import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Activity,
  Flame,
  Zap,
  ShieldAlert,
  Info,
  Clock,
  Gauge
} from 'lucide-react';

export default function AnomalyTrackerView({ events }) {
  const canvasRef = useRef(null);
  const [timeHours, setTimeHours] = useState(0.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Set default event
  useEffect(() => {
    if (events && events.length > 0 && !selectedEvent) {
      setSelectedEvent(events[0]);
    }
  }, [events, selectedEvent]);

  // Animation loop for scrubber
  useEffect(() => {
    let animId;
    if (isPlaying) {
      animId = setInterval(() => {
        setTimeHours((prev) => {
          if (prev >= 24.0) {
            setIsPlaying(false);
            return 24.0;
          }
          return parseFloat((prev + 0.1).toFixed(1));
        });
      }, 50);
    }
    return () => clearInterval(animId);
  }, [isPlaying]);

  // Canvas drawing effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#050a15';
    ctx.fillRect(0, 0, width, height);

    // Draw background grid
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.2)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const sunX = 70;
    const sunY = height / 2;
    const l1X = width - 180;
    const l1Y = height / 2;
    const earthX = width - 70;
    const earthY = height / 2;

    // 1. Draw Sun (Left)
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 65);
    sunGlow.addColorStop(0, '#ffedd5');
    sunGlow.addColorStop(0.3, '#f97316');
    sunGlow.addColorStop(0.7, 'rgba(234, 88, 12, 0.35)');
    sunGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 65, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();

    // Sun Label
    ctx.fillStyle = '#fdba74';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SUN (AR 13854)', sunX, sunY + 45);

    // 2. Draw Distance Axis line
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(sunX + 35, sunY);
    ctx.lineTo(earthX - 25, earthY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Draw Aditya-L1 Halo Orbit (at L1 point)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(l1X, l1Y, 25, 45, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Aditya-L1 Spacecraft icon
    const orbitAngle = (timeHours / 24.0) * Math.PI * 4;
    const scX = l1X + Math.sin(orbitAngle) * 25;
    const scY = l1Y + Math.cos(orbitAngle) * 45;

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(scX, scY, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillText('ADITYA-L1', l1X, l1Y - 55);
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('L1 Point (0.99 AU)', l1X, l1Y - 42);

    // 4. Draw Earth (Right)
    const earthGlow = ctx.createRadialGradient(earthX, earthY, 5, earthX, earthY, 35);
    earthGlow.addColorStop(0, '#38bdf8');
    earthGlow.addColorStop(0.5, 'rgba(56, 189, 248, 0.25)');
    earthGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = earthGlow;
    ctx.beginPath();
    ctx.arc(earthX, earthY, 35, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(earthX, earthY, 14, 0, Math.PI * 2);
    ctx.fill();

    // Earth Bow Shock
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(earthX, earthY, 24, Math.PI * 0.65, Math.PI * 1.35);
    ctx.stroke();

    ctx.fillStyle = '#93c5fd';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillText('EARTH', earthX, earthY + 30);
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = '#64748b';
    ctx.fillText('1.0 AU', earthX, earthY + 42);

    // 5. Draw Propagating CME Cloud (Front traveling at 1460 km/s)
    // 1460 km/s takes ~21.5 hours to reach L1
    const transitProgress = Math.min(1.0, timeHours / 21.5);
    const cmeFrontX = sunX + transitProgress * (l1X - sunX);
    const cmeRadius = Math.max(10, transitProgress * 95);

    if (timeHours > 0.2) {
      const cmeGradient = ctx.createRadialGradient(
        cmeFrontX, sunY, cmeRadius * 0.2,
        cmeFrontX, sunY, cmeRadius
      );
      cmeGradient.addColorStop(0, 'rgba(239, 68, 68, 0.35)');
      cmeGradient.addColorStop(0.7, 'rgba(249, 115, 22, 0.25)');
      cmeGradient.addColorStop(1, 'transparent');

      ctx.fillStyle = cmeGradient;
      ctx.beginPath();
      ctx.arc(cmeFrontX, sunY, cmeRadius, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.lineTo(sunX, sunY);
      ctx.closePath();
      ctx.fill();

      // Shock front leading edge arc
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cmeFrontX, sunY, cmeRadius, -Math.PI * 0.38, Math.PI * 0.38);
      ctx.stroke();

      // Shock front label
      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(
        `SHOCK FRONT: 1460 km/s (r = ${(1.0 + transitProgress * 214).toFixed(0)} R☉)`,
        cmeFrontX + 10,
        sunY - cmeRadius * 0.5
      );
    }

    // 6. Draw Shock Impact Indicator if timeHours >= 21.5
    if (timeHours >= 21.4) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.beginPath();
      ctx.arc(l1X, l1Y, 40, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ L1 SHOCK ARRIVAL!', l1X, l1Y + 70);
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#fca5a5';
      ctx.fillText('Bz → -22.8 nT | SW → 685 km/s', l1X, l1Y + 84);
    }
  }, [timeHours]);

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="platform-card rounded-2xl p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5">
                <Flame className="w-3 h-3 text-rose-400" />
                L1 PROPAGATION SIMULATOR
              </span>
              <span className="text-xs font-mono text-slate-400">
                Ballistic Drag-Based Transit Model
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">
              Sun → L1 Halo Orbit CME Propagation &amp; Anomaly Tracker
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Simulates the 21.5-hour transit of the October 15, 2026 Halo CME erupting from active region AR 13854 at 1460 km/s,
              correlating its coronal launch with the in-situ shock arrival at Aditya-L1.
            </p>
          </div>

          {/* Quick Metrics Badge */}
          <div className="flex items-center gap-3 bg-space-950/80 border border-slate-700/60 p-3 rounded-xl font-mono text-xs">
            <div>
              <div className="text-[10px] text-slate-400">PROPAGATION TIME</div>
              <div className="text-lg font-bold text-sky-400">{timeHours.toFixed(1)} h</div>
            </div>
            <div className="h-8 w-px bg-slate-800"></div>
            <div>
              <div className="text-[10px] text-slate-400">APEX VELOCITY</div>
              <div className="text-lg font-bold text-amber-400">1,460 km/s</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2D Canvas Simulator with Scrubber */}
      <div className="platform-card rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-bold text-white">
              Heliophysics 2D Cross-Section (Ecliptic Plane)
            </h3>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"></span> Sun
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block"></span> Aditya-L1
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span> Earth
            </span>
          </div>
        </div>

        {/* The HTML5 Canvas */}
        <div className="relative rounded-xl overflow-hidden border border-slate-700/60 shadow-inner bg-space-950">
          <canvas
            ref={canvasRef}
            width={860}
            height={320}
            className="w-full h-auto block"
          />
        </div>

        {/* Timeline Scrubber & Playback Controls */}
        <div className="bg-space-950/80 border border-slate-800 p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition-all shadow-glow"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'PAUSE' : 'PLAY SIM'}</span>
              </button>
              <button
                onClick={() => {
                  setIsPlaying(false);
                  setTimeHours(0.0);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>RESET</span>
              </button>
            </div>

            <div className="font-mono text-xs text-slate-300">
              <span className="text-slate-500">TRANSIT ELAPSED:</span>{' '}
              <span className="font-bold text-sky-400 text-sm">{timeHours.toFixed(1)} hrs</span>{' '}
              <span className="text-slate-500">/ 24.0 hrs</span>
            </div>
          </div>

          <div className="space-y-1">
            <input
              type="range"
              min="0.0"
              max="24.0"
              step="0.1"
              value={timeHours}
              onChange={(e) => setTimeHours(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>0.0h (Launch: X2.4 Flare)</span>
              <span>10.0h (Interplanetary Transit)</span>
              <span className="text-rose-400 font-semibold">21.5h (L1 Shock Arrival)</span>
              <span>24.0h (Magnetosphere Compression)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Correlated Solar Events Cards */}
      <div className="platform-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Campaign Events &amp; Cross-Payload Correlation Matrix
            </h3>
            <p className="text-xs font-mono text-slate-400">
              Correlated telemetry evidence across VELC, SUIT, SoLEXS, HEL1OS, ASPEX, PAPA, and MAG
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {events && events.map((ev) => {
            const isSelected = selectedEvent?.event_id === ev.event_id;
            return (
              <div
                key={ev.event_id}
                onClick={() => setSelectedEvent(ev)}
                className={`platform-card rounded-xl p-4 space-y-2 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-sky-400 bg-sky-950/20 shadow-glow'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-sky-400">
                    {ev.event_code}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                    {ev.severity_class}
                  </span>
                </div>
                <div className="text-xs font-semibold text-white">{ev.event_type}</div>
                <p className="text-[11px] text-slate-400 line-clamp-3 leading-relaxed">
                  {ev.scientific_summary}
                </p>
                <div className="pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-400 flex justify-between">
                  <span>Confidence: {(ev.confidence_score * 100).toFixed(1)}%</span>
                  <span className="text-sky-400">
                    {ev.evidence_products?.length || 0} Evidence Links
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Event Details & Evidence Links */}
        {selectedEvent && (
          <div className="bg-space-950/70 border border-slate-800 rounded-xl p-4 mt-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-mono text-slate-300 font-semibold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-sky-400" />
                EVIDENCE PRODUCTS LINKED TO {selectedEvent.event_code}
              </span>
              <span className="text-xs font-mono text-slate-400">
                Onset: {selectedEvent.onset_time}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {selectedEvent.evidence_products && selectedEvent.evidence_products.map((ep) => (
                <div key={ep.link_id} className="bg-space-900 border border-slate-700/60 rounded-lg p-2.5 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="font-bold text-sky-300">{ep.payload_code}</span>
                    <span className="text-amber-400 font-semibold">{ep.evidence_role}</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 truncate">
                    {ep.product_identifier}
                  </div>
                  <div className="text-[10px] text-slate-300 leading-snug">
                    {ep.correlation_notes}
                  </div>
                  <div className="text-[9px] font-mono text-slate-500">
                    Δt: {ep.time_offset_minutes} min
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
