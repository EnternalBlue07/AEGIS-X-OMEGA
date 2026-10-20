import React, { useState, useEffect, useRef } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import AlertQueue from './components/AlertQueue';
import Investigator from './components/Investigator';
import NetworkMap from './components/NetworkMap';
import Heatmap from './components/Heatmap';
import Simulator from './components/Simulator';
import Monitor from './components/Monitor';
import Sentinel from './components/Sentinel';
import Chronos from './components/Chronos';
import { 
  ShieldAlert, Layers, Compass, Cpu, Activity, 
  Sun, Moon, Shield, Radio, Terminal, UserX, Users, History, 
  AlertTriangle, RefreshCw, Key, ShieldCheck, Heart, Circle
} from 'lucide-react';

function DashboardApp() {
  const { isDark, toggleTheme } = useTheme();
  const { isAuthenticated, user, logout } = useAuth();
  const [activeCenterTab, setActiveCenterTab] = useState('GRAPH'); // GRAPH, TIMELINE, EVIDENCE, REPLAY, PREDICTIONS
  const [selectedAlertId, setSelectedAlertId] = useState('ALT-MULE-001'); // Global case target
  
  // Real-time global biometric telemetry state
  const [globalCpm, setGlobalCpm] = useState(120);
  const [globalJitter, setGlobalJitter] = useState(12);
  const keysWindow = useRef([]);
  const lastMousePos = useRef({ x: 0, y: 0, time: Date.now() });
  const mouseVelocities = useRef([]);
  
  // CPU fluctuating load telemetry
  const [cpuLoad, setCpuLoad] = useState(34);
  useEffect(() => {
    const cpuInterval = setInterval(() => {
      setCpuLoad(prev => {
        const delta = Math.floor(Math.random() * 5) - 2; // -2 to +2
        return Math.min(Math.max(prev + delta, 28), 42);
      });
    }, 2000);
    return () => clearInterval(cpuInterval);
  }, []);

  // Tracking keystrokes & mouse movements globally for telemetry sync
  useEffect(() => {
    const handleMouseMove = (e) => {
      const now = Date.now();
      const dt = now - lastMousePos.current.time;
      if (dt > 15) {
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const velocity = dist / dt;
        
        mouseVelocities.current.push(velocity);
        if (mouseVelocities.current.length > 30) {
          mouseVelocities.current.shift();
        }
        
        const avg = mouseVelocities.current.reduce((a, b) => a + b, 0) / mouseVelocities.current.length;
        const sqDiffs = mouseVelocities.current.map(v => Math.pow(v - avg, 2));
        const variance = sqDiffs.reduce((a, b) => a + b, 0) / sqDiffs.length || 0;
        const computedJitter = Math.min(Math.round(variance * 800), 45);
        
        if (computedJitter > 2) {
          setGlobalJitter(computedJitter);
        }
        lastMousePos.current = { x: e.clientX, y: e.clientY, time: now };
      }
    };

    const handleKeyDown = () => {
      keysWindow.current.push(Date.now());
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);

    const telemetryInterval = setInterval(() => {
      const now = Date.now();
      keysWindow.current = keysWindow.current.filter(t => now - t < 10000);
      const cpmVal = keysWindow.current.length * 6;
      setGlobalCpm(cpmVal > 0 ? cpmVal : 110 + Math.floor(Math.random() * 20)); // baseline fallback
    }, 2000);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      clearInterval(telemetryInterval);
    };
  }, []);

  if (!isAuthenticated) {
    return <Login />;
  }

  const handleSelectAlert = (alertId) => {
    setSelectedAlertId(alertId);
  };

  // Sidebar link clicks (switch tab or trigger focus overlays)
  const handleSidebarClick = (section) => {
    switch (section) {
      case 'Overview':
      case 'Investigations':
        setActiveCenterTab('TIMELINE');
        break;
      case 'Chronos':
        setActiveCenterTab('REPLAY');
        break;
      case 'Atlas':
        setActiveCenterTab('GRAPH');
        break;
      case 'Nemesis':
      case 'Quantum':
      case 'Oracle':
        setActiveCenterTab('PREDICTIONS');
        break;
      default:
        // Other links show visual alert trigger
        break;
    }
  };

  // Derive Priya's active fatigue and bias vectors
  const derivedFatigue = Math.min(Math.max((globalCpm / 350) * 0.4 + (globalJitter / 40) * 0.6, 0.12), 0.92);
  const derivedBias = 0.3 + derivedFatigue * 0.5;

  return (
    <div className="min-h-screen bg-canvas text-zinc-100 font-sans flex flex-col transition-all duration-150 textured-canvas">
      
      {/* 3. MISSION BAR (Top - 58px) */}
      <header className="h-[58px] bg-panels border-b border-accent/15 px-6 flex items-center justify-between shrink-0 z-20 font-mono">
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-1.5">
            <h1 className="text-sm font-headings font-black tracking-[3px] text-zinc-50 uppercase">AEGIS-X <span className="text-accent text-xs">Ω</span></h1>
          </div>
          
          <div className="h-4 w-px bg-accent/20 hidden md:block"></div>
          
          {/* Security Clearance level badge */}
          <div className="hidden md:flex items-center border border-merkle/30 bg-merkle/5 px-2 py-0.5 rounded text-[8px] font-black text-merkle tracking-wider uppercase">
            SECURITY CLEARANCE LEVEL OMEGA
          </div>
        </div>

        {/* Real-time DEFCON and Session integrity telemetry */}
        <div className="hidden lg:flex items-center gap-6 text-[9px]">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500">THREAT LEVEL:</span>
            <span className="bg-threat/10 border border-threat/35 text-threat rounded px-2 py-0.5 font-bold animate-cpu-blink">
              DEFCON 2
            </span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-zinc-500">TWIN STATUS:</span>
            <span className="text-success font-bold flex items-center gap-1">
              <Circle className="w-1.5 h-1.5 fill-success bg-transparent rounded-full animate-heartbeat-soc" /> 4 SYNCHRONIZED
            </span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-zinc-500">INTEGRITY INDEX:</span>
            <span className="text-telemetry font-bold">98.4%</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-zinc-500">CPU LOAD:</span>
            <span className="text-accent font-bold animate-cpu-blink">{cpuLoad}%</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-zinc-500">LATENCY:</span>
            <span className="text-zinc-300">118ms</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-zinc-500">ACTIVE CASES:</span>
            <span className="text-warning font-bold">412</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={toggleTheme}
            className="p-1.5 border border-accent/10 rounded hover:bg-accent/5 text-accent hover:text-warning transition-colors cursor-pointer"
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Primary Workspace: strict 16-column layout */}
      <div 
        className="flex-1 grid gap-5 p-5 max-w-[1800px] w-full mx-auto min-h-0 overflow-hidden" 
        style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}
      >
        
        {/* 4. LEFT COLUMN (Span 3) - Operational Sidebar */}
        <aside className="col-span-3 bg-panels border border-accent/15 rounded-lg flex flex-col justify-between overflow-y-auto p-4 z-10">
          <div className="space-y-4">
            <span className="block text-[8px] font-mono text-telemetry uppercase tracking-wider border-b border-accent/10 pb-1">
              OPERATIONAL COMMANDS:
            </span>
            
            {/* Sidebar list items */}
            <nav className="space-y-1 font-mono text-[10px]">
              {[
                { name: 'Overview', desc: 'Real-time alert flows' },
                { name: 'Investigations', desc: 'Full case audit vault' },
                { name: 'Sentinel', desc: 'Cognitive twins simulator' },
                { name: 'Chronos', desc: 'Git-like timeline scrubber' },
                { name: 'Atlas', desc: 'Louvain cluster graph' },
                { name: 'Nemesis', desc: 'API security sweeps' },
                { name: 'Oracle', desc: 'Consensus forecasting' },
                { name: 'Argus', desc: 'Population drift (PSI)' },
                { name: 'Biometrics', desc: 'Keystroke biometrics HUD' },
                { name: 'Quantum', desc: 'NIST ML-KEM suite readiness' },
                { name: 'Settings', desc: 'Operator preferences' }
              ].map(sec => {
                // Map active style for matching center canvas views
                const isSelected = 
                  (sec.name === 'Atlas' && activeCenterTab === 'GRAPH') ||
                  (sec.name === 'Investigations' && activeCenterTab === 'TIMELINE') ||
                  (sec.name === 'Chronos' && activeCenterTab === 'REPLAY') ||
                  ((sec.name === 'Nemesis' || sec.name === 'Quantum') && activeCenterTab === 'PREDICTIONS');

                return (
                  <button
                    key={sec.name}
                    onClick={() => handleSidebarClick(sec.name)}
                    className={`w-full text-left p-2 rounded transition-all flex flex-col justify-between ${
                      isSelected 
                        ? 'bg-accent/5 border border-accent/20 text-accent font-bold' 
                        : 'border border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-accent/5'
                    }`}
                  >
                    <span className="uppercase tracking-wide">{sec.name}</span>
                    <span className="text-[7.5px] opacity-60 font-sans mt-0.5">{sec.desc}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Active Operator Dossier & Biometrics HUD */}
          <div className="border-t border-accent/10 pt-3 mt-4 space-y-3 font-mono text-[9px]">
            <div className="flex justify-between items-baseline">
              <span className="text-zinc-500 uppercase">OPERATOR:</span>
              <span className="text-zinc-200 font-extrabold uppercase">{user?.name || 'PRIYA'}</span>
            </div>

            <div className="space-y-1.5">
              <div>
                <div className="flex justify-between text-[8px]">
                  <span>FATIGUE INDEX:</span>
                  <span className={derivedFatigue > 0.6 ? 'text-threat font-bold animate-pulse' : 'text-zinc-300'}>
                    {(derivedFatigue * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-[#06090F] h-1 rounded overflow-hidden mt-0.5">
                  <div 
                    className={`h-full transition-all duration-300 ${derivedFatigue > 0.6 ? 'bg-threat' : 'bg-telemetry'}`}
                    style={{ width: `${derivedFatigue * 100}%` }}
                  ></div>
                </div>
              </div>

              <div className="flex justify-between">
                <span>AUTOMATION BIAS:</span>
                <span className="text-bias font-bold">{derivedBias.toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span>TYPING VELOCITY:</span>
                <span className="text-zinc-200 font-bold">{globalCpm} CPM</span>
              </div>

              <div className="flex justify-between">
                <span>BIOMETRIC TRUST:</span>
                <span className="text-accent">0.85</span>
              </div>
            </div>

            <button
              onClick={logout}
              className="w-full py-1.5 bg-threat/10 border border-threat/20 hover:bg-threat/20 text-threat transition-colors font-mono font-bold uppercase text-[8.5px] tracking-wider rounded flex items-center justify-center gap-1 cursor-pointer"
            >
              <UserX className="w-3 h-3" />
              TERMINATE SESSION
            </button>
          </div>
        </aside>

        {/* 5. CENTER COLUMN (Span 8) - Main Intelligence Canvas */}
        <main className="col-span-8 flex flex-col min-h-0 overflow-y-auto space-y-4">
          
          {/* Main Canvas Tab controls */}
          <div className="bg-panels border border-accent/15 p-2 rounded-lg flex items-center justify-between font-mono text-[9px] font-bold">
            <div className="flex items-center gap-1.5">
              {[
                { id: 'GRAPH', name: 'ATLAS KNOWLEDGE GRAPH', icon: <Layers className="w-3.5 h-3.5" /> },
                { id: 'TIMELINE', name: 'TIMELINE ALERTS QUEUE', icon: <Compass className="w-3.5 h-3.5" /> },
                { id: 'EVIDENCE', name: 'EVIDENCE FORENSIC BLOCK', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
                { id: 'REPLAY', name: 'CHRONOS STATE REPLAY', icon: <History className="w-3.5 h-3.5" /> },
                { id: 'PREDICTIONS', name: 'NEMESIS / QUANTUM PREDICTIONS', icon: <Cpu className="w-3.5 h-3.5" /> }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveCenterTab(tab.id)}
                  className={`px-3 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer ${
                    activeCenterTab === tab.id 
                      ? 'bg-accent/10 text-accent border border-accent/20' 
                      : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Active Canvas tab display */}
          <div className="flex-1 min-h-0">
            {activeCenterTab === 'GRAPH' && <NetworkMap onSelectAlert={handleSelectAlert} />}
            {activeCenterTab === 'TIMELINE' && (
              <AlertQueue 
                onSelectAlert={(id) => { handleSelectAlert(id); setActiveCenterTab('EVIDENCE'); }} 
                activeAlertId={selectedAlertId} 
              />
            )}
            {activeCenterTab === 'EVIDENCE' && (
              <Investigator alertId={selectedAlertId} onClose={() => setActiveCenterTab('TIMELINE')} />
            )}
            {activeCenterTab === 'REPLAY' && <Chronos />}
            {activeCenterTab === 'PREDICTIONS' && (
              <div className="space-y-6 animate-fade-soc">
                {/* Predictions renders both Simulator & Monitor inside a nice split or vertical layout */}
                <div className="grid grid-cols-1 gap-6">
                  <Simulator />
                  <Monitor />
                </div>
              </div>
            )}
          </div>

          {/* 11. FLOATING WIDGETS DECK (Tactical security telemetry cards) */}
          <div className="bg-panels border border-accent/15 p-4 rounded-lg font-mono text-[9px] space-y-2.5">
            <span className="block text-[8px] text-telemetry uppercase tracking-wider">
              TACTICAL REALTIME HUDS:
            </span>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[8px] font-mono">
              <div className="bg-canvas border border-threat/30 p-2 rounded flex flex-col justify-between animate-cpu-blink">
                <span className="text-threat font-bold">SUSPICIOUS CLUSTER INGESTED</span>
                <span className="text-zinc-200 font-extrabold mt-1 text-[9.5px]">93% CONFIDENCE RATING</span>
              </div>

              <div className="bg-canvas border border-quantum/30 p-2 rounded flex flex-col justify-between">
                <span className="text-quantum font-bold">QUANTUM DECAY RISK ELEVATED</span>
                <span className="text-zinc-200 font-extrabold mt-1 text-[9.5px]">ML-KEM ACTIVE RE-ENC</span>
              </div>

              <div className="bg-canvas border border-bias/30 p-2 rounded flex flex-col justify-between">
                <span className="text-bias font-bold">OPERATOR BIAS DRIFT</span>
                <span className="text-zinc-200 font-extrabold mt-1 text-[9.5px]">AUTOMATION VALUE: 0.68</span>
              </div>

              <div className="bg-canvas border border-merkle/30 p-2 rounded flex flex-col justify-between">
                <span className="text-merkle font-bold">MERKLE PROOF VERIFIED</span>
                <span className="text-zinc-200 font-extrabold mt-1 text-[9.5px]">LEAF INTEGRITY: SECURE</span>
              </div>

              <div className="bg-canvas border border-threat/20 p-2 rounded flex flex-col justify-between">
                <span className="text-threat font-bold">RED TEAM SWEEP RUNNING</span>
                <span className="text-zinc-200 font-extrabold mt-1 text-[9.5px]">5 API ATTACKS MITIGATED</span>
              </div>

              <div className="bg-canvas border border-telemetry/30 p-2 rounded flex flex-col justify-between">
                <span className="text-telemetry font-bold">TWIN CONSENSUS STABILITY</span>
                <span className="text-zinc-200 font-extrabold mt-1 text-[9.5px]">DISAGREEMENT ENTROPY 0.62</span>
              </div>

              <div className="bg-canvas border border-accent/30 p-2 rounded flex flex-col justify-between sm:col-span-2">
                <span className="text-accent font-bold">SESSION DATA INTEGRITY</span>
                <span className="text-zinc-200 font-extrabold mt-1 text-[9.5px]">98.4% ADMISSIBILITY RATE</span>
              </div>
            </div>
          </div>

        </main>

        {/* 6. RIGHT COLUMN (Span 5) - Sentinel Debate Arena (Cognitive Swarm) */}
        <aside className="col-span-5 h-full overflow-y-auto z-10 flex flex-col">
          <Sentinel 
            activeAlertId={selectedAlertId} 
            onSelectAlert={handleSelectAlert} 
            globalCpm={globalCpm}
            globalJitter={globalJitter}
          />
        </aside>

      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <DashboardApp />
      </ThemeProvider>
    </AuthProvider>
  );
}
