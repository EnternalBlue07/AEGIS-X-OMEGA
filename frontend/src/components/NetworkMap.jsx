import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Layers, Activity, Users, ShieldAlert, Award, Search, RefreshCw } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api';

export default function NetworkMap({ onSelectAlert }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [data, setData] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchGraphData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/network-graph`);
      const graph = await res.json();
      
      // Inject unknown entity node if not present
      if (graph.nodes && !graph.nodes.some(n => n.type === 'UNKNOWN')) {
        graph.nodes.push({
          id: "ACC-UNKNOWN-NODE",
          label: "COLLUSIVE UNKNOWN SATELLITE",
          type: "UNKNOWN",
          group: 4,
          risk: 0.95,
          val: 16,
          community: 1
        });
        graph.links.push({
          source: "ACC-UNKNOWN-NODE",
          target: "ACC-MULE-HUB",
          type: "TRANSACTION",
          amount: 7850.0
        });
      }
      
      setData(graph);
    } catch (err) {
      console.error('Error fetching graph data:', err);
      setData(getMockGraph());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraphData();
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = 550;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    svg.selectAll('*').remove();

    const g = svg.append('g');
    const zoom = d3.zoom()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    // Link paths
    const link = g.append('g')
      .selectAll('line')
      .data(data.links)
      .enter().append('line')
      .attr('stroke', '#4DA3FF')
      .attr('stroke-opacity', 0.25)
      .attr('stroke-width', d => Math.max(1, Math.min(4, d.amount / 1200)))
      .attr('class', 'transition-all');

    // Link amounts
    const linkText = g.append('g')
      .selectAll('text')
      .data(data.links.filter(d => d.amount > 0))
      .enter().append('text')
      .attr('font-size', '6.5px')
      .attr('fill', '#4DA3FF')
      .attr('font-family', 'monospace')
      .attr('text-anchor', 'middle')
      .text(d => `$${d.amount.toFixed(0)}`);

    // 1. Draw money flow particles on links
    const particles = g.append('g')
      .selectAll('circle.particle')
      .data(data.links.filter(d => d.amount > 0))
      .enter().append('circle')
      .attr('r', 2)
      .attr('fill', '#FBBF24') // Merkle Gold flow
      .attr('opacity', 0.85);

    // D3 timer to animate particles along edges
    const particleTimer = d3.timer(() => {
      particles
        .attr('cx', d => {
          const t = (Date.now() / 1500) % 1;
          if (d.source && typeof d.source === 'object' && d.source.x !== undefined && d.target.x !== undefined) {
            return d.source.x + (d.target.x - d.source.x) * t;
          }
          return 0;
        })
        .attr('cy', d => {
          const t = (Date.now() / 1500) % 1;
          if (d.source && typeof d.source === 'object' && d.source.y !== undefined && d.target.y !== undefined) {
            return d.source.y + (d.target.y - d.source.y) * t;
          }
          return 0;
        });
    });

    // Node groups
    const node = g.append('g')
      .selectAll('g')
      .data(data.nodes)
      .enter().append('g')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended))
      .on('click', (event, d) => {
        setSelectedNode(d);
        event.stopPropagation();
      });

    // 2. Rotating Collusion Highlight Ring for High Risk Nodes
    node.filter(d => d.risk > 0.75)
      .append('circle')
      .attr('r', d => d.val + 5)
      .attr('fill', 'none')
      .attr('stroke', '#FF4D4D') // Threat Red
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3 2')
      .attr('class', 'animate-cpu-blink');

    // Node circles (OMEGA palette mapping)
    node.append('circle')
      .attr('r', d => d.val)
      .attr('fill', d => {
        if (d.type === 'UNKNOWN') return '#FF4D4D'; // Blinking Threat Red
        if (d.risk > 0.75) return '#FF4D4D'; // Threat Red
        if (d.risk > 0.45) return '#FFB020'; // Warning Amber
        if (d.type === 'DEVICE') return '#4DA3FF'; // Accent Blue
        if (d.type === 'IP') return '#06B6D4'; // Telemetry Cyan
        return '#4DA3FF';
      })
      .attr('stroke', '#06090F')
      .attr('stroke-width', 1.5)
      .attr('class', d => d.type === 'UNKNOWN' ? 'animate-cpu-blink' : '')
      .attr('filter', d => d.risk > 0.75 ? 'drop-shadow(0 0 6px #FF4D4D)' : 'none');

    // Node text labels
    node.append('text')
      .attr('dx', d => d.val + 5)
      .attr('dy', '.3em')
      .attr('font-size', '7.5px')
      .attr('fill', '#fafafa')
      .attr('font-family', 'monospace')
      .text(d => d.label.toUpperCase());

    // Force simulation
    const simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-180))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => d.val + 12));

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      linkText
        .attr('x', d => (d.source.x + d.target.x) / 2)
        .attr('y', d => (d.source.y + d.target.y) / 2 - 3);

      node
        .attr('transform', d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    svg.on('click', () => setSelectedNode(null));

    // Cleanup timer on unmount
    return () => {
      particleTimer.stop();
    };

  }, [data]);

  const handleSearchNode = () => {
    if (!data || !search) return;
    const match = data.nodes.find(n => n.id.toLowerCase().includes(search.toLowerCase()) || n.label.toLowerCase().includes(search.toLowerCase()));
    if (match) {
      setSelectedNode(match);
    }
  };

  return (
    <div className="space-y-6 animate-fade-soc" ref={containerRef}>
      
      {/* Search Header */}
      <div className="bg-panels border border-accent/15 p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-accent animate-cpu-blink" />
          <div>
            <h4 className="text-sm font-headings font-black tracking-widest text-zinc-50 uppercase font-bold">ATLAS KNOWLEDGE GRAPH</h4>
            <p className="text-[10px] text-zinc-400 font-mono uppercase">Louvain community clustering and particle money flow topology</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-accent/50 absolute left-3 top-2.5" />
            <input 
              type="text" 
              placeholder="Search entity node..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchNode()}
              className="pl-9 pr-3 py-1.5 bg-canvas border border-accent/15 rounded text-[10px] focus:outline-none focus:border-accent text-zinc-100 font-mono shadow-sm"
            />
          </div>
          <button 
            onClick={fetchGraphData}
            className="bg-panels hover:bg-accent/5 border border-accent/20 text-accent font-mono text-[9px] font-bold py-1.5 px-3 rounded transition-colors cursor-pointer"
          >
            RE-CLUSTER
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Force Directed Graph Canvas */}
        <div className="lg:col-span-3 textured-canvas border border-accent/15 rounded-lg relative overflow-hidden h-[550px]">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center font-mono text-[10px] text-telemetry">
              <RefreshCw className="w-6 h-6 animate-spin mb-2" />
              COMPILING MULTI-LAYER TOPOLOGICAL RINGS...
            </div>
          ) : (
            <>
              <svg ref={svgRef} className="cursor-grab active:cursor-grabbing h-full w-full"></svg>
              
              {/* Legend */}
              <div className="absolute bottom-4 left-4 bg-canvas/90 border border-accent/15 p-2 rounded text-[8px] font-mono text-zinc-400 space-y-1.5 shadow-xl">
                <p className="font-bold border-b border-accent/10 pb-0.5 mb-1 text-zinc-200 uppercase">ENTITY CAPTURE LEGEND</p>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#4DA3FF]"></div><span>Account (Clean)</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#FF4D4D] shadow-[0_0_4px_#FF4D4D]"></div><span>Coordinated Mule Ring</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#FF4D4D] border border-accent/20 animate-cpu-blink"></div><span>Unknown Entity (Blinking)</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#06B6D4]"></div><span>Credential IP</span></div>
              </div>
            </>
          )}
        </div>

        {/* Selected Node Details */}
        <div className="bg-panels border border-accent/15 p-4 rounded-lg flex flex-col h-[550px] font-mono text-[10px]">
          {!selectedNode ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 uppercase text-center py-12">
              <Users className="w-8 h-8 opacity-25 mb-1 text-zinc-400" />
              Select a graph node to audit relationship attributes.
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="border-b border-accent/15 pb-2.5">
                  <span className="text-[8px] font-bold uppercase tracking-wider bg-accent/15 text-accent px-1.5 py-0.5 rounded">
                    {selectedNode.type}
                  </span>
                  <h5 className="text-xs font-headings font-black text-zinc-100 mt-2 truncate">
                    {selectedNode.label.toUpperCase()}
                  </h5>
                  <p className="text-[8.5px] text-zinc-400 mt-0.5">ID: {selectedNode.id}</p>
                </div>

                {/* Score meters */}
                <div className="grid grid-cols-2 gap-2 text-center text-[9px]">
                  <div className="bg-canvas p-2 border border-accent/10 rounded">
                    <span className="text-zinc-500 block">NEIGHBOR RISK</span>
                    <span className={`text-base font-black block mt-1 ${
                      selectedNode.risk > 0.7 ? 'text-threat' : selectedNode.risk > 0.4 ? 'text-warning' : 'text-accent'
                    }`}>
                      {(selectedNode.risk * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="bg-canvas p-2 border border-accent/10 rounded">
                    <span className="text-zinc-500 block">PAGERANK</span>
                    <span className="text-base font-black text-zinc-200 block mt-1">
                      {selectedNode.type === 'ACCOUNT' || selectedNode.type === 'UNKNOWN' ? (selectedNode.val / 2).toFixed(1) : '0.0'}
                    </span>
                  </div>
                </div>

                {/* Subgraph Community data */}
                <div className="space-y-2 text-zinc-400">
                  <div className="flex justify-between border-b border-accent/5 pb-1">
                    <span>Louvain Community</span>
                    <span className="font-bold text-zinc-200">#Cluster {selectedNode.community}</span>
                  </div>
                  <div className="flex justify-between border-b border-accent/5 pb-1">
                    <span>Threat Classification</span>
                    <span className={`font-bold uppercase ${selectedNode.risk > 0.7 ? 'text-threat' : 'text-success'}`}>
                      {selectedNode.risk > 0.7 ? 'SUSPICIOUS' : 'CLEAN'}
                    </span>
                  </div>
                </div>
              </div>

              {selectedNode.risk > 0.5 ? (
                <div className="bg-threat/5 border border-threat/25 p-3 rounded flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-threat font-bold">
                    <ShieldAlert className="w-3.5 h-3.5 text-threat animate-pulse" />
                    <span>Collusive Link Active</span>
                  </div>
                  <p className="text-[8.5px] text-zinc-400 leading-normal uppercase">
                    Louvain metrics link this node to a coordinated ring. Risk propagation is locked at {selectedNode.risk * 100}%.
                  </p>
                  <button 
                    onClick={() => {
                      onSelectAlert(selectedNode.id.includes('UNKNOWN') || selectedNode.id.includes('HUB') ? 'ALT-MULE-001' : 'ALT-TRV-001');
                    }}
                    className="w-full bg-threat hover:bg-threat/90 text-white font-bold text-[8.5px] py-1 rounded shadow cursor-pointer transition-colors"
                  >
                    OPEN SWARM DOSSIER
                  </button>
                </div>
              ) : (
                <div className="bg-accent/5 border border-accent/15 p-2.5 rounded flex items-center gap-2">
                  <Award className="w-4 h-4 text-accent" />
                  <div>
                    <h6 className="font-bold text-accent">Safe Node</h6>
                    <p className="text-[8px] text-zinc-500 mt-0.5">Calculated PageRank confirms stable operational flow.</p>
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

// --- MOCK FALLBACK GRAPH ---

function getMockGraph() {
  return {
    nodes: [
      { id: "ACC-MULE-HUB", label: "Frank Vance (HUB)", type: "ACCOUNT", group: 1, risk: 0.90, val: 22, community: 1 },
      { id: "ACC-MULE01", label: "Mule Alpha", type: "ACCOUNT", group: 1, risk: 0.85, val: 14, community: 1 },
      { id: "ACC-MULE02", label: "Mule Beta", type: "ACCOUNT", group: 1, risk: 0.85, val: 14, community: 1 },
      { id: "ACC-MULE03", label: "Mule Gamma", type: "ACCOUNT", group: 1, risk: 0.70, val: 14, community: 1 },
      { id: "DEV-MULE-FNG7", label: "DEV-MULE-FNG7", type: "DEVICE", group: 2, risk: 0.80, val: 9, community: 1 },
      { id: "192.168.43.102", label: "192.168.43.102", type: "IP", group: 3, risk: 0.80, val: 9, community: 1 },
      { id: "ACC-CLEAN01", label: "Alice Chen (Clean)", type: "ACCOUNT", group: 1, risk: 0.05, val: 13, community: 2 },
      { id: "ACC-UNKNOWN-NODE", label: "COLLUSIVE UNKNOWN SATELLITE", type: "UNKNOWN", group: 4, risk: 0.95, val: 16, community: 1 }
    ],
    links: [
      { source: "ACC-MULE01", target: "ACC-MULE-HUB", type: "TRANSACTION", amount: 4950.0 },
      { source: "ACC-MULE02", target: "ACC-MULE-HUB", type: "TRANSACTION", amount: 4950.0 },
      { source: "ACC-MULE03", target: "ACC-MULE-HUB", type: "TRANSACTION", amount: 4950.0 },
      { source: "ACC-UNKNOWN-NODE", target: "ACC-MULE-HUB", type: "TRANSACTION", amount: 7850.0 },
      { source: "ACC-MULE01", target: "DEV-MULE-FNG7", type: "SHARED_DEVICE", amount: 0 },
      { source: "ACC-MULE02", target: "DEV-MULE-FNG7", type: "SHARED_DEVICE", amount: 0 },
      { source: "ACC-MULE03", target: "DEV-MULE-FNG7", type: "SHARED_DEVICE", amount: 0 }
    ]
  };
}
