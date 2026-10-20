import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Activity, ShieldCheck, HelpCircle, RefreshCw, AlertTriangle } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api';

export default function Monitor() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/metrics`);
      const data = await res.json();
      setMetrics(data);
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setMetrics(getMockMetrics());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="bg-canvas border border-accent/15 p-6 rounded-lg flex items-center justify-center h-[500px] font-mono text-telemetry">
        <RefreshCw className="w-5 h-5 animate-spin mr-2.5 text-accent" />
        FETCHING QUANTUM METRIC ARRAYS...
      </div>
    );
  }

  const { p95_latency_ms, p99_latency_ms, psi_drift_score, champion_auc, challenger_auc, latency_history_ms, drift_history } = metrics.model_performance;

  const qr = metrics.quantum_readiness || {
    rsa_2048_risk: "CRITICAL",
    ecc_256_risk: "HIGH",
    pqc_kyber_mitigation: "OPTIMAL (98% deployed)",
    shors_horizon_years: {
      "2030": 15,
      "2040": 65,
      "2050": 95
    }
  };

  // Latency Chart - Accent Blue (#4DA3FF)
  const latencyChartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0D1320',
      borderColor: 'rgba(77, 163, 255, 0.2)',
      textStyle: { color: '#EDE9DF', fontSize: 10, fontFamily: 'monospace' }
    },
    grid: { left: '4%', right: '4%', bottom: '8%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ['1h ago', '45m ago', '30m ago', '20m ago', '15m ago', '10m ago', '5m ago', 'Now'],
      axisLabel: { color: '#4DA3FF', fontSize: 9, fontFamily: 'monospace' },
      axisLine: { lineStyle: { color: 'rgba(77, 163, 255, 0.2)' } }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#4DA3FF', fontSize: 9, fontFamily: 'monospace', formatter: '{value} ms' },
      splitLine: { lineStyle: { color: 'rgba(77, 163, 255, 0.05)' } }
    },
    series: [
      {
        name: 'p95 Latency',
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: '#4DA3FF' },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(77, 163, 255, 0.25)' },
              { offset: 1, color: 'rgba(77, 163, 255, 0)' }
            ]
          }
        },
        data: latency_history_ms
      }
    ]
  };

  // PSI Drift Chart - Warning Gold (#FFB020) & Threat Red (#FF4D4D)
  const driftChartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0D1320',
      borderColor: 'rgba(255, 176, 32, 0.2)',
      textStyle: { color: '#EDE9DF', fontSize: 10, fontFamily: 'monospace' }
    },
    grid: { left: '4%', right: '4%', bottom: '8%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7', 'Day 8'],
      axisLabel: { color: '#FFB020', fontSize: 9, fontFamily: 'monospace' },
      axisLine: { lineStyle: { color: 'rgba(255, 176, 32, 0.2)' } }
    },
    yAxis: {
      type: 'value',
      max: 0.2,
      axisLabel: { color: '#FFB020', fontSize: 9, fontFamily: 'monospace' },
      splitLine: { lineStyle: { color: 'rgba(255, 176, 32, 0.05)' } }
    },
    series: [
      {
        name: 'PSI Score',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: '#FFB020' },
        itemStyle: { color: '#FFB020' },
        markLine: {
          silent: true,
          lineStyle: { color: '#FF4D4D', type: 'dashed' },
          data: [{ yAxis: 0.1, name: 'Drift Threshold' }]
        },
        data: drift_history
      }
    ]
  };

  // Shor's Horizon Chart - Quantum Violet (#A855F7)
  const shorsChartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0D1320',
      borderColor: 'rgba(168, 85, 247, 0.2)',
      textStyle: { color: '#EDE9DF', fontSize: 10, fontFamily: 'monospace' }
    },
    grid: { left: '4%', right: '4%', bottom: '8%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: true,
      data: ['2030 Horizon', '2040 Horizon', '2050 Horizon'],
      axisLabel: { color: '#A855F7', fontSize: 9, fontFamily: 'monospace' },
      axisLine: { lineStyle: { color: 'rgba(168, 85, 247, 0.2)' } }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { color: '#A855F7', fontSize: 9, fontFamily: 'monospace', formatter: '{value}%' },
      splitLine: { lineStyle: { color: 'rgba(168, 85, 247, 0.05)' } }
    },
    series: [
      {
        name: 'Decryption Capability Estimate',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { width: 3, color: '#A855F7' },
        itemStyle: { color: '#A855F7', borderColor: '#A855F7', borderWidth: 2 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(168, 85, 247, 0.35)' },
              { offset: 1, color: 'rgba(168, 85, 247, 0)' }
            ]
          }
        },
        data: [
          qr.shors_horizon_years["2030"] || 15,
          qr.shors_horizon_years["2040"] || 65,
          qr.shors_horizon_years["2050"] || 95
        ]
      }
    ]
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-panels border border-accent/15 p-4 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Activity className="w-5 h-5 text-accent animate-cpu-blink" />
          <div>
            <h4 className="text-sm font-headings font-black tracking-widest text-zinc-50 uppercase">QUANTUM TELEMETRY DECK</h4>
            <p className="text-[10px] text-zinc-400 font-mono uppercase">Scoring latency indices and post-quantum cryptographic readiness health</p>
          </div>
        </div>
        <button 
          onClick={fetchMetrics}
          className="flex items-center gap-2 px-3 py-1.5 border border-accent/25 rounded hover:bg-accent/5 text-accent font-mono text-[9px] font-bold cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          REFRESH ARRAY
        </button>
      </div>

      {/* Primary Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono text-[10px]">
        <div className="bg-panels border border-accent/15 p-4 rounded-lg">
          <span className="text-zinc-500 uppercase block">p95 Ingestion Latency</span>
          <h3 className="text-2xl font-black mt-1 text-zinc-100">{p95_latency_ms} ms</h3>
          <p className="text-[8px] text-success mt-1 uppercase font-bold">Target benchmark &lt; 200 ms</p>
        </div>

        <div className="bg-panels border border-accent/15 p-4 rounded-lg">
          <span className="text-zinc-500 uppercase block">Population Drift (PSI)</span>
          <h3 className={`text-2xl font-black mt-1 ${
            psi_drift_score > 0.1 ? 'text-threat animate-pulse' : 'text-zinc-100'
          }`}>{psi_drift_score}</h3>
          <p className="text-[8px] text-zinc-400 mt-1 uppercase font-bold">Warning limit: 0.10</p>
        </div>

        <div className="bg-panels border border-accent/15 p-4 rounded-lg">
          <span className="text-zinc-500 uppercase block">Champion ROC-AUC</span>
          <h3 className="text-2xl font-black mt-1 text-zinc-100">{champion_auc}</h3>
          <p className="text-[8px] text-zinc-500 mt-1 uppercase">XGBoost Production Node</p>
        </div>

        <div className="bg-panels border border-accent/15 p-4 rounded-lg">
          <span className="text-zinc-500 uppercase block">Challenger ROC-AUC</span>
          <h3 className="text-2xl font-black mt-1 text-zinc-100">{challenger_auc}</h3>
          <p className="text-[8px] text-zinc-500 mt-1 uppercase">LightGBM A/B Test Node</p>
        </div>
      </div>

      {/* Charts split */}
      <div className="space-y-6">
        
        {/* Latency History */}
        <div className="bg-panels border border-accent/15 p-4 rounded-lg">
          <h5 className="text-[10px] font-headings font-black tracking-wider text-zinc-50 pb-2 border-b border-accent/15 mb-4 uppercase">
            Ingestion Scoring Latency History (p95 area curve)
          </h5>
          <div className="h-44">
            <ReactECharts option={latencyChartOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

        {/* Feature Drift (PSI) */}
        <div className="bg-panels border border-accent/15 p-4 rounded-lg">
          <h5 className="text-[10px] font-headings font-black tracking-wider text-zinc-50 pb-2 border-b border-accent/15 mb-4 uppercase">
            Population Stability Index (PSI) drift line
          </h5>
          <div className="h-44">
            <ReactECharts option={driftChartOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

        {/* Quantum Cryptography Health Monitor */}
        <div className="bg-panels border border-accent/15 p-4 rounded-lg font-mono text-[9px] space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-accent/15 mb-2">
            <ShieldCheck className="w-4 h-4 text-quantum" />
            <h5 className="text-[10px] font-headings font-black tracking-wider text-zinc-50 uppercase">
              POST-QUANTUM CRYPTOGRAPHY HEALTH & CIPHER HEALTH
            </h5>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Cryptographic Vulnerability Assessment */}
            <div className="space-y-3">
              <span className="text-telemetry font-bold uppercase block">
                Cryptographic Vulnerability Matrix
              </span>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[9px] border-collapse">
                  <thead>
                    <tr className="border-b border-accent/15 text-zinc-400 uppercase tracking-wider">
                      <th className="py-2 pb-1 font-bold">Cipher System</th>
                      <th className="py-2 pb-1 font-bold">Threat Status</th>
                      <th className="py-2 pb-1 font-bold">NIST PQC Migration Target</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-accent/10 text-zinc-200">
                    <tr>
                      <td className="py-2.5 font-bold">RSA-2048</td>
                      <td className="py-2.5">
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-threat/10 border border-threat/20 text-threat animate-cpu-blink uppercase">
                          {qr.rsa_2048_risk}
                        </span>
                      </td>
                      <td className="py-2.5 text-zinc-500">DEPRECATION ORDER: 2028</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-bold">ECDSA / ECC-256</td>
                      <td className="py-2.5">
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-warning/10 border border-warning/20 text-warning uppercase">
                          {qr.ecc_256_risk}
                        </span>
                      </td>
                      <td className="py-2.5 text-zinc-500">MIGRATING TO ML-DSA</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-bold text-quantum">PQC-Kyber-1024 / ML-KEM</td>
                      <td className="py-2.5">
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-success/10 border border-success/20 text-success uppercase">
                          SECURE
                        </span>
                      </td>
                      <td className="py-2.5 text-quantum font-bold">{qr.pqc_kyber_mitigation}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div className="p-2.5 border border-quantum/20 rounded bg-quantum/5 text-zinc-400 leading-normal uppercase">
                <span className="text-quantum font-bold">PQC Mitigation Order:</span> Active network adapters have upgraded public-key exchange pipelines to NIST post-quantum standard ML-KEM. Kyber-1024 encryption layer is fully active across SWIFT wire nodes.
              </div>
            </div>

            {/* Shor's Algorithm Horizon Chart */}
            <div className="space-y-3">
              <div>
                <span className="text-quantum font-bold uppercase block">
                  Shor's Index Decryption Threat Horizon
                </span>
                <p className="text-zinc-500 font-sans mt-0.5 leading-normal">
                  Estimated probability of cryptographic cipher decay under Shor's factorization projections.
                </p>
              </div>
              
              <div className="h-40">
                <ReactECharts option={shorsChartOption} style={{ height: '100%', width: '100%' }} />
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

// --- MOCK MONITOR DATA ---

function getMockMetrics() {
  return {
    model_performance: {
      p95_latency_ms: 118,
      p99_latency_ms: 240,
      psi_drift_score: 0.08,
      champion_auc: 0.942,
      challenger_auc: 0.928,
      latency_history_ms: [105, 120, 112, 134, 118, 122, 109, 118],
      drift_history: [0.04, 0.05, 0.05, 0.07, 0.06, 0.08, 0.08, 0.08]
    },
    quantum_readiness: {
      rsa_2048_risk: "CRITICAL",
      ecc_256_risk: "HIGH",
      pqc_kyber_mitigation: "OPTIMAL (98% deployed)",
      shors_horizon_years: {
        "2030": 15,
        "2040": 65,
        "2050": 95
      }
    }
  };
}
