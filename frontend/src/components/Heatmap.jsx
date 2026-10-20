import React, { useState, useEffect } from 'react';
import { Compass, TrendingUp, TrendingDown, ArrowRight, ShieldAlert, CheckCircle, RefreshCw } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api';

export default function Heatmap() {
  const [predictions, setPredictions] = useState([]);
  const [selectedCell, setSelectedCell] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchPredictions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/predictions`);
      const data = await res.json();
      setPredictions(data);
    } catch (err) {
      console.error('Error fetching predictions:', err);
      // Fallback mock predictions
      setPredictions(getMockPredictions());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPredictions();
  }, []);

  const regions = ["North America", "Southeast Asia", "Eastern Europe", "Western Europe", "Latin America"];
  const rails = ["CARD", "TRANSFER", "UPI", "SWIFT", "CRYPTO"];

  const getCellData = (region, rail) => {
    return predictions.find(p => p.region === region && p.rail === rail) || {
      predicted_risk: 0.1,
      confidence_lower: 0.05,
      confidence_upper: 0.2,
      pattern_trend: "STABLE",
      contributing_factors: ["Normal activity levels."]
    };
  };

  const getCellColor = (risk) => {
    // Return background colors based on risk probability (0.0 to 1.0)
    if (risk >= 0.8) return 'bg-rose-500/80 text-white font-bold hover:bg-rose-500';
    if (risk >= 0.6) return 'bg-rose-500/40 text-rose-100 hover:bg-rose-500/50';
    if (risk >= 0.4) return 'bg-amber-500/30 text-amber-100 hover:bg-amber-500/40';
    if (risk >= 0.2) return 'bg-blue-500/10 text-blue-300 hover:bg-blue-500/20';
    return 'bg-zinc-100 dark:bg-zinc-900/40 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-800/40';
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-ink-base hairline-all p-4 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-evidence-gold" />
          <div>
            <h4 className="text-sm font-display font-bold uppercase tracking-wider text-zinc-100">Future Threat Heatmap</h4>
            <p className="text-[10px] text-ledger-blue font-mono">14-30 day risk forecasts compiled by Layer 6 Temporal Fusion Transformer (TFT) sequence models</p>
          </div>
        </div>
        <button 
          onClick={fetchPredictions}
          className="bg-ink-base border border-ledger-blue/20 text-ledger-blue hover:text-evidence-gold font-display font-bold text-xs py-1.5 px-3 rounded transition-colors"
        >
          Recalculate Heatmap
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Heatmap Grid (cols 3) */}
        <div className="lg:col-span-3 bg-ink-base hairline-all rounded-lg p-5 overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center font-mono text-[10px] text-ledger-blue">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              Re-projecting future rail vectors...
            </div>
          ) : (
            <div className="min-w-[650px] space-y-4">
              {/* Rails Column headers */}
              <div className="grid grid-cols-6 gap-2 text-center text-[10px] font-semibold text-ledger-blue uppercase tracking-wider font-mono">
                <div></div>
                {rails.map(rl => <div key={rl} className="pb-2 border-b border-ledger-blue/25">{rl}</div>)}
              </div>

              {/* Rows */}
              <div className="space-y-2.5">
                {regions.map(rg => (
                  <div key={rg} className="grid grid-cols-6 gap-2 items-center">
                    <div className="text-xs font-bold text-ledger-blue font-mono pr-2 truncate uppercase">{rg}</div>
                    
                    {rails.map(rl => {
                      const cell = getCellData(rg, rl);
                      const isSelected = selectedCell && selectedCell.region === rg && selectedCell.rail === rl;
                      return (
                        <div 
                          key={rl}
                          onClick={() => setSelectedCell({ region: rg, rail: rl, ...cell })}
                          className={`h-16 rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-all duration-150 border-ledger-blue/20 font-mono text-xs ${getCellColor(cell.predicted_risk)} ${
                            isSelected ? 'ring-2 ring-evidence-gold scale-102 border-transparent' : ''
                          }`}
                        >
                          <span className="text-sm font-black">{(cell.predicted_risk * 100).toFixed(0)}%</span>
                          <span className="text-[7px] uppercase opacity-75 mt-0.5">Threat</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Selected Forecast Details side panel (col 1) */}
        <div className="bg-ink-base hairline-all p-4 rounded-lg flex flex-col justify-between h-[400px]">
          {!selectedCell ? (
            <div className="flex-1 flex flex-col items-center justify-center font-mono text-[10px] text-ledger-blue text-center">
              <Compass className="w-6 h-6 opacity-30 mb-2 animate-spin" style={{ animationDuration: '6s' }} />
              Select a heatmap cell to project temporal risk curves and contributors.
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="hairline-b pb-2.5">
                  <span className="text-[8px] font-mono text-ledger-blue">14-DAY ATTACK HORIZON</span>
                  <h5 className="text-xs font-display font-bold text-zinc-50 uppercase mt-1">
                    {selectedCell.region} • {selectedCell.rail}
                  </h5>
                </div>

                {/* Risk Range & Confidence */}
                <div className="bg-[#131924]/40 border border-ledger-blue/20 p-3 rounded-lg font-mono text-[10px] space-y-1.5">
                  <div className="flex justify-between">
                    <span>Forecast Risk</span>
                    <span className="font-extrabold text-zinc-100">{(selectedCell.predicted_risk * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Confidence Interval</span>
                    <span className="text-ledger-blue">
                      [{(selectedCell.confidence_lower * 100).toFixed(0)}% - {(selectedCell.confidence_upper * 100).toFixed(0)}%]
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-ledger-blue/10">
                    <span>Trend Slope</span>
                    <span className="flex items-center gap-1">
                      {selectedCell.pattern_trend === "UPWARD" ? (
                        <>
                          <TrendingUp className="w-3.5 h-3.5 text-alert-rust" />
                          <span className="text-alert-rust font-extrabold">UPWARD</span>
                        </>
                      ) : selectedCell.pattern_trend === "DOWNWARD" ? (
                        <>
                          <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-500 font-extrabold">DOWNWARD</span>
                        </>
                      ) : (
                        <span className="text-ledger-blue font-extrabold">STABLE</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Factors List */}
                <div className="space-y-1.5">
                  <span className="text-[9px] font-mono text-ledger-blue block">TFT ATTRIBUTION FACTORS</span>
                  <div className="space-y-1 text-[9px] text-zinc-300 font-mono leading-relaxed max-h-[150px] overflow-y-auto pr-1">
                    {selectedCell.contributing_factors.map((fact, idx) => (
                      <p key={idx} className="bg-ink-base border border-ledger-blue/20 p-1.5 rounded">
                        • {fact}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              {selectedCell.predicted_risk > 0.60 ? (
                <div className="bg-alert-rust/5 border border-alert-rust/15 p-2.5 rounded-lg flex gap-2 items-center">
                  <ShieldAlert className="w-4 h-4 text-alert-rust shrink-0" />
                  <div>
                    <h6 className="text-[10px] font-bold text-alert-rust">Pre-Emptive Escalation Recommended</h6>
                    <p className="text-[8px] text-ledger-blue mt-0.5 leading-normal">
                      Adjust velocity scoring filters on this rail to capture synthetic application waves.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-ledger-blue/5 border border-ledger-blue/10 p-2.5 rounded-lg flex gap-2 items-center">
                  <CheckCircle className="w-4 h-4 text-ledger-blue shrink-0" />
                  <div>
                    <h6 className="text-[10px] font-bold text-ledger-blue font-display">Normal Security Profile</h6>
                    <p className="text-[8px] text-zinc-400 mt-0.5 leading-normal">
                      Baseline limits are sufficient. No anomaly spike projected.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}

// --- MOCK PREDICTIONS SEED ---

function getMockPredictions() {
  const regions = ["North America", "Southeast Asia", "Eastern Europe", "Western Europe", "Latin America"];
  const rails = ["CARD", "TRANSFER", "UPI", "SWIFT", "CRYPTO"];
  const list = [];
  
  regions.forEach(rg => {
    rails.forEach(rl => {
      let risk = Math.random() * 0.9;
      // Force some structured high risks
      if (rg === "Eastern Europe" && rl === "SWIFT") risk = 0.88;
      if (rg === "Southeast Asia" && rl === "UPI") risk = 0.75;
      if (rl === "CRYPTO") risk = Math.max(risk, 0.45);

      list.push({
        region: rg,
        rail: rl,
        predicted_risk: risk,
        confidence_lower: Math.max(0, risk - 0.2),
        confidence_upper: Math.min(1.0, risk + 0.15),
        pattern_trend: risk > 0.7 ? "UPWARD" : risk < 0.2 ? "DOWNWARD" : "STABLE",
        contributing_factors: [
          "Recent localized network clusters showing high device transfer velocity.",
          "Growth in cross-border credit mismatch from anomalous subnets.",
          "Elevated KYC failures at rail onboarding gates."
        ]
      });
    });
  });
  return list;
}
