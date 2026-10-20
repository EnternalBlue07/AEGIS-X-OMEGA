import React, { useState, useEffect, useRef } from 'react';
import { 
  History, GitBranch, GitFork, RefreshCw, Layers, ShieldCheck, 
  HelpCircle, Eye, ChevronRight, Play, CheckCircle, AlertTriangle, ArrowRight
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api';

export default function Chronos() {
  const [alertId, setAlertId] = useState('ALT-MULE-001');
  const [activeBranch, setActiveBranch] = useState('main');
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scrubValue, setScrubValue] = useState(100); // percentage of commits to replay

  // Fork state
  const [showForkModal, setShowForkModal] = useState(false);
  const [newForkName, setNewForkName] = useState('');
  
  // Replay State
  const [reconstructedState, setReconstructedState] = useState(null);
  const [reconstructing, setReconstructing] = useState(false);

  // Diff State
  const [commitA, setCommitA] = useState('');
  const [commitB, setCommitB] = useState('');
  const [diffResult, setDiffResult] = useState(null);
  const [diffing, setDiffing] = useState(false);

  // Heatmap replay animation
  const [animateMouse, setAnimateMouse] = useState(false);
  const [mouseCoord, setMouseCoord] = useState({ x: 0, y: 0 });
  const mouseCanvasRef = useRef(null);

  // Fetch commit history and branches
  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/chronos/case/${alertId}/history?branch=${activeBranch}`);
      const data = await res.json();
      setHistoryData(data);
      
      // Default diff selections to oldest and newest commits
      if (data.history && data.history.length > 0) {
        setCommitA(data.history[0].hash);
        setCommitB(data.history[data.history.length - 1].hash);
        
        // Auto-reconstruct latest state
        triggerReconstruct(data.history[data.history.length - 1].hash);
      }
    } catch (err) {
      console.error('Failed to load Chronos history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [alertId, activeBranch]);

  // Replay state up to a specific commit
  const triggerReconstruct = async (commitHash) => {
    setReconstructing(true);
    try {
      const res = await fetch(`${API_BASE}/chronos/case/${alertId}/reconstruct?branch=${activeBranch}&commit=${commitHash}`);
      const data = await res.json();
      setReconstructedState(data.state);
    } catch (err) {
      console.error('Reconstruction failed:', err);
    } finally {
      setReconstructing(false);
    }
  };

  // Scrubber slide handler
  const handleScrubChange = (e) => {
    const val = parseInt(e.target.value);
    setScrubValue(val);
    
    if (historyData && historyData.history && historyData.history.length > 0) {
      // Calculate target index (1-indexed base)
      const maxIdx = historyData.history.length - 1;
      const targetIdx = Math.max(0, Math.min(Math.round((val / 100) * maxIdx), maxIdx));
      const targetCommit = historyData.history[targetIdx];
      
      if (targetCommit) {
        triggerReconstruct(targetCommit.hash);
      }
    }
  };

  // Fork creator handler
  const handleCreateFork = async () => {
    if (!newForkName) return;
    try {
      const res = await fetch(`${API_BASE}/chronos/case/${alertId}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_branch: activeBranch,
          new_branch_name: newForkName
        })
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setActiveBranch(data.new_branch);
        setShowForkModal(false);
        setNewForkName('');
        fetchHistory();
      }
    } catch (err) {
      console.error('Failed to create fork branch:', err);
    }
  };

  // Run Decision Diff Audit
  const handleRunDiff = async () => {
    if (!commitA || !commitB) return;
    setDiffing(true);
    setDiffResult(null);
    try {
      const res = await fetch(
        `${API_BASE}/chronos/case/${alertId}/diff?branch_a=${activeBranch}&commit_a=${commitA}&branch_b=${activeBranch}&commit_b=${commitB}`
      );
      const data = await res.json();
      setDiffResult(data);
    } catch (err) {
      console.error('Diff computation failed:', err);
    } finally {
      setDiffing(false);
    }
  };

  // Playback mouse path telemetry animation
  const handlePlayMousePath = () => {
    if (!reconstructedState || reconstructedState.mouse_tracks.length === 0) return;
    
    setAnimateMouse(true);
    const canvas = mouseCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Aggregate coordinates from all log paths
    const path = reconstructedState.mouse_tracks.flatMap(t => t.coordinates);
    if (path.length === 0) return;

    let idx = 0;
    const interval = setInterval(() => {
      if (idx < path.length) {
        const pt = path[idx];
        setMouseCoord(pt);
        
        // Draw trailing path
        ctx.fillStyle = '#C99B4D'; // gold glow
        ctx.beginPath();
        ctx.arc(pt.x / 2.5, pt.y / 2.5, 4, 0, Math.PI * 2);
        ctx.fill();

        if (idx > 0) {
          ctx.strokeStyle = 'rgba(92, 130, 166, 0.4)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(path[idx - 1].x / 2.5, path[idx - 1].y / 2.5);
          ctx.lineTo(pt.x / 2.5, pt.y / 2.5);
          ctx.stroke();
        }

        idx++;
      } else {
        clearInterval(interval);
        setAnimateMouse(false);
      }
    }, 120);
  };

  if (loading) {
    return (
      <div className="bg-ink-base hairline-all p-6 rounded-lg flex items-center justify-center h-[500px] font-mono text-ledger-blue">
        <RefreshCw className="w-5 h-5 animate-spin mr-2.5 text-evidence-gold" />
        Synchronizing audit-chain blocks...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* 1. Header Toolbar */}
      <div className="bg-ink-base hairline-all p-4 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <History className="w-5 h-5 text-evidence-gold" />
          <div>
            <h4 className="text-sm font-display font-extrabold tracking-widest text-zinc-50 uppercase">CHRONOS: INVESTIGATION TIME MACHINE</h4>
            <p className="text-[10px] text-ledger-blue font-mono uppercase">Scrub historical case states, audit decision diffs, and fork parallel hypothesis branches</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <select 
            value={alertId}
            onChange={(e) => setAlertId(e.target.value)}
            className="bg-ink-base border border-ledger-blue/20 rounded px-2.5 py-1 text-xs font-mono text-ledger-blue uppercase focus:outline-none focus:border-evidence-gold"
          >
            <option value="ALT-MULE-001">ALT-MULE-001 (Mule Ring)</option>
          </select>
          
          <div className="flex items-center gap-2 border border-ledger-blue/25 rounded px-2 bg-ink-base">
            <GitBranch className="w-3.5 h-3.5 text-ledger-blue" />
            <select 
              value={activeBranch}
              onChange={(e) => setActiveBranch(e.target.value)}
              className="bg-transparent border-0 py-1 text-xs font-mono text-ledger-blue uppercase focus:outline-none cursor-pointer"
            >
              {historyData?.branches.map(b => (
                <option key={b} value={b} className="bg-ink-base">BRANCH: {b.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={() => setShowForkModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-evidence-gold/20 hover:border-evidence-gold/40 rounded-lg text-evidence-gold hover:bg-evidence-gold/5 transition-colors bg-ink-base text-xs font-semibold font-mono"
          >
            <GitFork className="w-3.5 h-3.5" />
            FORK BRANCH
          </button>
        </div>
      </div>

      {/* 2. Fork Modal Pop-up */}
      {showForkModal && (
        <div className="fixed inset-0 bg-ink-base/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-ink-base border border-ledger-blue/20 rounded-lg p-6 w-[350px] font-mono text-xs space-y-4">
            <h5 className="font-display font-extrabold uppercase text-sm tracking-wider text-zinc-100 pb-2 border-b border-ledger-blue/10">
              Fork Active Timeline
            </h5>
            <div>
              <label className="text-[10px] text-ledger-blue block mb-1 uppercase">Fork Name</label>
              <input 
                type="text" 
                value={newForkName}
                onChange={(e) => setNewForkName(e.target.value)}
                placeholder="hypothesis-mule-collusion"
                className="w-full bg-[#131924] border border-ledger-blue/20 rounded px-2.5 py-1.5 text-zinc-100 focus:outline-none focus:border-evidence-gold uppercase"
              />
            </div>
            <div className="flex gap-2.5 pt-2">
              <button 
                onClick={handleCreateFork}
                className="flex-1 bg-evidence-gold text-ink-base hover:bg-evidence-gold/90 font-display font-bold py-1.5 rounded transition-all cursor-pointer"
              >
                CLONE HEAD
              </button>
              <button 
                onClick={() => setShowForkModal(false)}
                className="flex-1 border border-ledger-blue/20 hover:bg-ledger-blue/5 text-ledger-blue font-display font-bold py-1.5 rounded transition-all cursor-pointer"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Scrub Timeline & Playback Cockpit Row */}
      <div className="bg-ink-base hairline-all p-5 rounded-lg space-y-4 font-mono text-xs">
        <div className="flex justify-between items-center pb-2 border-b border-ledger-blue/10">
          <span className="text-[10px] font-display font-bold text-zinc-50 uppercase tracking-wider">Scrubbing & Playback Cockpit</span>
          <span className="text-[9px] text-ledger-blue uppercase font-bold">State Engine: Replaying {reconstructedState?.commits_replayed} Commits</span>
        </div>

        {/* Replay Slider scrubber */}
        <div className="space-y-2">
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={scrubValue} 
            onChange={handleScrubChange}
            className="w-full h-1 bg-[#131924] border border-ledger-blue/15 rounded-lg appearance-none cursor-pointer accent-evidence-gold"
          />
          <div className="flex justify-between text-[8px] text-ledger-blue font-bold">
            <span>GENESIS_ROOT</span>
            <span>TIMELINE HEAD</span>
          </div>
        </div>

        {/* Live Reconstructed State dashboard */}
        {reconstructedState && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-zinc-400">
            <div className="p-3 bg-[#131924]/60 border border-ledger-blue/10 rounded-lg">
              <span className="text-[8px] text-ledger-blue block uppercase">Risk Score</span>
              <h3 className={`text-2xl font-black mt-0.5 font-mono ${
                reconstructedState.risk_score > 0.75 ? 'text-alert-rust' : 'text-zinc-100'
              }`}>
                {(reconstructedState.risk_score * 100).toFixed(0)}%
              </h3>
              <p className="text-[8px] text-zinc-500 mt-1 uppercase">Dynamic Fused Score</p>
            </div>

            <div className="p-3 bg-[#131924]/60 border border-ledger-blue/10 rounded-lg">
              <span className="text-[8px] text-ledger-blue block uppercase">Dossier Status</span>
              <h3 className="text-2xl font-black text-zinc-100 mt-0.5 font-mono">
                {reconstructedState.status.replace('_', ' ')}
              </h3>
              <p className="text-[8px] text-zinc-500 mt-1 uppercase">Admissible stage</p>
            </div>

            <div className="p-3 bg-[#131924]/60 border border-ledger-blue/10 rounded-lg">
              <span className="text-[8px] text-ledger-blue block uppercase">Evidence Count</span>
              <h3 className="text-2xl font-black text-zinc-100 mt-0.5 font-mono">
                {reconstructedState.evidence_count} Nodes
              </h3>
              <p className="text-[8px] text-zinc-500 mt-1 uppercase">Merkle Proof Leaves</p>
            </div>

            <div className="p-3 bg-[#131924]/60 border border-ledger-blue/10 rounded-lg">
              <span className="text-[8px] text-ledger-blue block uppercase">Twin consensus</span>
              <h3 className="text-2xl font-black text-zinc-100 mt-0.5 font-mono">
                {reconstructedState.twin_debate?.dominant_vote || 'NONE'}
              </h3>
              <p className="text-[8px] text-zinc-500 mt-1 uppercase">Votes: {reconstructedState.twin_debate ? 'FUSED' : 'AWAITING'}</p>
            </div>
          </div>
        )}
      </div>

      {/* 4. Commit History Tree vs Diff Viewer Column Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[550px]">
        
        {/* Left Panel: Commit Tree History (4 cols) */}
        <div className="lg:col-span-4 space-y-4 flex flex-col">
          <h5 className="text-[10px] font-display font-bold uppercase tracking-wider text-ledger-blue pb-1 border-b border-ledger-blue/10 font-mono">
            Cryptographic Commit Tree
          </h5>
          
          <div className="flex-1 bg-ink-base border border-ledger-blue/15 rounded-lg p-4 font-mono text-[9px] overflow-y-auto max-h-[500px] space-y-3">
            {historyData?.history.map((commit, idx) => {
              const isSelectedA = commit.hash === commitA;
              const isSelectedB = commit.hash === commitB;
              
              return (
                <div 
                  key={commit.hash} 
                  className={`p-3 border rounded-lg space-y-2 relative transition-all group ${
                    isSelectedB 
                      ? 'border-evidence-gold bg-evidence-gold/5 shadow-[0_0_12px_rgba(201,155,77,0.06)]'
                      : isSelectedA 
                      ? 'border-ledger-blue bg-ledger-blue/5'
                      : 'border-ledger-blue/15 hover:border-ledger-blue/30'
                  }`}
                >
                  {/* Connection lines stenciled tree representation */}
                  {idx < historyData.history.length - 1 && (
                    <div className="absolute left-[20px] top-[40px] bottom-[-20px] w-0.5 bg-ledger-blue/15 z-0"></div>
                  )}

                  <div className="flex items-center justify-between pb-1 border-b border-ledger-blue/5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-zinc-100 uppercase">{commit.event_type}</span>
                    </div>
                    <span className="text-[7px] text-zinc-500 font-mono tracking-tighter">
                      {new Date(commit.timestamp * 1000).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] text-zinc-400">
                      <span>AUTHOR: {commit.actor}</span>
                      <span className="font-bold text-zinc-300 font-mono">{commit.hash.slice(0, 8)}</span>
                    </div>
                  </div>

                  {/* Diff selector triggers */}
                  <div className="flex gap-2 pt-1.5 border-t border-ledger-blue/5 justify-end">
                    <button 
                      onClick={() => setCommitA(commit.hash)}
                      className="px-1.5 py-0.5 border border-ledger-blue/30 text-ledger-blue hover:text-zinc-100 hover:bg-ledger-blue/10 rounded font-bold uppercase text-[7px]"
                    >
                      Compare [A]
                    </button>
                    <button 
                      onClick={() => setCommitB(commit.hash)}
                      className="px-1.5 py-0.5 border border-evidence-gold/30 text-evidence-gold hover:text-zinc-100 hover:bg-evidence-gold/10 rounded font-bold uppercase text-[7px]"
                    >
                      Compare [B]
                    </button>
                    <button 
                      onClick={() => triggerReconstruct(commit.hash)}
                      className="px-1.5 py-0.5 border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 rounded font-bold uppercase text-[7px]"
                    >
                      Replay Here
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Panel: Heatmap Replay Canvas (4 cols) */}
        <div className="lg:col-span-4 space-y-4 flex flex-col">
          <h5 className="text-[10px] font-display font-bold uppercase tracking-wider text-ledger-blue pb-1 border-b border-ledger-blue/10 font-mono">
            Heatmap Telemetry Replay
          </h5>
          
          <div className="flex-1 bg-ink-base border border-ledger-blue/15 rounded-lg p-5 font-mono text-[10px] space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <span className="text-[8px] text-ledger-blue uppercase block">Visual Attention Trace</span>
              
              {/* Telemetry Canvas Mock */}
              <div className="relative border border-ledger-blue/10 rounded bg-[#131924]/60 h-64 overflow-hidden textured-canvas">
                <canvas 
                  ref={mouseCanvasRef} 
                  width="300" 
                  height="250" 
                  className="absolute inset-0 w-full h-full"
                />
                
                {animateMouse && (
                  <div 
                    className="absolute w-3 h-3 bg-evidence-gold rounded-full border border-zinc-100 -translate-x-1.5 -translate-y-1.5 shadow-[0_0_8px_rgba(201,155,77,0.8)] pointer-events-none transition-all duration-100"
                    style={{ left: `${mouseCoord.x / 2.5}px`, top: `${mouseCoord.y / 2.5}px` }}
                  ></div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[8px] text-zinc-500">
                <span>REPLAY COORDINATES</span>
                <span className="font-bold text-zinc-300 font-mono">X: {mouseCoord.x} / Y: {mouseCoord.y}</span>
              </div>
              <button 
                onClick={handlePlayMousePath}
                disabled={animateMouse || !reconstructedState || reconstructedState.mouse_tracks.length === 0}
                className="w-full flex items-center justify-center gap-1 bg-ink-base border border-evidence-gold/30 hover:border-evidence-gold/60 text-evidence-gold py-2 rounded text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-evidence-gold/10" />
                {animateMouse ? 'Replaying Telemetry...' : 'Replay Mouse Path'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel: Decision Diff Viewer (4 cols) */}
        <div className="lg:col-span-4 space-y-4 flex flex-col">
          <h5 className="text-[10px] font-display font-bold uppercase tracking-wider text-ledger-blue pb-1 border-b border-ledger-blue/10 font-mono">
            Decision Diff Auditor
          </h5>

          <div className="flex-1 bg-ink-base border border-ledger-blue/15 rounded-lg p-5 font-mono text-[9px] space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 pb-3 border-b border-ledger-blue/10">
                <div>
                  <span className="text-[8px] text-ledger-blue uppercase block">Commit [A]</span>
                  <span className="font-bold text-zinc-300 font-mono block truncate">{commitA ? commitA.slice(0, 16) : 'NONE'}</span>
                </div>
                <div>
                  <span className="text-[8px] text-evidence-gold uppercase block">Commit [B]</span>
                  <span className="font-bold text-zinc-300 font-mono block truncate">{commitB ? commitB.slice(0, 16) : 'NONE'}</span>
                </div>
              </div>

              {diffing ? (
                <div className="py-12 flex flex-col items-center justify-center font-mono text-ledger-blue">
                  <RefreshCw className="w-5 h-5 animate-spin mb-2" />
                  COMPUTING STATE DELTAS...
                </div>
              ) : diffResult ? (
                <div className="space-y-4">
                  {diffResult.has_changes ? (
                    <div className="space-y-3">
                      <span className="text-[8px] text-zinc-400 block uppercase font-bold text-alert-rust">Detected State Deltas:</span>
                      
                      <div className="divide-y divide-ledger-blue/10">
                        {Object.entries(diffResult.deltas).map(([field, delta]) => {
                          if (field === 'added_evidence' || field === 'removed_evidence') {
                            const list = delta;
                            return (
                              <div key={field} className="py-2.5 space-y-1">
                                <span className="text-zinc-400 block uppercase font-bold text-[8px]">{field.replace('_', ' ')}</span>
                                <div className="space-y-1 text-[8px]">
                                  {list.map((file, i) => (
                                    <div key={i} className="text-emerald-500">
                                      + {file.type} // {file.doc_id.slice(0, 12)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div key={field} className="py-2.5 flex justify-between items-center text-[8.5px]">
                              <span className="text-zinc-400 block uppercase font-bold">{field.replace('_', ' ')}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-zinc-400 line-through">{delta.before}</span>
                                <ArrowRight className="w-3 h-3 text-ledger-blue" />
                                <span className="text-zinc-100 font-bold">{delta.after}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-emerald-500 font-bold uppercase flex flex-col items-center justify-center gap-1.5 border border-emerald-500/20 bg-emerald-500/5 p-3 rounded">
                      <CheckCircle className="w-5 h-5" />
                      <span>Zero state drift detected between commits.</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-ledger-blue/60 uppercase">
                  Select commits to audit decision differences.
                </div>
              )}
            </div>

            <button 
              onClick={handleRunDiff}
              disabled={diffing || !commitA || !commitB}
              className="w-full bg-[#131924]/80 border border-ledger-blue/20 hover:border-ledger-blue/40 text-ledger-blue hover:text-evidence-gold py-2 rounded text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
            >
              Run Comparative Audit
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
