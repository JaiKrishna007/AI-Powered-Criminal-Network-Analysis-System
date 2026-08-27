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
  EdgeLabelRenderer
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
  CaseSensitive,
  CalendarDays
} from 'lucide-react';
import { Entity, Relationship } from '@/lib/client-contracts/contracts';

// Custom Node Styling based on Entity Type (XAI visuals - FE-02)
const CustomNodeComponent = ({ data }: NodeProps<{ entity: Entity; isSelected?: boolean }>) => {
  const entity = data.entity;
  const isSelected = data.isSelected;

  const config = useMemo(() => {
    switch (entity.type) {
      case 'PERSON':
        return { icon: User, color: 'text-indigo-400', bg: 'bg-indigo-950/40', border: 'border-indigo-500/50' };
      case 'PHONE':
        return { icon: Phone, color: 'text-cyan-400', bg: 'bg-cyan-950/40', border: 'border-cyan-500/50' };
      case 'BANK_ACCOUNT':
        return { icon: Coins, color: 'text-emerald-400', bg: 'bg-emerald-950/40', border: 'border-emerald-500/50' };
      case 'VEHICLE':
        return { icon: Car, color: 'text-amber-400', bg: 'bg-amber-950/40', border: 'border-amber-500/50' };
      case 'LOCATION':
        return { icon: MapPin, color: 'text-rose-400', bg: 'bg-rose-950/40', border: 'border-rose-500/50' };
      case 'EVENT':
        return { icon: CalendarDays, color: 'text-violet-400', bg: 'bg-violet-950/40', border: 'border-violet-500/50' };
      default:
        return { icon: Fingerprint, color: 'text-zinc-400', bg: 'bg-zinc-900/40', border: 'border-zinc-700/50' };
    }
  }, [entity.type]);

  const Icon = config.icon;

  return (
    <div className={`p-3 rounded-xl glass-card flex items-center gap-3 w-56 text-left relative ${config.bg} ${config.border} ${
      isSelected ? 'ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/25 border-indigo-400' : ''
    }`}>
      {/* React Flow Source/Target Handles */}
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />

      {/* Node Icon */}
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-zinc-950 border border-zinc-800 shrink-0`}>
        <Icon size={18} className={config.color} />
      </div>

      {/* Node Details */}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-zinc-100 truncate">{entity.canonical_name}</p>
        <p className="text-[9px] text-zinc-400 font-semibold tracking-wider uppercase">{entity.type.replace('_', ' ')}</p>
        {entity.aliases && entity.aliases.length > 0 && (
          <p className="text-[8px] text-zinc-500 italic truncate mt-0.5">
            aka: {entity.aliases.join(', ')}
          </p>
        )}
      </div>

      {/* Confidence Badge */}
      {entity.confidence < 1.0 && (
        <div className="absolute -top-2 -right-2 bg-zinc-950 border border-zinc-800 text-[8px] font-bold text-indigo-400 px-1.5 py-0.5 rounded-full">
          {Math.round(entity.confidence * 100)}%
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

  // Node Arranger: Layout nodes in a circle centered on coordinates to prevent stacking (FE-T01)
  useEffect(() => {
    if (nodes.length === 0) {
      setRfNodes([]);
      setRfEdges([]);
      return;
    }

    const radius = 280;
    const cx = 350;
    const cy = 250;

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
          stroke: isSelected ? '#818cf8' : isHighlighted ? '#a78bfa' : 'rgba(255, 255, 255, 0.25)',
          strokeWidth: isSelected ? 3 : isHighlighted ? 2.5 : 1.5,
        },
        labelStyle: {
          fill: '#a1a1aa',
          fontSize: 9,
          fontWeight: 600,
        },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 4,
        labelBgStyle: {
          fill: '#18181b',
          fillOpacity: 0.9,
          stroke: 'rgba(255, 255, 255, 0.08)'
        }
      };
    });

    setRfNodes(formattedNodes);
    setRfEdges(formattedEdges);
  }, [nodes, edges, selectedNodeId, selectedEdgeId, highlightedEdges, setRfNodes, setRfEdges]);

  // Handle Graph Selection (FE-04)
  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null); // Deselect edge
  };

  const onEdgeClick = (_: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null); // Deselect node
  };

  const onPaneClick = () => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  };

  // Node Double Click for Expansion (FE-T03)
  const onNodeDoubleClick = (_: React.MouseEvent, node: Node) => {
    onExpandNode(node.id);
  };

  return (
    <div className="w-full h-full relative bg-zinc-950">
      {/* Graph Truncation indicator warning (FE-02) */}
      {truncated && (
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-950/60 border border-amber-900/50 text-amber-400 text-xs font-semibold backdrop-blur-md">
          <AlertTriangle size={14} className="shrink-0" />
          <span>Graph Bounded: Traversal limit reached. Double-click a node to expand.</span>
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
        <Background color="#27272a" gap={20} size={1} />
      </ReactFlow>
    </div>
  );
}
