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
  NodeProps,
  useReactFlow,
  ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
  User, 
  Building, 
  MapPin, 
  Car, 
  Coins, 
  Fingerprint,
  ZoomIn,
  ZoomOut,
  Maximize2,
  MousePointer,
  Hand,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { Entity, Relationship } from '@/lib/client-contracts/contracts';

// Node configurations matching exact user specs (Overhaul 1)
const typeConfigs: Record<string, { icon: any; color: string; border: string; bg: string; badge: string }> = {
  PERSON: { icon: User, color: 'text-[#2563EB]', border: 'border-[#2563EB]', bg: 'bg-[#2563EB]/10', badge: 'bg-[#DBEAFE]' },
  ORGANIZATION: { icon: Building, color: 'text-[#7C3AED]', border: 'border-[#7C3AED]', bg: 'bg-[#7C3AED]/10', badge: 'bg-[#F3E8FF]' },
  LOCATION: { icon: MapPin, color: 'text-[#0D9488]', border: 'border-[#0D9488]', bg: 'bg-[#0D9488]/10', badge: 'bg-[#CCFBF1]' },
  VEHICLE: { icon: Car, color: 'text-[#D97706]', border: 'border-[#D97706]', bg: 'bg-[#D97706]/10', badge: 'bg-[#FEF3C7]' },
  BANK_ACCOUNT: { icon: Coins, color: 'text-[#CA8A04]', border: 'border-[#CA8A04]', bg: 'bg-[#CA8A04]/10', badge: 'bg-[#FEF9C3]' },
  EVENT: { icon: Fingerprint, color: 'text-[#64748B]', border: 'border-[#64748B]', bg: 'bg-[#64748B]/10', badge: 'bg-[#F1F5F9]' }
};

const CustomCircleNode = ({ data }: NodeProps<{ entity: Entity; isSelected?: boolean }>) => {
  const entity = data.entity;
  const isSelected = data.isSelected;
  
  // Potential Bridge node highlight (Overhaul 2 - Bridge Callout)
  const isBridge = entity.id === 'P004'; 

  const config = typeConfigs[entity.type] || typeConfigs.EVENT;
  const Icon = config.icon;

  let highlightStyle = config.border;
  if (isSelected) {
    // Selected node: ring-1 ring-[#0891B2] (Cyan Glow)
    highlightStyle = 'border-[#0891B2] ring-2 ring-[#0891B2] shadow-[0_0_12px_rgba(8,145,178,0.3)]';
  } else if (isBridge) {
    // Bridge Node: Glowing double-ring outline (Amber/Blue)
    highlightStyle = 'border-[#F59E0B] ring-4 ring-[#F59E0B]/30 animate-pulse';
  }

  return (
    <div className="relative flex flex-col items-center">
      {/* Handles */}
      <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-1.5 !h-1.5 !border-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-1.5 !h-1.5 !border-0" />

      {/* Bridge Callout Tag */}
      {isBridge && (
        <div className="absolute -top-7 z-10 px-2 py-0.5 rounded-sm bg-[#FFFBEB] border border-[#F59E0B] text-[#B45309] text-[7px] font-bold uppercase tracking-wider font-mono-tech shadow-sm">
          POTENTIAL BRIDGE ENTITY
        </div>
      )}

      {/* Circular node badge */}
      <div 
        className={`w-16 h-16 rounded-full border-2 flex flex-col items-center justify-center p-1.5 text-center transition-all duration-200 select-none shadow-sm hover:scale-105 ${config.bg} ${highlightStyle}`}
      >
        <Icon size={16} className={config.color} />
        <span className="text-[7.5px] font-mono-tech font-bold text-slate-700 mt-0.5 truncate max-w-[55px]">
          {entity.id}
        </span>
      </div>

      {/* Centered Primary Label below Node */}
      <div className="mt-1 max-w-[90px] text-center">
        <p className="text-[9px] font-bold text-slate-800 truncate leading-tight">
          {entity.canonical_name}
        </p>
      </div>
    </div>
  );
};

const nodeTypes = {
  circleNode: CustomCircleNode
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

function InnerFlowCanvas({
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
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  useEffect(() => {
    if (nodes.length === 0) {
      setRfNodes([]);
      setRfEdges([]);
      return;
    }

    const radius = 180;
    const cx = 250;
    const cy = 200;

    const formattedNodes: Node[] = nodes.map((node, index) => {
      const angle = (index / nodes.length) * 2 * Math.PI;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      
      return {
        id: node.id,
        type: 'circleNode',
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
      
      // Line style indicating confidence (Overhaul 2 - line styles)
      // Solid = High (>=0.9), Dashed = Medium (0.75-0.9), Dotted = Low (<0.75)
      const conf = rel.confidence ?? 1.0;
      let strokeDasharray = undefined;
      let confidenceType = 'High';
      if (conf < 0.75) {
        strokeDasharray = '2,2'; // Dotted
        confidenceType = 'Low';
      } else if (conf < 0.9) {
        strokeDasharray = '5,5'; // Dashed
        confidenceType = 'Medium';
      }

      return {
        id: rel.id,
        source: rel.source,
        target: rel.target,
        label: rel.type.replace('_', ' '),
        animated: isHighlighted,
        selected: isSelected,
        style: {
          stroke: isSelected ? '#2563eb' : isHighlighted ? '#0D9488' : '#94a3b8',
          strokeWidth: isSelected ? 2.5 : isHighlighted ? 2.0 : 1.2,
          strokeDasharray
        },
        labelStyle: {
          fill: '#475569',
          fontSize: 7,
          fontWeight: 650,
          fontFamily: 'monospace'
        },
        labelBgPadding: [2, 1],
        labelBgBorderRadius: 2,
        labelBgStyle: {
          fill: '#ffffff',
          stroke: '#cbd5e1',
          strokeWidth: 0.8
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
    <div className="w-full h-full relative bg-white">
      {/* Floating top-left canvas toolbar (Overhaul 2) */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg shadow-sm">
        <button 
          onClick={() => {}} 
          className="p-1.5 rounded hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition" 
          title="Select Mode"
        >
          <MousePointer size={13} />
        </button>
        <button 
          onClick={() => {}} 
          className="p-1.5 rounded hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition" 
          title="Pan Mode"
        >
          <Hand size={13} />
        </button>
        <div className="w-[1px] h-4 bg-slate-200 mx-0.5"></div>
        <button 
          onClick={() => zoomIn()} 
          className="p-1.5 rounded hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition" 
          title="Zoom In"
        >
          <ZoomIn size={13} />
        </button>
        <button 
          onClick={() => zoomOut()} 
          className="p-1.5 rounded hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition" 
          title="Zoom Out"
        >
          <ZoomOut size={13} />
        </button>
        <button 
          onClick={() => fitView({ padding: 0.2 })} 
          className="p-1.5 rounded hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition" 
          title="Fit Screen"
        >
          <Maximize2 size={13} />
        </button>
      </div>

      {/* Bounded View Warning */}
      {truncated && (
        <div className="absolute top-4 right-16 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#FFFBEB] border border-[#F59E0B] text-[#B45309] text-[9px] font-bold shadow-sm font-mono-tech">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
          <span>⚡ Bounded: 1–2 Hops</span>
        </div>
      )}

      {/* Legend docked bottom-right (Overhaul 2) */}
      <div className="absolute bottom-4 right-4 z-10 p-3 bg-white border border-slate-200 rounded-lg shadow-sm text-[8.5px] text-slate-600 flex flex-col gap-1.5 max-w-[150px]">
        <h4 className="font-bold border-b border-slate-100 pb-1 text-slate-700 uppercase font-mono-tech">Legend</h4>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#2563EB]"></span>Person</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#7C3AED]"></span>Org</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#0D9488]"></span>Location</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#D97706]"></span>Vehicle</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#CA8A04]"></span>Account</span>
        </div>
        <div className="border-t border-slate-100 pt-1 flex flex-col gap-0.5 font-mono-tech text-[7px] text-slate-400">
          <div>─ Solid: High Conf</div>
          <div>╌ Dashed: Med Conf</div>
          <div>… Dotted: Low Conf</div>
        </div>
      </div>

      {/* React Flow Canvas */}
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
        <Controls showInteractive={false} className="!left-auto !right-4 !top-4" />
        <Background color="#e2e8f0" gap={16} size={1} />
      </ReactFlow>
    </div>
  );
}

export default function NetworkCanvas(props: NetworkCanvasProps) {
  return (
    <ReactFlowProvider>
      <InnerFlowCanvas {...props} />
    </ReactFlowProvider>
  );
}
