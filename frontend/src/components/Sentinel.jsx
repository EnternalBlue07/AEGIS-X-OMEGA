import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, ShieldAlert, Cpu, Terminal, Users, User, 
  HelpCircle, RefreshCw, Play, AlertTriangle, CheckCircle, Shield, AlertCircle
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api';

export default function Sentinel({ activeAlertId, onSelectAlert, globalCpm, globalJitter }) {
  const [twins, setTwins] = useState({});
  const [selectedAlert, setSelectedAlert] = useState(activeAlertId || 'ALT-MULE-001');
  const [loading, setLoading] = useState(true);
  const [debating, setDebating] = useState(false);
  const [debateResult, setDebateResult] = useState(null);
  const [visibleRounds, setVisibleRounds] = useState([]);
  const [currentRoundIdx, setCurrentRoundIdx] = useState(0);

  // Sync with prop changes from timeline selection
  useEffect(() => {
    if (activeAlertId) {
      setSelectedAlert(activeAlertId);
    }
  }, [activeAlertId]);

  // Load twins profiles
  const fetchTwins = async () => {
    try {
      const res = await fetch(`${API_BASE}/sentinel/twins`);
      const data = await res.json();
      setTwins(data);
    } catch (err) {
      console.error('Error fetching twin profiles:', err);
      setTwins(getMockTwins());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTwins();
  }, []);

  // Sync biometrics telemetry when global changes
  useEffect(() => {
    if (!loading && Object.keys(twins).length > 0) {
      // Synchronize Priya's stats locally with global telemetry inputs
      setTwins(prev => {
        if (!prev.priya) return prev;
        
        // Calculate dynamic fatigue and bias based on CPM and Jitter
        // Higher CPM or higher jitter scales fatigue
        const fatigueScaling = Math.min(Math.max((globalCpm / 350) * 0.4 + (globalJitter / 40) * 0.6, 0.1), 0.95);
        const automationBias = Math.min(Math.max(0.3 + fatigueScaling * 0.5, 0.3), 0.9);
        
        return {
          ...prev,
          priya: {
            ...prev.priya,
            fatigue_index: fatigueScaling,
            bias_vectors: {
              ...prev.priya.bias_vectors,
              automation: parseFloat(automationBias.toFixed(2)),
              anchoring: parseFloat((0.3 + (globalJitter / 50) * 0.4).toFixed(2))
            }
          }
        };
      });
    }
  }, [globalCpm, globalJitter, loading]);

  const handleRunDebate = async () => {
    setDebating(true);
    setDebateResult(null);
    setVisibleRounds([]);
    setCurrentRoundIdx(0);

    try {
      const res = await fetch(`${API_BASE}/sentinel/run-debate/${selectedAlert}`, { method: 'POST' });
      const data = await res.json();
      setDebateResult(data);
      
      // Animate rounds typewriting
      let currentRound = 0;
      const rounds = data.debate_transcript;
      
      const interval = setInterval(() => {
        if (currentRound < rounds.length) {
          setVisibleRounds(prev => [...prev, rounds[currentRound]]);
          currentRound++;
          setCurrentRoundIdx(currentRound);
        } else {
          clearInterval(interval);
          setDebating(false);
          fetchTwins();
        }
      }, 1000);

    } catch (err) {
      console.error('Debate initiation failed:', err);
      // Fallback mock debate
      setTimeout(() => {
        const mockData = getMockDebateResult(selectedAlert);
        setDebateResult(mockData);
        let currentRound = 0;
        const rounds = mockData.debate_transcript;
        
        const interval = setInterval(() => {
          if (currentRound < rounds.length) {
            setVisibleRounds(prev => [...prev, rounds[currentRound]]);
            currentRound++;
            setCurrentRoundIdx(currentRound);
          } else {
            clearInterval(interval);
            setDebating(false);
          }
        }, 800);
      }, 500);
    }
  };

  const handleDossierChange = (val) => {
    setSelectedAlert(val);
    if (onSelectAlert) {
      onSelectAlert(val);
    }
  };

  if (loading) {
    return (
      <div className="bg-panels hairline-all p-6 rounded-lg flex items-center justify-center h-[500px] font-mono text-telemetry">
        <RefreshCw className="w-5 h-5 animate-spin mr-2.5 text-accent" />
        SYNCHRONIZING TWIN COGNITIVE HUDS...
      </div>
    );
  }

  // Get active speaking twin's ID from active logs
  const getActiveSpeaker = () => {
    if (!debating || visibleRounds.length === 0) return null;
    const lastRound = visibleRounds[visibleRounds.length - 1];
    if (lastRound && lastRound.logs.length > 0) {
      const lastLog = lastRound.logs[lastRound.logs.length - 1];
      return lastLog.twin.toLowerCase();
    }
    return null;
  };

  const activeSpeaker = getActiveSpeaker();

  return (
    <div className="bg-panels border border-accent/15 rounded-lg p-4 flex flex-col h-full space-y-4 animate-consensus">
      
      {/* 1. Header with Title & Selector Controls */}
      <div className="border-b border-accent/15 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-accent animate-cpu-blink" />
            <h4 className="text-xs font-headings font-black tracking-widest text-zinc-50 uppercase">COGNITIVE SWARM</h4>
          </div>
          <div className="stamp stamp-rust text-[7px] font-bold">CLEARANCE: OMEGA</div>
        </div>
        
        <div className="mt-2.5 grid grid-cols-1 gap-2">
          <select 
            value={selectedAlert}
            onChange={(e) => handleDossierChange(e.target.value)}
            className="w-full bg-canvas border border-accent/15 rounded px-2 py-1 text-[9px] font-mono text-accent uppercase focus:outline-none focus:border-accent"
          >
            <option value="ALT-MULE-001">DOSSIER: ALT-MULE-001 (Mule Hub)</option>
            <option value="ALT-TRV-001">DOSSIER: ALT-TRV-001 (Impossible Travel)</option>
            <option value="ALT-SWIFT-001">DOSSIER: ALT-SWIFT-001 (SWIFT OFAC)</option>
            <option value="ALT-CRP-001">DOSSIER: ALT-CRP-001 (AML Structuring)</option>
          </select>
          
          <button 
            onClick={handleRunDebate}
            disabled={debating}
            className="w-full flex items-center justify-center gap-1.5 py-1 bg-accent/10 border border-accent/20 hover:bg-accent/20 text-accent font-mono text-[9px] font-bold rounded cursor-pointer disabled:opacity-50"
          >
            <Play className="w-3 h-3 fill-accent/10" />
            {debating ? 'CONSENSUS DEBATE RUNNING...' : 'INITIATE CONSENSUS DEBATE'}
          </button>
        </div>
      </div>

      {/* 2. Twins Cards Section */}
      <div className="space-y-2.5">
        <span className="block text-[8px] font-mono text-telemetry uppercase tracking-wider">
          TWIN COGNITIVE MATRIX PROFILE:
        </span>
        
        <div className="grid grid-cols-2 gap-2">
          {Object.values(twins).map((twin) => {
            const isSpeaker = activeSpeaker === twin.id;
            const isOperator = twin.id === 'priya';
            return (
              <div 
                key={twin.id}
                className={`bg-canvas border p-2 font-mono text-[8.5px] rounded transition-all duration-150 relative ${
                  isSpeaker 
                    ? 'border-accent shadow-[0_0_8px_rgba(77,163,255,0.25)]' 
                    : isOperator
                    ? 'border-telemetry/40'
                    : 'border-accent/10'
                }`}
              >
                {/* Heartbeat Indicator */}
                <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                  {isSpeaker && (
                    <span className="text-[7px] text-accent animate-pulse font-bold">THINKING</span>
                  )}
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    isSpeaker 
                      ? 'bg-accent animate-ping' 
                      : isOperator 
                      ? 'bg-telemetry animate-heartbeat-soc' 
                      : 'bg-zinc-600'
                  }`}></span>
                </div>

                <div className="font-headings font-black text-zinc-100 uppercase text-[9px] tracking-wide flex items-center gap-1">
                  <span>{twin.name}</span>
                  <span className="text-[7px] text-zinc-500 font-normal">({twin.role.split(' ')[0]})</span>
                </div>

                <div className="mt-1 space-y-1 text-zinc-400">
                  <div className="flex justify-between">
                    <span>FATIGUE:</span>
                    <span className={twin.fatigue_index > 0.6 ? 'text-threat font-bold' : 'text-zinc-300'}>
                      {(twin.fatigue_index * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>AUTO-BIAS:</span>
                    <span className="text-bias font-bold">{twin.bias_vectors.automation}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CONFIDENCE:</span>
                    <span className="text-zinc-200">{twin.decision_accuracy.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>TRUST IN ML:</span>
                    <span className="text-accent">{twin.trust_in_ml.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Consensus Progress & Metrics Gauge */}
      {debateResult && (
        <div className="bg-canvas border border-accent/10 p-2.5 rounded font-mono text-[9px] space-y-2">
          <div className="flex justify-between items-center pb-1 border-b border-accent/5">
            <span className="text-telemetry font-bold">ROUND INDICATOR</span>
            <span className="text-zinc-300 font-bold bg-[#131924] px-1 py-0.5 rounded border border-accent/10">
              ROUND {debating ? currentRoundIdx + 1 : '5'} / 5
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-zinc-400">CONSENSUS STATE:</span>
            <span className={`font-black tracking-widest px-1.5 py-0.5 rounded border text-[10px] ${
              debateResult.dominant_vote === 'FREEZE' || debateResult.dominant_vote === 'SAR'
                ? 'bg-threat/10 border-threat/20 text-threat animate-cpu-blink'
                : 'bg-success/10 border-success/20 text-success'
            }`}>
              {debateResult.dominant_vote}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[8px] text-zinc-500">
              <span>DISAGREEMENT ENTROPY</span>
              <span className="font-bold text-zinc-200">{(debateResult.disagreement_entropy * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full bg-[#131924] h-1 rounded overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${
                  debateResult.disagreement_entropy > 0.6 ? 'bg-threat' : 'bg-warning'
                }`}
                style={{ width: `${debateResult.disagreement_entropy * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="p-2 bg-[#131924] border border-accent/5 rounded text-[8px] text-zinc-400 leading-normal uppercase">
            <span className="text-warning font-bold block mb-0.5">DISSENT NARRATIVE:</span>
            {debateResult.minority_report}
          </div>
        </div>
      )}

      {/* 4. Active Debate Monospace logs */}
      <div className="flex-1 flex flex-col min-h-[160px] bg-canvas border border-accent/10 rounded overflow-hidden">
        <div className="bg-[#131924] border-b border-accent/10 px-2.5 py-1 flex justify-between items-center font-mono text-[8.5px] text-zinc-400">
          <span>CONSENSUS AUDIT LOG</span>
          {debating && <span className="text-warning animate-pulse">● SYNCHRONIZING</span>}
        </div>
        
        <div className="flex-1 p-2 overflow-y-auto font-mono text-[8px] space-y-2 pr-1 max-h-[220px]">
          {visibleRounds.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center text-center text-zinc-600 uppercase py-6">
              <Terminal className="w-6 h-6 opacity-25 mb-1 text-zinc-400" />
              Swarm idle. Ingest a case and initiate consensus forecast.
            </div>
          ) : (
            visibleRounds.map((rnd, rIdx) => (
              <div key={rIdx} className="space-y-1.5 border-b border-accent/5 pb-2 last:border-0">
                <div className="text-accent font-semibold uppercase tracking-wider text-[8.5px] flex items-center gap-1">
                  <span className="w-1 h-1 bg-accent rounded-full animate-ping"></span>
                  {rnd.title}
                </div>
                {rnd.logs.map((log, lIdx) => (
                  <div key={lIdx} className="pl-2 border-l border-accent/25 space-y-0.5">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-zinc-300">{log.twin.toUpperCase()}</span>
                      <span className="text-[7px] text-zinc-500">[{log.role}]</span>
                      <span className={`text-[7px] font-bold ${
                        log.action === 'FREEZE' || log.action === 'SAR' ? 'text-threat' : 'text-success'
                      }`}>
                        //{log.action}
                      </span>
                    </div>
                    <p className="text-zinc-400 text-justify leading-relaxed">{log.message}</p>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}

// --- MOCKS ---

function getMockTwins() {
  return {
    "priya": {
      "id": "priya",
      "name": "Priya",
      "role": "Senior Analyst",
      "risk_appetite": 0.35,
      "sar_threshold": 0.84,
      "freeze_threshold": 0.72,
      "trust_in_ml": 0.75,
      "fatigue_index": 0.12,
      "decision_accuracy": 0.942,
      "bias_vectors": { "anchoring": 0.45, "confirmation": 0.50, "automation": 0.68 }
    },
    "rahul": {
      "id": "rahul",
      "name": "Rahul",
      "role": "Compliance Officer",
      "risk_appetite": 0.15,
      "sar_threshold": 0.91,
      "freeze_threshold": 0.85,
      "trust_in_ml": 0.40,
      "fatigue_index": 0.08,
      "decision_accuracy": 0.968,
      "bias_vectors": { "anchoring": 0.65, "confirmation": 0.70, "automation": 0.25 }
    },
    "dev": {
      "id": "dev",
      "name": "Dev",
      "role": "Risk Engineer",
      "risk_appetite": 0.50,
      "sar_threshold": 0.85,
      "freeze_threshold": 0.80,
      "trust_in_ml": 0.88,
      "fatigue_index": 0.10,
      "decision_accuracy": 0.915,
      "bias_vectors": { "anchoring": 0.30, "confirmation": 0.35, "automation": 0.50 }
    },
    "meera": {
      "id": "meera",
      "name": "Meera",
      "role": "Operations Head",
      "risk_appetite": 0.60,
      "sar_threshold": 0.90,
      "freeze_threshold": 0.88,
      "trust_in_ml": 0.50,
      "fatigue_index": 0.15,
      "decision_accuracy": 0.889,
      "bias_vectors": { "anchoring": 0.40, "confirmation": 0.45, "automation": 0.35 }
    }
  };
}

function getMockDebateResult(alertId) {
  const isTravel = alertId.includes('TRV');
  const isSwift = alertId.includes('SWIFT');
  
  return {
    dominant_vote: isTravel || isSwift ? 'FREEZE' : 'SAR',
    consensus_confidence: 0.88,
    disagreement_entropy: isSwift ? 0.25 : 0.62,
    minority_report: isSwift 
      ? 'Dissenting Twin Dev argues transaction might represent authorized corporate SWIFT routing. Watchlist check confirmed identical match but compliance mandates secondary review.'
      : 'Dissenting Twin Rahul notes transaction violates velocity filters but cautions against immediate freeze without filing a standard FinCEN 111 document first.',
    debate_transcript: [
      {
        title: "ROUND 1: HYPOTHESIS ALIGNMENT",
        logs: [
          { twin: "Priya", role: "Analyst", action: "EVALUATE", message: `Analyzing target dossier ${alertId}. Risk signature patterns show coordinated velocity layers.` }
        ]
      },
      {
        title: "ROUND 2: REGULATORY AUDIT",
        logs: [
          { twin: "Rahul", role: "Compliance", action: "CRITIQUE", message: "Violates standard Bank Secrecy Act thresholds. Immediate filing of Suspicious Activity Report recommended." }
        ]
      },
      {
        title: "ROUND 3: RISK ENGINEERING ATTRIBUTION",
        logs: [
          { twin: "Dev", role: "Risk Eng.", action: "SAR", message: "Tabular model attributions show highly anomalous coordinate matches. Evasion score is below safety metrics." }
        ]
      },
      {
        title: "ROUND 4: OPERATIONAL REBUTTAL",
        logs: [
          { twin: "Meera", role: "Operations", action: "FREEZE", message: "Concur with Dev. High routing risk requires immediate system lock to prevent asset outflow. Freeze first, audit later." }
        ]
      },
      {
        title: "ROUND 5: STABILITY CONVERGENCE",
        logs: [
          { twin: "Rahul", role: "Compliance", action: "CONVERGE", message: "Consensus reached. Locking transaction state and dispatching FinCEN report drafts." }
        ]
      }
    ]
  };
}
