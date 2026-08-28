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

// Custom Node Styling based on Entity Type (Light Theme Corporate UI - FE-02)
const CustomNodeComponent = ({ data }: NodeProps<{ entity: Entity; isSelected?: boolean }>) => {
  const entity = data.entity;
  const isSelected = data.isSelected;

  const config = useMemo(() => {
    switch (entity.type) {
      case 'PERSON':
        return { icon: User, color: 'text-blue-600 bg-blue-50/50', border: 'border-blue-200' };
      case 'ORGANIZATION':
        return { icon: Fingerprint, color: 'text-purple-600 bg-purple-50/50', border: 'border-purple-200' };
      case 'LOCATION':
        return { icon: MapPin, color: 'text-teal-600 bg-teal-50/50', border: 'border-teal-200' };
      case 'VEHICLE':
        return { icon: Car, color: 'text-orange-600 bg-orange-50/50', border: 'border-orange-200' };
      case 'BANK_ACCOUNT':
        return { icon: Coins, color: 'text-yellow-600 bg-yellow-50/50', border: 'border-yellow-250' };
      case 'PHONE':
        return { icon: Phone, color: 'text-cyan-600 bg-cyan-50/50', border: 'border-cyan-200' };
      default:
        return { icon: Fingerprint, color: 'text-slate-600 bg-slate-50/50', border: 'border-slate-200' };
    }
  }, [entity.type]);

  const Icon = config.icon;

  return (
    <div className={`p-3 rounded-lg border bg-white shadow-sm flex items-center gap-3 w-56 text-left relative border-slate-200 ${
      isSelected ? 'ring-1 ring-[#0891B2] shadow-[0_0_12px_rgba(8,145,178,0.22)] border-[#0891B2]' : ''
    }`}>
      {/* React Flow Source/Target Handles */}
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />

      {/* Node Icon */}
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 bg-white ${config.border}`}>
        <Icon size={16} className={config.color} />
      </div>

      {/* Node Details */}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-slate-800 truncate">{(entity as any).name}</p>
        <p className="text-[8px] text-slate-400 font-bold tracking-wider uppercase">{entity.type.replace('_', ' ')}</p>
        {(entity as any).aliases && (entity as any).aliases.length > 0 && (
          <p className="text-[8px] text-slate-500 italic truncate mt-0.5">
            aka: {(entity as any).aliases.join(', ')}
          </p>
        )}
      </div>

      {/* Confidence Badge */}
      {(entity as any).confidence < 1.0 && (
        <div className="absolute -top-2 -right-2 bg-white border border-slate-200 text-[8px] font-bold text-slate-500 px-1.5 py-0.5 rounded-full shadow-sm">
          {Math.round((entity as any).confidence * 100)}%
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
        source: (rel as any).source,
        target: (rel as any).target,
        label: rel.type.replace('_', ' '),
        animated: isHighlighted,
        selected: isSelected,
        style: {
          stroke: isSelected ? '#2563EB' : isHighlighted ? '#6366F1' : '#94A3B8',
          strokeWidth: isSelected ? 2.5 : isHighlighted ? 2 : 1.25,
        },
        labelStyle: {
          fill: '#475569',
          fontSize: 8,
          fontWeight: 700,
        },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 4,
        labelBgStyle: {
          fill: '#FFFFFF',
          fillOpacity: 0.95,
          stroke: '#E2E8F0',
          strokeWidth: 1
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
    <div className="w-full h-full relative bg-[#F8FAFC] border border-slate-200 rounded-xl overflow-hidden">
      {/* Graph Truncation indicator warning (FE-02) */}
      {truncated && (
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold shadow-sm">
          <AlertTriangle size={14} className="shrink-0 text-amber-600" />
          <span>Graph bounded — expand a node to investigate further.</span>
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
