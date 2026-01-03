import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import ReactFlow, { 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState, 
  MarkerType,
  Edge,
  Node,
  ReactFlowProvider,
  useReactFlow // Added useReactFlow for viewport control
} from 'reactflow';
import 'reactflow/dist/style.css';
import ELK from 'elkjs/lib/elk.bundled.js';
import { ParsedSchema } from '@/utils/odata-helper';
import { Button } from "@nextui-org/button";
import { Spinner } from "@nextui-org/spinner";
import { Switch } from "@nextui-org/switch";
import { Zap, FileCode, Download, Copy, Network } from 'lucide-react';
import { calculateDynamicLayout } from './er-diagram/layout';
import { EntityNode } from './er-diagram/EntityNode';
import { DiagramContext } from './er-diagram/DiagramContext';
import { generateHashCode, getColor } from './er-diagram/utils';
import xmlFormat from 'xml-formatter';

// CodeMirror imports for XML view
import CodeMirror from '@uiw/react-codemirror';
import { xml } from '@codemirror/lang-xml';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { githubLight } from '@uiw/codemirror-theme-github';

const elk = new ELK();

const nodeTypes = { entity: EntityNode };

interface Props {
  url: string;
  schema: ParsedSchema | null;
  isLoading: boolean;
  xmlContent?: string;
  isDark?: boolean;
}

// --------------------------------------------------------
// Main Component Wrapper (Required for ReactFlowProvider)
// --------------------------------------------------------
const ODataERDiagram: React.FC<Props> = (props) => {
    return (
        <ReactFlowProvider>
            <ODataERDiagramContent {...props} />
        </ReactFlowProvider>
    );
};


const ODataERDiagramContent: React.FC<Props> = ({ url, schema, isLoading, xmlContent, isDark = true }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isPerformanceMode, setIsPerformanceMode] = useState(false); // 默认关闭性能模式
  const [showXml, setShowXml] = useState(false); // New: Toggle Raw XML View
  const [activeEntityIds, setActiveEntityIds] = useState<string[]>([]); // Global Active Entity IDs for Popovers
  const [isProcessingLayout, setIsProcessingLayout] = useState(false);

  // React Flow Hooks
  const { fitView } = useReactFlow();

  // CodeMirror Theme
  const editorTheme = isDark ? vscodeDark : githubLight;

  // Format XML Content
  const formattedXml = useMemo(() => {
    if (!xmlContent) return '';
    try {
        return xmlFormat(xmlContent, {
            indentation: '  ',
            filter: (node) => node.type !== 'Comment',
            collapseContent: true,
            lineSeparator: '\n'
        });
    } catch (e) {
        console.warn("XML Formatting failed, showing raw content", e);
        return xmlContent;
    }
  }, [xmlContent]);

  // Context Helpers
  const addActiveEntity = useCallback((id: string) => {
    setActiveEntityIds(prev => {
        const others = prev.filter(e => e !== id);
        return [...others, id];
    });
  }, []);

  const removeActiveEntity = useCallback((id: string) => {
    setActiveEntityIds(prev => prev.filter(e => e !== id));
  }, []);

  const switchActiveEntity = useCallback((fromId: string, toId: string) => {
    setActiveEntityIds(prev => {
        const others = prev.filter(e => e !== fromId && e !== toId);
        return [...others, toId];
    });
  }, []);

  // 用于管理高亮节点 ID 的集合
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());

  // Refs for stable state access during callbacks
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  // 提取布局更新逻辑
  const performLayoutUpdate = useCallback((draggedNodes: Node[] = []) => {
      const currentNodes = nodesRef.current;
      const currentEdges = edgesRef.current;
      
      const draggedMap = new Map(draggedNodes.map(n => [n.id, n]));
      const mergedNodes = currentNodes.map(n => {
          const dragged = draggedMap.get(n.id);
          if (dragged) {
              return { ...n, position: dragged.position, positionAbsolute: dragged.positionAbsolute };
          }
          return n;
      });

      const { nodes: newNodes, edges: newEdges } = calculateDynamicLayout(mergedNodes, currentEdges);
      setNodes(newNodes);
      setEdges(newEdges);
  }, [setNodes, setEdges]);

  // [REAL-TIME DRAG]
  const onNodeDrag = useCallback((event: React.MouseEvent, node: Node, draggedNodes: Node[]) => {
    if (isPerformanceMode) return; 
    performLayoutUpdate(draggedNodes);
  }, [isPerformanceMode, performLayoutUpdate]); 

  // [DRAG STOP]
  const onNodeDragStop = useCallback((event: React.MouseEvent, node: Node, draggedNodes: Node[]) => {
      performLayoutUpdate(draggedNodes);
  }, [performLayoutUpdate]);

  // Generate Diagram Layout (Extracted for Reset functionality)
  const generateDiagram = useCallback(async () => {
    if (!schema || !schema.entities) {
        setNodes([]);
        setEdges([]);
        return;
    }
    
    setIsProcessingLayout(true);

    try {
        const { entities, namespace } = schema;
        
        if (entities.length === 0) {
            setIsProcessingLayout(false);
            return;
        }

        // 1. 数据准备
        const fieldColorMap: Record<string, Record<string, string>> = {}; 
        const rawEdges: any[] = [];
        const processedPairs = new Set<string>();

        const setFieldColor = (entityName: string, fieldName: string, color: string) => {
            if (!fieldColorMap[entityName]) fieldColorMap[entityName] = {};
            fieldColorMap[entityName][fieldName] = color;
        };

        entities.forEach(entity => {
          entity.navigationProperties.forEach((nav: any) => {
            if (nav.targetType) {
                let targetName = nav.targetType;
                if (targetName.startsWith('Collection(')) targetName = targetName.slice(11, -1);
                targetName = targetName.split('.').pop();
                
                if (entity.name === targetName) return;

                if (targetName && entities.find(n => n.name === targetName)) {
                    const pairKey = [entity.name, targetName].sort().join('::');
                    const colorIndex = Math.abs(generateHashCode(pairKey));
                    const edgeColor = getColor(colorIndex);
                    
                    if (nav.constraints && nav.constraints.length > 0) {
                        nav.constraints.forEach((c: any) => {
                            setFieldColor(entity.name, c.sourceProperty, edgeColor);
                            setFieldColor(targetName, c.targetProperty, edgeColor);
                        });
                    }

                    if (processedPairs.has(pairKey)) return;
                    processedPairs.add(pairKey);

                    const sMult = nav.sourceMultiplicity || '?';
                    const tMult = nav.targetMultiplicity || '?';
                    const label = `${entity.name} (${sMult} - ${tMult}) ${targetName}`;

                    rawEdges.push({
                        id: `${entity.name}-${targetName}-${nav.name}`,
                        source: entity.name,
                        target: targetName,
                        label: label,
                        color: edgeColor
                    });
                }
            }
          });
        });

        // 2. 初始化节点
        const initialNodesRaw = entities.map((e) => ({
          id: e.name,
          type: 'entity',
          data: { 
            label: e.name, 
            namespace, 
            properties: e.properties, 
            keys: e.keys, 
            navigationProperties: e.navigationProperties,
            fieldColors: fieldColorMap[e.name] || {},
            dynamicHandles: [] 
          },
          position: { x: 0, y: 0 }
        }));

        const getNodeDimensions = (propCount: number, navCount: number) => {
            const visibleProps = Math.min(propCount, 12);
            const visibleNavs = Math.min(navCount, 8);
            const extraHeight = (navCount > 0 ? 30 : 0) + (propCount > 12 ? 20 : 0) + (navCount > 8 ? 20 : 0);
            const height = 45 + (visibleProps * 24) + (visibleNavs * 28) + extraHeight + 30; 
            return { width: 300, height: height };
        };

        // 3. ELK 布局计算
        const elkGraph = {
          id: 'root',
          layoutOptions: {
            'elk.algorithm': 'layered',
            'elk.direction': 'RIGHT',
            'elk.spacing.nodeNode': '200',  // Increased spacing
            'elk.layered.spacing.nodeNodeBetweenLayers': '400', // Increased spacing
            'elk.edgeRouting': 'SPLINES', 
            'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
          },
          children: initialNodesRaw.map(n => ({ 
              id: n.id, 
              ...getNodeDimensions(n.data.properties.length, n.data.navigationProperties?.length || 0) 
          })), 
          edges: rawEdges.map(e => ({ id: e.id, sources: [e.source], targets: [e.target] }))
        };

        const layoutedGraph = await elk.layout(elkGraph);
        
        const preCalcNodes: Node[] = initialNodesRaw.map(node => {
          const elkNode = layoutedGraph.children?.find(n => n.id === node.id);
          return {
            ...node,
            position: { x: elkNode?.x || 0, y: elkNode?.y || 0 },
            width: 250, 
            height: elkNode?.height || 200
          };
        });

        const preCalcEdges: Edge[] = rawEdges.map((e: any) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: undefined, 
            targetHandle: undefined, 
            type: 'smoothstep', 
            pathOptions: { borderRadius: 20 },
            markerStart: { type: MarkerType.ArrowClosed, color: e.color },
            markerEnd: { type: MarkerType.ArrowClosed, color: e.color },
            animated: false,
            // Increase strokeWidth to 6
            style: { stroke: e.color, strokeWidth: 6, opacity: 0.8 },
            label: e.label,
            labelStyle: { fill: e.color, fontWeight: 700, fontSize: 10 },
            labelBgStyle: { fill: '#ffffff', fillOpacity: 0.7, rx: 4, ry: 4 },
            data: { originalColor: e.color }
        }));

        const { nodes: finalNodes, edges: finalEdges } = calculateDynamicLayout(preCalcNodes, preCalcEdges);

        setNodes(finalNodes);
        setEdges(finalEdges);
    } catch (err) {
        console.error("ER Diagram generation failed", err);
    } finally {
        setIsProcessingLayout(false);
    }
  }, [schema, setNodes, setEdges]);

  // Initial load
  useEffect(() => {
    generateDiagram();
  }, [generateDiagram]);

  // 处理节点点击事件：多选/反选逻辑
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    event.stopPropagation();
    const isCtrlPressed = event.ctrlKey || event.metaKey;
    const currentEdges = edgesRef.current; 

    setHighlightedIds((prev) => {
        const next = new Set(isCtrlPressed ? prev : []);

        if (isCtrlPressed && prev.has(node.id)) {
            next.delete(node.id);
        } else {
            next.add(node.id);
            currentEdges.forEach(edge => {
                if (edge.source === node.id) next.add(edge.target);
                if (edge.target === node.id) next.add(edge.source);
            });
        }
        return next;
    });
  }, []);

  const onPaneClick = useCallback(() => {
      setHighlightedIds(new Set());
  }, []);

  useEffect(() => {
      if (highlightedIds.size === 0) {
          setNodes((nds) => nds.map(n => ({
              ...n,
              style: { ...n.style, opacity: 1, filter: 'none' }
          })));
          setEdges((eds) => eds.map(e => ({
              ...e, 
              animated: false, 
              // Reset strokeWidth to 6
              style: { stroke: e.data?.originalColor, strokeWidth: 6, opacity: 0.8 }, 
              markerStart: { type: MarkerType.ArrowClosed, color: e.data?.originalColor },
              markerEnd: { type: MarkerType.ArrowClosed, color: e.data?.originalColor },
              labelStyle: { ...e.labelStyle, fill: e.data?.originalColor, opacity: 1 },
              labelBgStyle: { ...e.labelBgStyle, fillOpacity: 0.7 },
              zIndex: 0
          })));
          return;
      }

      setNodes((nds) => nds.map((n) => {
          const isHighlighted = highlightedIds.has(n.id);
          return {
            ...n,
            style: { 
              ...n.style,
              opacity: isHighlighted ? 1 : 0.1, 
              filter: isHighlighted ? 'none' : 'grayscale(100%)',
              transition: 'all 0.3s ease'
            }
          };
      }));

      setEdges((eds) => eds.map(e => {
          const isVisible = highlightedIds.has(e.source) && highlightedIds.has(e.target);
          const color = isVisible ? (e.data?.originalColor || '#0070f3') : '#999';
          
          return {
              ...e,
              animated: isVisible,
              style: { 
                  ...e.style, 
                  stroke: color,
                  // Highlighting width: increased to 8 for visibility
                  strokeWidth: isVisible ? 8 : 1,
                  opacity: isVisible ? 1 : 0.05, 
                  zIndex: isVisible ? 10 : 0
              },
              markerStart: { type: MarkerType.ArrowClosed, color: color },
              markerEnd: { type: MarkerType.ArrowClosed, color: color },
              labelStyle: { ...e.labelStyle, fill: color, opacity: isVisible ? 1 : 0 },
              labelBgStyle: { ...e.labelBgStyle, fillOpacity: isVisible ? 0.9 : 0 }
          };
      }));
  }, [highlightedIds, setNodes, setEdges]);

  useEffect(() => {
    setNodes((nds) => nds.map(n => {
        const activeIndex = activeEntityIds.indexOf(n.id);
        const targetZIndex = activeIndex !== -1 ? 1000 + activeIndex : 0;
        if (n.zIndex !== targetZIndex) {
            return { ...n, zIndex: targetZIndex };
        }
        return n;
    }));
  }, [activeEntityIds, setNodes]);

  const resetView = useCallback(async () => {
     setHighlightedIds(new Set());
     setActiveEntityIds([]); 
     
     // Recalculate layout from scratch
     await generateDiagram();
     
     // Reset Viewport (Zoom/Pan)
     // Add a small delay to ensure nodes are rendered in their new positions before fitting
     setTimeout(() => {
         fitView({ duration: 800, padding: 0.1 });
     }, 100);
  }, [generateDiagram, fitView]);

  // Helper for XML View
  const handleDownloadXml = () => {
      if (!formattedXml) return;
      const blob = new Blob([formattedXml], { type: 'application/xml' });
      const u = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = u; link.download = 'metadata.xml';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(u);
  };

  const handleCopyXml = () => {
      if (formattedXml) navigator.clipboard.writeText(formattedXml);
  };

  return (
    // 修改处：根据 isDark 动态切换背景颜色
    // 暗色模式：bg-content2/30 (保持原样)
    // 亮色模式：bg-[#E3F2FD] (浅蓝色/淡天蓝，更鲜艳，避免灰色)
    <div className={`w-full h-full relative ${isDark ? 'bg-content2/30' : 'bg-[#E3F2FD]'}`}>
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

      {/* Controls Overlay (Top Right) */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end">
        {/* Switch for Diagram / XML View */}
        <div className="flex items-center gap-2 bg-content1/90 backdrop-blur-md p-1.5 px-3 rounded-lg border border-divider shadow-sm">
            <span className="text-xs font-medium text-default-500 flex items-center gap-1">
                {showXml ? <Network size={14} className="text-primary"/> : <FileCode size={14} className="text-default-400" />}
                {showXml ? "显示ER图" : "显示原始文件"}
            </span>
            <Switch size="sm" isSelected={showXml} onValueChange={setShowXml} aria-label="Toggle View" />
        </div>

        {/* Other controls hidden when showing XML to avoid clutter */}
        {!showXml && (
            <>
                <div className="flex items-center gap-2 bg-content1/90 backdrop-blur-md p-1.5 px-3 rounded-lg border border-divider shadow-sm">
                    <span className="text-xs font-medium text-default-500 flex items-center gap-1">
                        <Zap size={14} className={isPerformanceMode ? "text-warning" : "text-default-400"} fill={isPerformanceMode ? "currentColor" : "none"} />
                        性能模式
                    </span>
                    <Switch size="sm" isSelected={isPerformanceMode} onValueChange={setIsPerformanceMode} aria-label="性能模式" />
                </div>
                <Button size="sm" color="primary" variant="flat" onPress={resetView}>重置视图</Button>
            </>
        )}
      </div>

      {/* --- XML Viewer View --- */}
      <div 
        className="w-full h-full absolute inset-0 bg-content1 z-0 flex flex-col"
        style={{ display: showXml ? 'flex' : 'none' }}
      >
          {/* XML Toolbar - Moved actions to LEFT to prevent overlap with top-right switch */}
          <div className="p-2 border-b border-divider flex items-center gap-4 bg-content2/50 backdrop-blur-md shrink-0">
             <span className="text-xs font-bold text-default-500 px-2 flex items-center gap-2">
                 <FileCode size={14}/> Metadata.xml
             </span>
             <div className="flex gap-1">
                 <Button isIconOnly size="sm" variant="light" onPress={handleDownloadXml} title="下载 XML"><Download size={14}/></Button>
                 <Button isIconOnly size="sm" variant="light" onPress={handleCopyXml} title="复制 XML"><Copy size={14}/></Button>
             </div>
          </div>
          
          {/* CodeMirror Editor */}
          <div className="flex-1 overflow-hidden relative text-sm">
             <CodeMirror
                value={formattedXml || '<!-- No XML Content Available -->'}
                height="100%"
                className="h-full [&_.cm-scroller]:overflow-scroll"
                extensions={[xml()]}
                theme={editorTheme}
                readOnly={true}
                editable={false}
                basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                    highlightActiveLine: true
                }}
            />
          </div>
      </div>

      {/* --- Diagram View --- */}
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
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                fitView
                attributionPosition="bottom-right"
                minZoom={0.1}
                maxZoom={1.5}
            >
                <Controls className="bg-content1 border border-divider shadow-sm" />
                <Background color="#888" gap={24} size={1} />
            </ReactFlow>
        </DiagramContext.Provider>
      </div>
    </div>
  );
};

export default ODataERDiagram;
