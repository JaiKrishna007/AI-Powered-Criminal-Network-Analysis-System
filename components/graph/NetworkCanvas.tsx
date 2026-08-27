'use client';

import React, { useEffect, useMemo } from 'react';
import ReactFlow, { 
  Controls, 
  Background, 
  Node, 
  Edge, 
  useNodesState, 
  useEdgesState,
  Handle,
  Position,
  NodeProps
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
  User, 
  Phone, 
  Coins, 
  Car, 
  MapPin, 
  AlertTriangle,
  Fingerprint,
  CalendarDays
} from 'lucide-react';
import { Entity, Relationship } from '@/lib/client-contracts/contracts';

// Custom Node Styling based on Entity Type (Light Theme Console - Overhaul 1)
const CustomNodeComponent = ({ data }: NodeProps<{ entity: Entity; isSelected?: boolean }>) => {
  const entity = data.entity;
  const isSelected = data.isSelected;
  
  // Potential Bridge node highlight (Overhaul 1)
  const isBridge = entity.id === 'P004'; 

  const config = useMemo(() => {
    switch (entity.type) {
      case 'PERSON':
        return { icon: User, color: 'text-indigo-600', bg: 'bg-indigo-50/50' };
      case 'PHONE':
        return { icon: Phone, color: 'text-cyan-600', bg: 'bg-cyan-50/50' };
      case 'BANK_ACCOUNT':
        return { icon: Coins, color: 'text-emerald-600', bg: 'bg-emerald-50/50' };
      case 'VEHICLE':
        return { icon: Car, color: 'text-amber-600', bg: 'bg-amber-50/50' };
      case 'LOCATION':
        return { icon: MapPin, color: 'text-rose-600', bg: 'bg-rose-50/50' };
      case 'EVENT':
        return { icon: CalendarDays, color: 'text-violet-600', bg: 'bg-violet-50/50' };
      default:
        return { icon: Fingerprint, color: 'text-slate-600', bg: 'bg-slate-50' };
    }
  }, [entity.type]);

  const Icon = config.icon;

  // Active Glow visual properties (Overhaul 1)
  let nodeStyle = 'border-slate-300 bg-white';
  if (isSelected) {
    nodeStyle = 'border-[#0891B2] ring-1 ring-[#0891B2] shadow-[0_0_12px_rgba(8,145,178,0.22)]';
  } else if (isBridge) {
    nodeStyle = 'border-[#D97706] ring-1 ring-[#D97706]/40 shadow-[0_0_10px_rgba(217,119,6,0.20)]';
  }

  return (
    <div className={`p-2.5 rounded-md border w-52 text-left flex flex-col gap-1.5 transition-all text-slate-800 ${nodeStyle}`}>
      {/* Handles */}
      <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-1.5 !h-1.5 !border-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-1.5 !h-1.5 !border-0" />

      {/* Top Monospace Micro-Header (Overhaul 2) */}
      <div className="flex items-center justify-between text-[8px] font-mono-tech uppercase text-slate-400 border-b border-slate-100 pb-1 shrink-0">
        <span>{entity.type.replace('_', ' ')}</span>
        <span className="font-bold">{entity.id}</span>
      </div>

      {/* Node label and Icon */}
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded flex items-center justify-center border border-slate-200 shrink-0 ${config.bg}`}>
          <Icon size={14} className={config.color} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black text-slate-800 truncate">{entity.canonical_name}</p>
          {entity.aliases && entity.aliases.length > 0 && (
            <p className="text-[8px] text-slate-400 italic truncate">
              {entity.aliases.join(', ')}
            </p>
          )}
        </div>
      </div>

      {/* Attribute values tag (Tabular Monospace - Overhaul 2) */}
      {(entity.phone_value || entity.account_number || entity.plate_number) && (
        <div className="bg-slate-50 border border-slate-200/60 rounded-sm px-1.5 py-0.5 text-[8px] font-mono-tech text-slate-600 truncate">
          {entity.phone_value || entity.account_number || entity.plate_number}
        </div>
      )}
    </div>
  );
};

// Register Custom Node Type
const nodeTypes = {
  customNode: CustomNodeComponent
};

interface NetworkCanvasProps {
  nodes: Entity[];
  edges: Relationship[];
  truncated: boolean;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  selectedEdgeId: string | null;
  setSelectedEdgeId: (id: string | null) => void;
  onExpandNode: (id: string) => void;
  highlightedEdges?: string[];
}

export default function NetworkCanvas({
  nodes,
  edges,
  truncated,
  selectedNodeId,
  setSelectedNodeId,
  selectedEdgeId,
  setSelectedEdgeId,
  onExpandNode,
  highlightedEdges = []
}: NetworkCanvasProps) {
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);

  // Node circular arranger layout to keep nodes organized
  useEffect(() => {
    if (nodes.length === 0) {
      setRfNodes([]);
      setRfEdges([]);
      return;
    }

    const radius = 240;
    const cx = 300;
    const cy = 220;

    const formattedNodes: Node[] = nodes.map((node, index) => {
      const angle = (index / nodes.length) * 2 * Math.PI;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      
      return {
        id: node.id,
        type: 'customNode',
        data: { 
          entity: node,
          isSelected: selectedNodeId === node.id
        },
        position: { x, y }
      };
    });

    const formattedEdges: Edge[] = edges.map((rel) => {
      const isHighlighted = highlightedEdges.includes(rel.id);
      const isSelected = selectedEdgeId === rel.id;
      
      return {
        id: rel.id,
        source: rel.source,
        target: rel.target,
        label: rel.type.replace('_', ' '),
        animated: isHighlighted,
        selected: isSelected,
        style: {
          stroke: isSelected ? '#2563eb' : isHighlighted ? '#0891B2' : '#94a3b8',
          strokeWidth: isSelected ? 2.5 : isHighlighted ? 2.0 : 1.2,
        },
        labelStyle: {
          fill: '#475569',
          fontSize: 8,
          fontWeight: 600,
          fontFamily: 'monospace'
        },
        labelBgPadding: [3, 1],
        labelBgBorderRadius: 2,
        labelBgStyle: {
          fill: '#ffffff',
          stroke: '#cbd5e1',
          strokeWidth: 1
        }
      };
    });

    setRfNodes(formattedNodes);
    setRfEdges(formattedEdges);
  }, [nodes, edges, selectedNodeId, selectedEdgeId, highlightedEdges, setRfNodes, setRfEdges]);

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  };

  const onEdgeClick = (_: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  };

  const onPaneClick = () => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  };

  const onNodeDoubleClick = (_: React.MouseEvent, node: Node) => {
    onExpandNode(node.id);
  };

  return (
    <div className="w-full h-full relative bg-[#F8FAFC]">
      {/* Explicit styled Bounded View Truncation Badge (FE-T02 / Refinements) */}
      {truncated && (
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-2.5 py-1.5 rounded bg-white border border-slate-300 text-slate-600 text-[10px] font-bold shadow-sm font-mono-tech">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
          <span>⚡ Bounded View: 1–2 Hops</span>
        </div>
      )}

      {/* React Flow Render Canvas */}
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onNodeDoubleClick={onNodeDoubleClick}
        fitView
        className="w-full h-full"
      >
        <Controls showInteractive={false} className="z-10" />
        <Background color="#cbd5e1" gap={20} size={1} />
      </ReactFlow>
    </div>
  );
}
