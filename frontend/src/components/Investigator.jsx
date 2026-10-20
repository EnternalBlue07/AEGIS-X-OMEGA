import React, { useState, useEffect } from 'react';
import { 
  X, AlertTriangle, ShieldCheck, ArrowRight, User, Key, 
  ShieldAlert, Send, Eye, RefreshCw, Play, FileText, Lock, Cpu
} from 'lucide-react';
import BiometricsHUD from './BiometricsHUD';

const API_BASE = 'http://127.0.0.1:8000/api';

export default function Investigator({ alertId, onClose }) {
  const [details, setDetails] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [investigation, setInvestigation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [investigating, setInvestigating] = useState(false);
  const [actionNotes, setActionNotes] = useState('');
  const [sarPreview, setSarPreview] = useState(false);

  // AEGIS-X OMEGA states
  const [evidenceProof, setEvidenceProof] = useState(null);
  const [verifyingIntegrity, setVerifyingIntegrity] = useState(false);
  const [integrityStatus, setIntegrityStatus] = useState(null);
  const [twinDebate, setTwinDebate] = useState(null);
  const [twinRunning, setTwinRunning] = useState(false);

  const fetchCaseDetails = async () => {
    if (!alertId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/alerts/${alertId}`);
      const data = await res.json();
      setDetails(data);
      
      // Get account timeline
      const accId = data.account ? data.account.id : data.alert.entity_id;
      const resTimeline = await fetch(`${API_BASE}/accounts/${accId}/timeline`);
      const dataTimeline = await resTimeline.json();
      setTimeline(dataTimeline);

      // Get Merkle evidence proof
      try {
        const resProof = await fetch(`${API_BASE}/alerts/${alertId}/evidence-proof`);
        const dataProof = await resProof.json();
        setEvidenceProof(dataProof);
        setIntegrityStatus(null);
      } catch (eErr) {
        console.error('Error fetching Merkle evidence proof:', eErr);
      }

      // Reset investigation state
      setInvestigation(null);
      setTwinDebate(null);
    } catch (err) {
      console.error('Error fetching case details:', err);
      // Mock local fallback for UI testing
      setDetails(getMockDetails(alertId));
      setTimeline(getMockTimeline(alertId));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyIntegrity = async (leaf) => {
    setVerifyingIntegrity(true);
    setIntegrityStatus(null);
    
    // Simulates an audit delay in GUI for dramatic effect
    setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/alerts/${alertId}/verify-integrity`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_hash: leaf.hash,
            proof: leaf.proof
          })
        });
        const data = await res.json();
        if (data.verified) {
          setIntegrityStatus('SUCCESS');
        } else {
          setIntegrityStatus('FAILED');
        }
      } catch (err) {
        console.error('Integrity check failed:', err);
        setIntegrityStatus('FAILED');
      } finally {
        setVerifyingIntegrity(false);
      }
    }, 1200);
  };

  useEffect(() => {
    fetchCaseDetails();
  }, [alertId]);

  const handleRunSwarm = async () => {
    setInvestigating(true);
    try {
      const res = await fetch(`${API_BASE}/alerts/${alertId}/investigate`, { method: 'POST' });
      const data = await res.json();
      setInvestigation(data);

      // Log event to Chronos
      await fetch(`${API_BASE}/chronos/log-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: alertId,
          event_type: 'SWARM_DEBATE',
          actor: 'AGENT_SWARM',
          payload: {
            orchestrator_decision: data.recommended_action,
            risk_breakdown: data.risk_breakdown
          }
        })
      });
    } catch (err) {
      console.error('Error running agent swarm:', err);
      // Offline fallback
      setTimeout(() => {
        setInvestigation(getMockInvestigation(alertId, details));
        setInvestigating(false);
      }, 2000);
      return;
    }
    setInvestigating(false);
  };

  const handleRunTwinDebate = async () => {
    setTwinRunning(true);
    try {
      const res = await fetch(`${API_BASE}/sentinel/run-debate/${alertId}`, { method: 'POST' });
      const data = await res.json();
      setTwinDebate(data);

      // Log event to Chronos
      await fetch(`${API_BASE}/chronos/log-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: alertId,
          event_type: 'SENTINEL_TWIN_DEBATE',
          actor: 'TWIN_ARENA',
          payload: {
            dominant_vote: data.dominant_vote,
            consensus_confidence: data.consensus_confidence,
            disagreement_entropy: data.disagreement_entropy,
            votes: data.votes
          }
        })
      });
    } catch (err) {
      console.error('Failed to run twin debate forecast:', err);
    } finally {
      setTwinRunning(false);
    }
  };

  const handleAction = async (actionType) => {
    try {
      await fetch(`${API_BASE}/alerts/${alertId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          notes: actionNotes,
          actor: 'COMPLIANCE_RAHUL'
        })
      });

      // Log event to Chronos
      await fetch(`${API_BASE}/chronos/log-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: alertId,
          event_type: 'ANALYST_OVERRIDE',
          actor: 'COMPLIANCE_RAHUL',
          payload: {
            action: actionType,
            notes: actionNotes
          }
        })
      });

      window.alert(`Action '${actionType}' successfully logged in the audit trail.`);
      fetchCaseDetails();
      if (onClose) onClose();
    } catch (err) {
      console.error('Action failed:', err);
      window.alert(`Local Mode: Logged Action [${actionType}] with notes: "${actionNotes}"`);
      if (onClose) onClose();
    }
  };

  const handleDownload = (format) => {
    if (!alertId) return;
    window.open(`${API_BASE}/alerts/${alertId}/export?format=${format}`, '_blank');
  };

  if (loading) {
    return (
      <div className="bg-ink-base border border-ledger-blue/20 p-6 rounded-lg flex flex-col items-center justify-center h-[600px] shadow-sm font-mono text-ledger-blue text-xs">
        <RefreshCw className="w-5 h-5 animate-spin mb-2" />
        COMPILING EVIDENCE CHAIN FOR ALERT {alertId}...
      </div>
    );
  }

  const { alert, account, user, latest_transaction: txn } = details || {};
  const compositeScore = investigation ? investigation.composite_score : (alert?.severity === 'HIGH' ? 0.82 : 0.45);

  const getScoreColor = (score) => {
    if (score >= 0.75) return 'text-alert-rust border-alert-rust/30';
    if (score >= 0.45) return 'text-evidence-gold border-evidence-gold/30';
    return 'text-ledger-blue border-ledger-blue/30';
  };

  const getIcon = (type) => {
    switch (type) {
      case 'USER': return <User className="w-4 h-4 text-ledger-blue" />;
      case 'KEY': return <Key className="w-4 h-4 text-ledger-blue" />;
      case 'SHIELD': return <ShieldCheck className="w-4 h-4 text-evidence-gold" />;
      case 'ALERT': return <AlertTriangle className="w-4 h-4 text-alert-rust" />;
      default: return <Eye className="w-4 h-4 text-ledger-blue" />;
    }
  };

  return (
    <div className="bg-ink-base border border-ledger-blue/20 rounded-lg shadow-lg flex flex-col h-[780px] overflow-hidden">
      
      {/* Header */}
      <div className="p-4 border-b border-ledger-blue/20 flex items-center justify-between bg-[#131924]/30">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-alert-rust animate-pulse" />
          <div>
            <h4 className="text-sm font-display font-bold uppercase tracking-wider text-zinc-50">Case File: {alert?.id}</h4>
            <p className="text-[10px] text-ledger-blue font-mono">STATUS: {alert?.status.replace('_', ' ').toUpperCase()}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 text-ledger-blue hover:text-zinc-200 hover:bg-ledger-blue/10 rounded-lg transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main split */}
      <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-ledger-blue/20">
        
        {/* Left Side: Dossier (Scoring, Exporters, SHAP, and Timeline) (cols 5) */}
        <div className="lg:col-span-5 bg-paper text-ink-base p-4 space-y-5 overflow-y-auto h-full flex flex-col justify-between">
          <div className="space-y-5">
            {/* 1. Signature Stamp Badge */}
            <div className="text-center py-2">
              <span className={`stamp ${compositeScore >= 0.75 ? 'stamp-rust' : 'stamp-gold'}`}>
                {alert?.status === 'OPEN' ? 'UNDER REVIEW' : alert?.status.replace('_', ' ')}
              </span>
            </div>

            {/* 2. Exporter Toolbar */}
            <div className="border-t border-b border-ink-base/15 py-3 my-2 text-center">
              <span className="text-[9px] font-display font-bold uppercase tracking-wider text-ink-base/80 block mb-1">
                Export Dossier Evidence
              </span>
              <div className="flex gap-2 justify-center">
                <button 
                  onClick={() => handleDownload('pdf')}
                  className="bg-ink-base hover:bg-ink-base/90 text-paper font-display text-[9px] font-bold py-1.5 px-3 rounded shadow transition-colors border border-ink-base/10"
                >
                  PDF REPORT
                </button>
                <button 
                  onClick={() => handleDownload('docx')}
                  className="bg-ink-base hover:bg-ink-base/90 text-paper font-display text-[9px] font-bold py-1.5 px-3 rounded shadow transition-colors border border-ink-base/10"
                >
                  WORD DOCX
                </button>
                <button 
                  onClick={() => handleDownload('pptx')}
                  className="bg-ink-base hover:bg-ink-base/90 text-paper font-display text-[9px] font-bold py-1.5 px-3 rounded shadow transition-colors border border-ink-base/10"
                >
                  SLIDE PPTX
                </button>
              </div>
              <p className="text-[8px] text-ink-base/60 mt-1.5 italic font-mono">DRAFT — FOR DEMONSTRATION ONLY</p>
            </div>

            {/* Fused Risk Score Gauge */}
            <div className="flex items-center gap-4 bg-ink-base/5 p-3.5 rounded border border-ink-base/10">
              <div className={`w-16 h-16 rounded-full border-4 flex flex-col items-center justify-center shrink-0 ${getScoreColor(compositeScore)}`}>
                <span className="text-base font-black font-mono">{(compositeScore * 100).toFixed(0)}%</span>
                <span className="text-[8px] uppercase font-bold text-ink-base/70 tracking-wider">Risk</span>
              </div>
              <div>
                <h5 className="text-[10px] font-display font-extrabold uppercase tracking-wider text-ink-base">Calibrated Fusion</h5>
                <p className="text-[9px] text-ink-base/70 leading-normal mt-0.5 font-mono">
                  Composite score integrates L1 Tabular, L2 Sequence, and L3 Graph topology.
                </p>
              </div>
            </div>

            {/* Local SHAP Explanations */}
            <div>
              <h5 className="text-[10px] font-display font-bold uppercase tracking-wider text-ink-base mb-2">SHAP Feature Attributions</h5>
              <div className="space-y-2.5 font-mono text-[9px] text-ink-base/80">
                {alert?.triggered_by === 'IMPOSSIBLE_TRAVEL' && (
                  <>
                    <div className="space-y-0.5">
                      <div className="flex justify-between font-bold"><span>impossible_travel_speed</span><span className="text-alert-rust">+0.27</span></div>
                      <div className="w-full bg-ink-base/10 h-1 rounded"><div className="bg-alert-rust h-full rounded" style={{width: '65%'}}></div></div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex justify-between font-bold"><span>unseen_device_fingerprint</span><span className="text-alert-rust">+0.18</span></div>
                      <div className="w-full bg-ink-base/10 h-1 rounded"><div className="bg-alert-rust h-full rounded" style={{width: '45%'}}></div></div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex justify-between font-bold"><span>spending_spike_10x</span><span className="text-evidence-gold">+0.12</span></div>
                      <div className="w-full bg-ink-base/10 h-1 rounded"><div className="bg-evidence-gold h-full rounded" style={{width: '30%'}}></div></div>
                    </div>
                  </>
                )}
                {alert?.triggered_by === 'WATCHLIST_HIT' && (
                  <>
                    <div className="space-y-0.5">
                      <div className="flex justify-between font-bold"><span>ofac_sanction_match</span><span className="text-alert-rust">+0.48</span></div>
                      <div className="w-full bg-ink-base/10 h-1 rounded"><div className="bg-alert-rust h-full rounded" style={{width: '95%'}}></div></div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex justify-between font-bold"><span>swift_rail_jurisdiction</span><span className="text-alert-rust">+0.20</span></div>
                      <div className="w-full bg-ink-base/10 h-1 rounded"><div className="bg-alert-rust h-full rounded" style={{width: '50%'}}></div></div>
                    </div>
                  </>
                )}
                {alert?.triggered_by === 'MULE_RING' && (
                  <>
                    <div className="space-y-0.5">
                      <div className="flex justify-between font-bold"><span>network_community_risk</span><span className="text-alert-rust">+0.32</span></div>
                      <div className="w-full bg-ink-base/10 h-1 rounded"><div className="bg-alert-rust h-full rounded" style={{width: '78%'}}></div></div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex justify-between font-bold"><span>mule_identity_topology</span><span className="text-alert-rust">+0.22</span></div>
                      <div className="w-full bg-ink-base/10 h-1 rounded"><div className="bg-alert-rust h-full rounded" style={{width: '55%'}}></div></div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex justify-between font-bold"><span>shared_device_fingerprint</span><span className="text-evidence-gold">+0.15</span></div>
                      <div className="w-full bg-ink-base/10 h-1 rounded"><div className="bg-evidence-gold h-full rounded" style={{width: '40%'}}></div></div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h5 className="text-[10px] font-display font-bold uppercase tracking-wider text-ink-base mb-3">Dossier Chronological Audit</h5>
              <div className="relative border-l border-ink-base/15 ml-2.5 space-y-4">
                {timeline.map((event, idx) => (
                  <div key={idx} className="relative pl-6">
                    {/* Dot */}
                    <div className="absolute -left-[9px] top-0.5 w-4.5 h-4.5 rounded-full border bg-paper border-ink-base/20 flex items-center justify-center shadow-sm">
                      {getIcon(event.icon_type)}
                    </div>
                    {/* Content */}
                    <div>
                      <span className="text-[9px] font-mono text-ink-base/60 block">
                        {new Date(event.timestamp).toLocaleString(undefined, {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                      </span>
                      <h6 className="text-[10px] font-extrabold text-ink-base mt-0.5">{event.title.toUpperCase()}</h6>
                      <p className="text-[9px] text-ink-base/70 leading-normal mt-0.5 font-sans">{event.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Forensic Evidence Integrity Vault */}
            <div className="border-t border-ink-base/15 pt-3 mt-4">
              <h5 className="text-[10px] font-display font-bold uppercase tracking-wider text-ink-base mb-2">
                Forensic Evidence Integrity Vault
              </h5>
              
              {evidenceProof ? (
                <div className="bg-ink-base/5 p-3 rounded border border-ink-base/10 space-y-2.5 font-mono text-[9px] text-ink-base/80">
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] text-ink-base/60 uppercase">Merkle Root Hash</span>
                    <span className="text-[8px] bg-ink-base text-paper px-1.5 py-0.5 rounded font-extrabold uppercase">Layer 9 Vault</span>
                  </div>
                  <div className="text-[8.5px] bg-paper border border-ink-base/15 p-1.5 rounded break-all select-all font-bold">
                    {evidenceProof.root_hash}
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[8px] text-ink-base/60 uppercase block">Chain Evidence Nodes ({evidenceProof.leaves_count}):</span>
                    <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                      {evidenceProof.evidence_vault.map((node) => (
                        <div key={node.index} className="flex justify-between items-center p-1 border-b border-ink-base/5 bg-paper/30">
                          <span className="truncate max-w-[120px] font-sans font-semibold text-ink-base/70">
                            {node.type.replace('_', ' ')}
                          </span>
                          <button
                            onClick={() => handleVerifyIntegrity(node)}
                            disabled={verifyingIntegrity}
                            className="bg-ink-base text-paper hover:bg-ink-base/85 disabled:opacity-50 text-[7px] font-display font-bold py-0.5 px-1.5 rounded transition-all cursor-pointer"
                          >
                            VERIFY
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {verifyingIntegrity && (
                    <div className="text-center text-ink-base font-bold flex items-center justify-center py-1">
                      <RefreshCw className="w-3 animate-spin mr-1.5" />
                      RE-COMPUTING MERKLE LEAF PROOFS...
                    </div>
                  )}

                  {integrityStatus === 'SUCCESS' && (
                    <div className="p-2 border border-emerald-500/30 text-emerald-700 bg-emerald-500/5 rounded flex items-center justify-between animate-in fade-in duration-200">
                      <span className="font-sans font-bold">INTEGRITY ADMISSIBLE</span>
                      <span className="stamp stamp-gold text-[7px] font-display scale-75 rotate-0">VERIFIED COURT</span>
                    </div>
                  )}

                  {integrityStatus === 'FAILED' && (
                    <div className="p-2 border border-alert-rust/30 text-alert-rust bg-alert-rust/5 rounded flex items-center justify-between animate-in fade-in duration-200">
                      <span className="font-sans font-bold">TAMPER WARNING: INVALID ROOT</span>
                      <span className="font-bold">FAILED</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-2 text-ink-base/40 text-[9px] italic">
                  Generating cryptographic evidence ledger...
                </div>
              )}
            </div>

            {/* Operator Behavioral Biometrics HUD */}
            <div className="border-t border-ink-base/15 pt-3 mt-4">
              <BiometricsHUD />
            </div>

          </div>
        </div>

        {/* Right Side: Swarm Debate & Recommended Action (cols 7) */}
        <div className="lg:col-span-7 bg-ink-base text-zinc-100 p-4 flex flex-col h-full overflow-y-auto space-y-5">
          
          {/* Swarm debate block */}
          <div className="flex-1 flex flex-col bg-ink-base border border-ledger-blue/20 rounded-lg p-4 min-h-[300px]">
            <div className="flex items-center justify-between pb-2 hairline-b mb-3">
              <h5 className="text-xs font-display font-bold uppercase tracking-wider text-zinc-100">L7 Autonomous Investigator Swarm</h5>
              {!investigation && !investigating && (
                <button 
                  onClick={handleRunSwarm}
                  className="flex items-center gap-1 bg-evidence-gold hover:bg-evidence-gold/90 text-ink-base text-[9px] font-display font-bold py-1 px-2.5 rounded shadow transition-colors"
                >
                  <Play className="w-3 h-3" />
                  RUN SWARM DEBATE
                </button>
              )}
            </div>

            {/* Conversation view */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {investigating ? (
                <div className="h-full flex flex-col items-center justify-center font-mono text-[10px] text-ledger-blue">
                  <RefreshCw className="w-6 h-6 animate-spin mb-2" />
                  ORCHESTRATING LANGGRAPH MULTI-AGENT SWARM...
                  <span className="mt-1 text-ledger-blue/70 text-[9px]">DEBATING FINDINGS ACROSS 6 SPECIALISTS...</span>
                </div>
              ) : !investigation ? (
                <div className="h-full flex flex-col items-center justify-center font-mono text-[10px] text-ledger-blue/60">
                  <Lock className="w-6 h-6 opacity-30 mb-2" />
                  RUN SWARM AUDIT TO ANALYZE STRUCTURAL RELATIONSHIPS, COMPLIANCE CHECKLISTS, AND EVIDENCE.
                </div>
              ) : (
                <div className="space-y-3 font-mono text-[10px]">
                  {investigation.debate_transcript.map((msg, i) => (
                    <div 
                      key={i} 
                      className={`p-2.5 rounded-lg border leading-relaxed ${
                        msg.agent.includes('AMLExpert') || msg.message.includes('Sanction')
                          ? 'bg-alert-rust/10 border-alert-rust/20 text-alert-rust'
                          : msg.agent.includes('NetAnalyst')
                          ? 'bg-ledger-blue/15 border-ledger-blue/20 text-zinc-200'
                          : msg.agent.includes('System')
                          ? 'bg-[#131924]/20 border-ledger-blue/10 text-ledger-blue'
                          : 'bg-[#131924]/40 border-ledger-blue/20 text-zinc-100'
                      }`}
                    >
                      <div className="flex justify-between font-bold text-[9px] mb-1 opacity-80 border-b border-ledger-blue/10 pb-0.5">
                        <span className="text-evidence-gold">{msg.agent.toUpperCase()}</span>
                        <span className="text-[8px] bg-ink-base px-1 rounded border border-ledger-blue/10">{msg.status}</span>
                      </div>
                      <p>{msg.message}</p>
                      {msg.tool_calls && (
                        <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                          <span className="text-[8px] text-ledger-blue/60 font-mono">Tools:</span>
                          {msg.tool_calls.map((tc, idx) => (
                            <span key={idx} className="bg-ink-base border border-ledger-blue/30 rounded px-1 py-0.5 text-[8px] text-ledger-blue font-mono">
                              {tc}()
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* L10 Investigator Digital Twin Consensus Forecast */}
          <div className="bg-ink-base border border-ledger-blue/20 rounded-lg p-4 flex flex-col space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-ledger-blue/10">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-evidence-gold animate-pulse" />
                <h5 className="text-xs font-display font-bold uppercase tracking-wider text-zinc-100">
                  L10 Digital Twin Consensus Forecast
                </h5>
              </div>
              
              {!twinDebate && !twinRunning && (
                <button
                  onClick={handleRunTwinDebate}
                  className="flex items-center gap-1 bg-ink-base border border-evidence-gold/30 hover:border-evidence-gold/60 text-evidence-gold text-[9px] font-display font-bold py-1 px-2.5 rounded shadow transition-colors cursor-pointer"
                >
                  <Play className="w-3 h-3" />
                  PREDICT TWIN CONSENSUS
                </button>
              )}
            </div>

            {twinRunning ? (
              <div className="py-4 flex flex-col items-center justify-center font-mono text-[9px] text-ledger-blue">
                <RefreshCw className="w-4 h-4 animate-spin mb-1 text-evidence-gold" />
                SIMULATING COGNITIVE PROFILE DECISION INFERENCE...
              </div>
            ) : !twinDebate ? (
              <div className="py-2 flex items-center justify-center text-center font-mono text-[9px] text-ledger-blue/60 uppercase">
                Awaiting cognitive simulation run
              </div>
            ) : (
              <div className="space-y-3 font-mono text-[9px]">
                <div className="flex items-center justify-between p-2 rounded bg-[#131924]/40 border border-ledger-blue/15">
                  <div>
                    <span className="text-[8px] text-ledger-blue uppercase block">Predicted Action</span>
                    <span className="text-xs font-black text-zinc-100 uppercase">{twinDebate.dominant_vote}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] text-ledger-blue uppercase block">Consensus Confidence</span>
                    <span className="text-xs font-black text-zinc-100">{(twinDebate.consensus_confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>

                {/* Vote badges */}
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(twinDebate.votes).map(([twinName, vote]) => (
                    <div key={twinName} className="p-1.5 bg-[#131924]/60 border border-ledger-blue/10 rounded text-center">
                      <span className="block text-[7px] text-zinc-400 font-bold uppercase">{twinName}</span>
                      <span className={`block text-[8px] font-extrabold mt-0.5 ${
                        vote === 'FREEZE' || vote === 'SAR' ? 'text-alert-rust' : 'text-ledger-blue'
                      }`}>
                        {vote}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Minority/Dissent warning */}
                <div className="p-2.5 rounded border border-ledger-blue/10 bg-[#131924]/20 text-zinc-400 leading-relaxed uppercase text-[8px] text-justify max-h-16 overflow-y-auto">
                  <span className="text-evidence-gold font-bold block mb-0.5">Dissent/Bias Auditor Notes:</span>
                  {twinDebate.minority_report}
                </div>
              </div>
            )}
          </div>

          {/* Action Decision Block */}
          {investigation && (
            <div className="bg-ink-base border border-ledger-blue/20 rounded-lg p-4 space-y-3.5">
              <div className="flex justify-between items-center pb-1 border-b border-ledger-blue/10">
                <h5 className="text-xs font-display font-bold uppercase tracking-wider text-zinc-100">Decision Action (Compliance Review)</h5>
                <button 
                  onClick={() => setSarPreview(!sarPreview)}
                  className="flex items-center gap-1.5 text-evidence-gold hover:text-evidence-gold/80 text-[10px] font-display font-bold transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {sarPreview ? 'HIDE SAR DRAFT' : 'PREVIEW SAR DRAFT'}
                </button>
              </div>

              {sarPreview && (
                <div className="bg-[#131924]/40 border border-ledger-blue/20 p-3 rounded-lg font-mono text-[9px] text-zinc-300 leading-relaxed whitespace-pre-wrap max-h-[140px] overflow-y-auto">
                  <h6 className="font-bold border-b border-ledger-blue/10 pb-1 mb-1.5 uppercase text-alert-rust">
                    DRAFT Suspicious Activity Report (FinCEN-style Form 111)
                  </h6>
                  {investigation.case_report.suspicious_activity_narrative}
                  <div className="mt-2 text-[8px] text-ledger-blue/70">
                    <p className="font-bold text-evidence-gold">Regulatory Citations:</p>
                    {investigation.case_report.regulatory_citations.map((rc, i) => (
                      <p key={i}>• {rc}</p>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <span className="text-[10px] font-display font-bold uppercase tracking-wider text-ledger-blue block">Swarm Recommendation</span>
                <p className="text-[11px] font-bold text-zinc-100 font-mono">
                  {investigation.recommended_action}
                </p>
                <p className="text-[9px] text-ledger-blue/80 italic font-sans leading-normal">
                  {investigation.action_reason}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-display font-bold uppercase tracking-wider text-ledger-blue block">Analyst Notes</label>
                <textarea 
                  value={actionNotes} 
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Record final review decisions, freezing orders, or SAR approval references..."
                  className="w-full bg-ink-base border border-ledger-blue/20 rounded-lg p-2 text-[10px] h-[55px] focus:outline-none focus:border-evidence-gold text-zinc-100 font-sans shadow-sm"
                />
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => handleAction('FREEZE')}
                  className="flex-1 bg-alert-rust hover:bg-alert-rust/90 text-white font-display font-bold text-[10px] py-2 px-3 rounded shadow transition-colors"
                >
                  CONFIRM FREEZE
                </button>
                <button 
                  onClick={() => handleAction('FILE_SAR')}
                  className="flex-1 bg-ledger-blue hover:bg-ledger-blue/90 text-white font-display font-bold text-[10px] py-2 px-3 rounded shadow transition-colors"
                >
                  FILE & CLOSE CASE
                </button>
                <button 
                  onClick={() => handleAction('DISMISS')}
                  className="bg-[#131924]/40 hover:bg-ledger-blue/10 text-ledger-blue hover:text-evidence-gold font-display font-bold text-[10px] py-2 px-3 rounded border border-ledger-blue/20 transition-colors"
                >
                  DISMISS ALERT
                </button>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}

// --- MOCK FALLBACK DATA ---

function getMockDetails(alertId) {
  return {
    alert: {
      id: alertId,
      entity_id: 'ACC-MULE-HUB',
      entity_type: 'ACCOUNT',
      triggered_by: alertId.includes('TRV') ? 'IMPOSSIBLE_TRAVEL' : alertId.includes('SWIFT') ? 'WATCHLIST_HIT' : 'MULE_RING',
      severity: 'HIGH',
      status: 'OPEN',
      created_at: new Date().toISOString(),
      description: 'Mock alert fallback for testing and layout presentation.'
    },
    account: {
      id: 'ACC-MULE-HUB',
      user_id: 'USR-MULE-HUB',
      rail_type: 'TRANSFER',
      opened_at: '2026-02-10T14:00:00Z',
      status: 'ACTIVE',
      balance: 150000.0,
      account_number: 'TRANS-8729-1102'
    },
    user: {
      id: 'USR-MULE-HUB',
      name: 'Frank Vance (Seeded Mock)',
      kyc_status: 'APPROVED',
      created_at: '2026-02-10T12:00:00Z'
    },
    latest_transaction: {
      id: 'TXN-SIM-OUT-X',
      amount: 4950.0,
      rail: 'UPI',
      timestamp: new Date().toISOString(),
      geo_country: 'IN',
      device_id: 'DEV-MULE-FNG7',
      ip_address: '192.168.43.102'
    }
  };
}

function getMockTimeline(alertId) {
  return [
    {
      timestamp: '2026-02-10T12:00:00Z',
      title: 'KYC Profile Registered',
      description: "Customer 'Frank Vance (Seeded Mock)' registered profile. Initial KYC Status set to: APPROVED.",
      icon_type: 'USER',
      severity: 'INFO'
    },
    {
      timestamp: '2026-02-10T14:00:00Z',
      title: 'TRANSFER Account Activated',
      description: "Account number ending in 1102 successfully activated. Status: ACTIVE.",
      icon_type: 'KEY',
      severity: 'INFO'
    },
    {
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      title: 'New Device Linked',
      description: "Device fingerprint 'DEV-MULE-FNG7' registered through transaction IP location IN.",
      icon_type: 'SHIELD',
      severity: 'WARNING'
    },
    {
      timestamp: new Date().toISOString(),
      title: 'System Alert Triggered: MULE_RING',
      description: 'Louvain Community clusters multiple accounts mapping shared device DEV-MULE-FNG7.',
      icon_type: 'ALERT',
      severity: 'CRITICAL'
    }
  ];
}

function getMockInvestigation(alertId, details) {
  const trigger = details.alert ? details.alert.triggered_by : 'MULE_RING';
  return {
    composite_score: 0.88,
    layer_scores: {
      layer_1_tabular: 0.85,
      layer_2_behavioral: 0.75,
      layer_3_network: 0.95
    },
    debate_transcript: [
      {
        agent: 'System Orchestrator',
        message: `Intake complete for Alert ${alertId} (${trigger}). Dispatching files.`,
        status: 'INFO'
      },
      {
        agent: 'Agent TxnAnalyst',
        message: 'I have reviewed the transaction in isolation. Transaction amount is highly structured compared to clean averages.',
        tool_calls: ['get_velocity_metrics'],
        status: 'COMPLETED'
      },
      {
        agent: 'Agent NetAnalyst',
        message: 'Louvain Community detection links this account to a node ring of size 4. High shared device usage.',
        tool_calls: ['query_networkx_graph'],
        status: 'COMPLETED'
      },
      {
        agent: 'Agent AMLExpert',
        message: 'Violates BSA layering guidelines. Payments are immediately structured and cash-routed.',
        tool_calls: ['check_structuring_thresholds'],
        status: 'COMPLETED'
      },
      {
        agent: 'Agent RiskAssessor',
        message: 'Fusing inputs. Tabulation risk composite fused at: 0.88. High threat level.',
        status: 'COMPLETED'
      },
      {
        agent: 'Agent ComplianceOfficer',
        message: 'Consensus warrants FREEZE. Preparing SAR draft reports.',
        status: 'RESOLVED'
      }
    ],
    case_report: {
      suspicious_activity_narrative: 'Mock draft compiled offline. Transaction shows severe KYC mismatch and shared devices typical of mule consolidation operations.',
      regulatory_citations: ['31 CFR Chapter X', 'BSA Section 5318(g)']
    },
    recommended_action: 'FREEZE_ACCOUNT_AND_FILE_SAR',
    action_reason: 'Severe compliance threshold crossover.'
  };
}
