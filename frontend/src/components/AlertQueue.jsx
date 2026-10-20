import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, ShieldCheck, Activity, Layers, Play, Pause, Flame, Search, Filter, RefreshCw } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api';

export default function AlertQueue({ onSelectAlert, activeAlertId }) {
  const [alerts, setAlerts] = useState([]);
  const [kpis, setKpis] = useState({
    total_alerts: 0,
    critical_alerts: 0,
    investigated_cases: 0,
    active_mule_rings: 0
  });
  const [liveTxns, setLiveTxns] = useState([]);
  const [isLiveActive, setIsLiveActive] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);

  const fetchAlertsAndKPIs = async () => {
    try {
      const resAlerts = await fetch(`${API_BASE}/alerts`);
      const dataAlerts = await resAlerts.json();
      setAlerts(dataAlerts);

      const resMetrics = await fetch(`${API_BASE}/metrics`);
      const dataMetrics = await resMetrics.json();
      if (dataMetrics.kpis) {
        setKpis(dataMetrics.kpis);
      }
    } catch (err) {
      console.error('Error fetching alerts/metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlertsAndKPIs();
  }, []);

  // Live traffic simulator poll
  useEffect(() => {
    if (isLiveActive) {
      intervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE}/simulation/live-traffic`, { method: 'POST' });
          const data = await res.json();
          if (data.transaction) {
            setLiveTxns(prev => [data.transaction, ...prev.slice(0, 15)]);
            // Refresh alert queue if transaction is suspicious
            fetchAlertsAndKPIs();
          }
        } catch (err) {
          // Fallback local mock simulation if server is offline
          const mock = {
            id: `TXN-LOCAL-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            amount: parseFloat((Math.random() * 8000).toFixed(2)),
            rail: ['CARD', 'UPI', 'SWIFT', 'CRYPTO'][Math.floor(Math.random() * 4)],
            timestamp: new Date().toISOString(),
            merchant_name: 'Simulated Online Merchant',
            geo_country: ['US', 'IN', 'RU', 'SG'][Math.floor(Math.random() * 4)]
          };
          setLiveTxns(prev => [mock, ...prev.slice(0, 15)]);
        }
      }, 3000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isLiveActive]);

  const filteredAlerts = alerts.filter(alt => {
    const matchesSearch = alt.description.toLowerCase().includes(search.toLowerCase()) || 
                          alt.id.toLowerCase().includes(search.toLowerCase()) ||
                          alt.entity_id.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterType === 'ALL' || alt.triggered_by === filterType || alt.severity === filterType;
    return matchesSearch && matchesFilter;
  });

  const getSeverityStyle = (severity) => {
    switch (severity) {
      case 'HIGH':
        return 'bg-alert-rust/10 text-alert-rust border border-alert-rust/20';
      case 'MEDIUM':
        return 'bg-evidence-gold/10 text-evidence-gold border border-evidence-gold/20';
      default:
        return 'bg-ledger-blue/10 text-ledger-blue border border-ledger-blue/20';
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'OPEN':
        return 'bg-alert-rust/25 text-alert-rust border border-alert-rust/35';
      case 'UNDER_INVESTIGATION':
        return 'bg-evidence-gold/20 text-evidence-gold border border-evidence-gold/30';
      case 'FILED_SAR':
        return 'bg-ledger-blue/20 text-ledger-blue border border-ledger-blue/30';
      default:
        return 'bg-zinc-850 text-zinc-500 border border-zinc-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        <div className="bg-ink-base hairline-all p-5 rounded-lg flex items-center justify-between">
          <div>
            <span className="text-[10px] font-display font-bold uppercase tracking-wider text-ledger-blue">Total Alerts</span>
            <h3 className="text-3xl font-mono font-black mt-1 text-zinc-100">{kpis.total_alerts}</h3>
          </div>
          <div className="p-3 bg-ledger-blue/10 text-ledger-blue rounded-lg border border-ledger-blue/20">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-ink-base hairline-all p-5 rounded-lg flex items-center justify-between">
          <div>
            <span className="text-[10px] font-display font-bold uppercase tracking-wider text-alert-rust">Critical (HIGH)</span>
            <h3 className="text-3xl font-mono font-black mt-1 text-alert-rust">{kpis.critical_alerts}</h3>
          </div>
          <div className="p-3 bg-alert-rust/10 text-alert-rust rounded-lg border border-alert-rust/20">
            <Flame className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        <div className="bg-ink-base hairline-all p-5 rounded-lg flex items-center justify-between">
          <div>
            <span className="text-[10px] font-display font-bold uppercase tracking-wider text-evidence-gold">Investigated Cases</span>
            <h3 className="text-3xl font-mono font-black mt-1 text-zinc-100">{kpis.investigated_cases}</h3>
          </div>
          <div className="p-3 bg-evidence-gold/10 text-evidence-gold rounded-lg border border-evidence-gold/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-ink-base hairline-all p-5 rounded-lg flex items-center justify-between">
          <div>
            <span className="text-[10px] font-display font-bold uppercase tracking-wider text-ledger-blue">Active Mule Rings</span>
            <h3 className="text-3xl font-mono font-black mt-1 text-zinc-100">{kpis.active_mule_rings}</h3>
          </div>
          <div className="p-3 bg-ledger-blue/15 text-evidence-gold rounded-lg border border-ledger-blue/20">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. Main Content split (Live Stream & Alert List) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Live Stream Ingestion feed */}
        <div className="bg-ink-base hairline-all p-4 rounded-lg flex flex-col h-[580px]">
          <div className="flex items-center justify-between pb-3 hairline-b mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-evidence-gold animate-pulse" />
              <h4 className="text-xs font-display font-bold uppercase tracking-wider text-zinc-100">Live Transaction Feed</h4>
            </div>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setIsLiveActive(!isLiveActive)} 
                className={`p-1 rounded-lg border transition-colors ${
                  isLiveActive 
                  ? 'bg-alert-rust/10 text-alert-rust border-alert-rust/20 hover:bg-alert-rust/20' 
                  : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
                }`}
              >
                {isLiveActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
              <span className="text-[9px] text-ledger-blue font-mono uppercase">
                {isLiveActive ? '5,000 tx/s sim' : 'PAUSED'}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {liveTxns.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-ledger-blue font-mono text-[10px]">
                <Activity className="w-6 h-6 mb-2 opacity-30 animate-pulse" />
                Awaiting ingestion stream...
              </div>
            ) : (
              liveTxns.map((tx) => (
                <div 
                  key={tx.id} 
                  className={`p-2 rounded-lg border transition-all text-[10px] font-mono flex flex-col justify-between ${
                    tx.amount > 5000 
                      ? 'bg-alert-rust/10 border-alert-rust/35 text-alert-rust shadow-[0_0_2px_rgba(184,80,61,0.2)]' 
                      : 'bg-[#131924]/40 border-ledger-blue/10 text-ledger-blue'
                  }`}
                >
                  <div className="flex justify-between font-bold">
                    <span>{tx.id.substr(0, 12)}</span>
                    <span className={tx.amount > 5000 ? 'text-alert-rust' : 'text-zinc-100'}>
                      ${tx.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                  </div>
                  <div className="flex justify-between text-[9px] text-zinc-400 mt-1">
                    <span>{tx.rail} • {tx.merchant_name ? tx.merchant_name.substr(0, 16).toUpperCase() : 'TRANSFER'}</span>
                    <span className="font-semibold text-evidence-gold">{tx.geo_country}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Primary Alerts Queue Table */}
        <div className="bg-ink-base hairline-all rounded-lg overflow-hidden lg:col-span-2 flex flex-col h-[580px]">
          
          {/* Table Toolbar */}
          <div className="p-4 hairline-b flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#131924]/30">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-ledger-blue absolute left-3 top-3" />
              <input 
                type="text" 
                placeholder="Search by Alert ID, target account, or reason..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-ink-base border border-ledger-blue/20 rounded-lg text-xs focus:outline-none focus:border-evidence-gold text-zinc-100 font-sans shadow-sm"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-ledger-blue" />
              <select 
                value={filterType} 
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-ink-base border border-ledger-blue/20 rounded-lg py-1.5 px-3 text-[10px] focus:outline-none focus:border-evidence-gold text-zinc-300 font-sans"
              >
                <option value="ALL">All Triggers</option>
                <option value="HIGH">High Severity</option>
                <option value="MEDIUM">Medium Severity</option>
                <option value="MULE_RING">Mule Rings</option>
                <option value="IMPOSSIBLE_TRAVEL">Impossible Travel</option>
                <option value="AML_STRUCTURING">AML Structuring</option>
                <option value="WATCHLIST_HIT">Watchlist Hit</option>
              </select>

              <button 
                onClick={fetchAlertsAndKPIs} 
                className="p-2 border border-ledger-blue/20 rounded-lg hover:bg-ledger-blue/5 text-ledger-blue hover:text-evidence-gold transition-colors bg-ink-base"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-[10px] font-mono text-ledger-blue">
                <RefreshCw className="w-5 h-5 animate-spin mb-2" />
                Loading alert index...
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[10px] font-mono text-ledger-blue">
                <ShieldCheck className="w-8 h-8 text-evidence-gold/40 mb-2" />
                No alerts found matching search parameters.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#131924] text-ledger-blue font-display tracking-wider uppercase border-b border-ledger-blue/20 text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Alert ID</th>
                    <th className="py-3 px-4">Entity Context</th>
                    <th className="py-3 px-4">Trigger Scenario</th>
                    <th className="py-3 px-4">Severity</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] font-mono text-zinc-300">
                  {filteredAlerts.map(alt => (
                    <tr 
                      key={alt.id} 
                      onClick={() => onSelectAlert(alt.id)}
                      className={`border-b border-ledger-blue/10 hover:bg-ledger-blue/5 cursor-pointer transition-colors ${
                        activeAlertId === alt.id ? 'bg-ledger-blue/10 border-l-2 border-l-evidence-gold' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-bold text-zinc-100">{alt.id}</td>
                      <td className="py-3 px-4">
                        <span className="bg-ledger-blue/10 text-ledger-blue rounded px-1.5 py-0.5 text-[9px] mr-2">
                          {alt.entity_type}
                        </span>
                        {alt.entity_id.substr(0, 16)}
                      </td>
                      <td className="py-3 px-4 font-sans text-zinc-200">
                        {alt.triggered_by.replace('_', ' ').toUpperCase()}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${getSeverityStyle(alt.severity)}`}>
                          {alt.severity}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${getStatusStyle(alt.status)}`}>
                          {alt.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
