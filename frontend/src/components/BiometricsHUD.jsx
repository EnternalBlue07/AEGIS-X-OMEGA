import React, { useEffect, useState, useRef } from 'react';
import { Activity, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function BiometricsHUD({ baselineCPM = 230, baselineJitter = 15 }) {
  const [cpm, setCpm] = useState(0);
  const [jitter, setJitter] = useState(12);
  const [matchRate, setMatchRate] = useState(98);
  const [keystrokeCount, setKeystrokeCount] = useState(0);

  const lastMousePos = useRef({ x: 0, y: 0, time: Date.now() });
  const mouseMovements = useRef([]);
  const keysWindow = useRef([]);

  useEffect(() => {
    // 1. Mouse telemetry tracking
    const handleMouseMove = (e) => {
      const now = Date.now();
      const dt = now - lastMousePos.current.time;
      if (dt > 10) {
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const velocity = distance / dt; // pixels per ms
        
        mouseMovements.current.push(velocity);
        if (mouseMovements.current.length > 50) {
          mouseMovements.current.shift();
        }

        // Calculate jitter (variance in velocities)
        const avg = mouseMovements.current.reduce((a, b) => a + b, 0) / mouseMovements.current.length;
        const squareDiffs = mouseMovements.current.map(v => Math.pow(v - avg, 2));
        const variance = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.current?.length || 0;
        const computedJitter = Math.min(Math.round(variance * 1000), 50);
        
        if (computedJitter > 2) {
          setJitter(computedJitter);
        }

        lastMousePos.current = { x: e.clientX, y: e.clientY, time: now };
      }
    };

    // 2. Keyboard cadence tracking
    const handleKeyDown = () => {
      const now = Date.now();
      keysWindow.current.push(now);
      setKeystrokeCount(prev => prev + 1);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);

    // 3. CPM and Match calculation loop (every second)
    const interval = setInterval(() => {
      const now = Date.now();
      // Keep only keypresses in the last 10 seconds
      keysWindow.current = keysWindow.current.filter(t => now - t < 10000);
      
      // Extrapolate to characters per minute (6 * 10s count)
      const currentCPM = keysWindow.current.length * 6;
      setCpm(currentCPM);

      // Match rate calculation
      // Perfect match is CPM close to baseline and Jitter close to baseline
      const cpmDiff = Math.abs(currentCPM - baselineCPM) / baselineCPM;
      const jitterDiff = Math.abs(jitter - baselineJitter) / baselineJitter;
      
      const mismatch = (cpmDiff * 0.4 + jitterDiff * 0.6);
      const matchPercent = Math.max(Math.min(Math.round((1.0 - mismatch) * 100), 100), 30);
      setMatchRate(matchPercent);
    }, 1000);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      clearInterval(interval);
    };
  }, [jitter, baselineCPM, baselineJitter]);

  const getStatusColor = () => {
    if (matchRate > 75) return 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5';
    if (matchRate > 50) return 'text-evidence-gold border-evidence-gold/20 bg-evidence-gold/5';
    return 'text-alert-rust border-alert-rust/20 bg-alert-rust/5';
  };

  return (
    <div className="bg-[#131924]/40 border border-ledger-blue/15 rounded-lg p-4 font-mono text-[10px] space-y-3">
      
      <div className="flex items-center justify-between pb-2 border-b border-ledger-blue/10">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-ledger-blue animate-pulse" />
          <span className="font-display font-bold uppercase tracking-wider text-zinc-300">Behavioral Biometrics Monitor</span>
        </div>
        <span className="text-[8px] text-ledger-blue uppercase tracking-widest font-semibold">L4 Forensics</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        
        {/* Cadence Metrics */}
        <div className="space-y-2">
          <div>
            <span className="text-[8px] text-ledger-blue block uppercase">Typing Cadence</span>
            <div className="flex justify-between items-baseline mt-0.5">
              <span className="text-zinc-200 font-bold text-xs">{cpm} <span className="text-[9px] text-zinc-400 font-normal">CPM</span></span>
              <span className="text-[8px] text-zinc-400">Base: {baselineCPM}</span>
            </div>
            {/* Simple progress bar */}
            <div className="w-full bg-[#131924] h-1 rounded overflow-hidden mt-1">
              <div 
                className="bg-ledger-blue h-full transition-all duration-300"
                style={{ width: `${Math.min((cpm / baselineCPM) * 100, 100)}%` }}
              ></div>
            </div>
          </div>

          <div>
            <span className="text-[8px] text-ledger-blue block uppercase">Mouse Move Jitter</span>
            <div className="flex justify-between items-baseline mt-0.5">
              <span className="text-zinc-200 font-bold text-xs">{jitter} <span className="text-[9px] text-zinc-400 font-normal">px/ms²</span></span>
              <span className="text-[8px] text-zinc-400">Base: {baselineJitter}</span>
            </div>
            {/* Simple progress bar */}
            <div className="w-full bg-[#131924] h-1 rounded overflow-hidden mt-1">
              <div 
                className="bg-evidence-gold h-full transition-all duration-300"
                style={{ width: `${Math.min((jitter / baselineJitter) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Verification Status */}
        <div className="flex flex-col justify-between">
          <div className="text-center p-2 rounded-lg bg-[#131924] border border-ledger-blue/10 flex flex-col justify-center items-center h-full">
            <span className="text-[8px] text-ledger-blue uppercase tracking-wider block">Profile Match</span>
            <span className="text-lg font-black text-zinc-100 mt-1">{matchRate}%</span>
            <span className="text-[7px] text-zinc-500 uppercase mt-0.5">{keystrokeCount} Events logged</span>
          </div>
        </div>

      </div>

      {/* Integrity banner */}
      <div className={`p-2 border rounded-lg flex items-center justify-between transition-colors duration-300 ${getStatusColor()}`}>
        <div className="flex items-center gap-1.5">
          {matchRate > 50 ? (
            <ShieldCheck className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 animate-bounce" />
          )}
          <span className="font-bold uppercase tracking-wider">
            {matchRate > 75 
              ? 'Session Verification: SECURE' 
              : matchRate > 50 
              ? 'Session Verification: CAUTION' 
              : 'Session Hijack Warning: SUSPENDED'}
          </span>
        </div>
        <span className="text-[8px] opacity-75 font-semibold">
          {matchRate > 75 ? 'OPERATOR: VERIFIED' : 'ANOMALY DETECTED'}
        </span>
      </div>

    </div>
  );
}
