
import React, { useCallback, useState } from 'react';
import ReactFlow, { 
  Controls, 
  Background, 
  ReactFlowProvider,
  useReactFlow, 
  BackgroundVariant 
} from 'reactflow';
import 'reactflow/dist/style.css';
import { ParsedSchema } from '@/utils/odata-helper';
import { Spinner } from "@nextui-org/spinner";
import { EntityNode } from './er-diagram/EntityNode';
import { DiagramContext } from './er-diagram/DiagramContext';
import { RelationshipEdge } from './er-diagram/RelationshipEdge';
import { EdgeGradients } from './er-diagram/EdgeGradients';
import { XmlViewer } from './er-diagram/XmlViewer';
import { ControlPanel } from './er-diagram/ControlPanel';
import { useDiagramLayout } from './er-diagram/hooks/useDiagramLayout';

const nodeTypes = { entity: EntityNode };
const edgeTypes = { relationship: RelationshipEdge };

interface Props {
  url: string;
  schema: ParsedSchema | null;
  isLoading: boolean;
  xmlContent?: string;
  isDark?: boolean;
}

const ODataERDiagram: React.FC<Props> = (props) => {
    return (
        <ReactFlowProvider>
            <ODataERDiagramContent {...props} />
        </ReactFlowProvider>
    );
};

const ODataERDiagramContent: React.FC<Props> = ({ url, schema, isLoading, xmlContent, isDark = true }) => {
  const [isPerformanceMode, setIsPerformanceMode] = useState(false);
  const [showXml, setShowXml] = useState(false);
  const [activeEntityIds, setActiveEntityIds] = useState<string[]>([]);
  const [globalMaxZIndex, setGlobalMaxZIndex] = useState(3000);
  const { fitView } = useReactFlow();

  // --- Logic extracted to custom hook ---
  const {
      nodes,
      edges,
      onNodesChange,
      onEdgesChange,
      onNodeDrag,
      onNodeDragStop,
      onNodeClick,
      onPaneClick,
      isProcessingLayout,
      generateDiagram,
      resetHighlight,
      setNodes
  } = useDiagramLayout({ schema, isDark, isPerformanceMode });

  // --- Active Entity Management ---
  const addActiveEntity = useCallback((id: string) => {
    setActiveEntityIds(prev => {
        const others = prev.filter(e => e !== id);
        return [...others, id];
    });
    setGlobalMaxZIndex(prevMax => {
        const newMax = prevMax + 1;
        setNodes((nds) => nds.map(n => {
            if (n.id === id) return { ...n, zIndex: newMax, selected: true };
            return { ...n, selected: false };
        }));
        return newMax;
    });
  }, [setNodes]);

  const removeActiveEntity = useCallback((id: string) => {
    setActiveEntityIds(prev => prev.filter(e => e !== id));
    setNodes((nds) => nds.map(n => {
        if (n.id === id) return { ...n, zIndex: 0 };
        return n;
    }));
  }, [setNodes]);

  const switchActiveEntity = useCallback((fromId: string, toId: string) => {
    setActiveEntityIds(prev => {
        const others = prev.filter(e => e !== fromId && e !== toId);
        return [...others, toId];
    });
    setGlobalMaxZIndex(prevMax => {
        const newMax = prevMax + 1;
        setNodes((nds) => nds.map(n => {
            if (n.id === toId) return { ...n, zIndex: newMax, selected: true };
            return { ...n, selected: false };
        }));
        return newMax;
    });
  }, [setNodes]);

  const resetView = useCallback(async () => {
     resetHighlight();
     setActiveEntityIds([]); 
     await generateDiagram();
     setTimeout(() => {
         fitView({ duration: 800, padding: 0.1 });
     }, 100);
  }, [generateDiagram, fitView, resetHighlight]);

  return (
    <div className={`w-full h-full relative ${isDark ? 'bg-[#21252b]' : 'bg-[#C7EDCC]'}`}>
      {(isLoading || isProcessingLayout) && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm gap-4">
          <Spinner size="lg" color="primary" />
          <p className="text-default-500 font-medium">
             {isLoading ? "Fetching Metadata..." : "Calculating Layout..."}
          </p>
        </div>
      )}
      
      {!isLoading && !isProcessingLayout && (!schema || !schema.entities || schema.entities.length === 0) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-default-400">
           <p>No Entities found or Metadata parse error.</p>
        </div>
      )}

      {/* Controls Overlay */}
      <ControlPanel 
          isDark={isDark} 
          showXml={showXml} 
          setShowXml={setShowXml}
          isPerformanceMode={isPerformanceMode}
          setIsPerformanceMode={setIsPerformanceMode}
          onResetView={resetView}
      />

      {/* XML Viewer */}
      <div 
        className="w-full h-full absolute inset-0 bg-content1 z-0 flex flex-col"
        style={{ display: showXml ? 'flex' : 'none' }}
      >
          <XmlViewer xmlContent={xmlContent} isDark={isDark} />
      </div>

      {/* Diagram View */}
      <div className="w-full h-full" style={{ display: !showXml ? 'block' : 'none' }}>
        <DiagramContext.Provider value={{ activeEntityIds, addActiveEntity, removeActiveEntity, switchActiveEntity }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeDrag={onNodeDrag}
                onNodeDragStop={onNodeDragStop}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                fitView
                attributionPosition="bottom-right"
                minZoom={0.1}
                maxZoom={1.5}
            >
                <EdgeGradients edges={edges} nodes={nodes} />
                <Controls className="bg-content1 border border-divider shadow-sm" />
                <Background 
                    color={isDark ? "#3e4451" : "#047857"} 
                    gap={20} 
                    size={isDark ? 1 : 2} 
                    variant={isDark ? undefined : BackgroundVariant.Dots}
                    style={isDark ? {} : { backgroundColor: '#C7EDCC' }}
                />
            </ReactFlow>
        </DiagramContext.Provider>
      </div>
    </div>
  );
};

export default ODataERDiagram;
