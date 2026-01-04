
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
  useReactFlow, // Added useReactFlow for viewport control
  BackgroundVariant // Added for type safety
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
import { generateHashCode, getColor, getEntityTheme, computeGraphColoring } from './er-diagram/utils';
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

// --------------------------------------------------------
// Helper Component: Edge Gradients Definition
// --------------------------------------------------------
const EdgeGradients = React.memo(({ edges }: { edges: Edge[] }) => {
    return (
        <svg style={{ position: 'absolute', top: 0, left: 0, height: 0, width: 0, pointerEvents: 'none' }}>
            <defs>
                {edges.map((e) => {
                    if (!e.data?.gradientId || !e.data?.sourceColor || !e.data?.targetColor) return null;
                    return (
                        <linearGradient 
                            key={e.id} 
                            id={e.data.gradientId} 
                            gradientUnits="objectBoundingBox" 
                            x1="0%" y1="0%" x2="100%" y2="0%"
                        >
                            <stop offset="0%" stopColor={e.data.sourceColor} />
                            <stop offset="100%" stopColor={e.data.targetColor} />
                        </linearGradient>
                    );
                })}
            </defs>
        </svg>
    );
});

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

  // Sync isDark prop and Color Logic to nodes data
  // This effect ensures that when theme changes, colors are re-calculated based on the graph structure
  // and the specific palette size for that theme (to minimize collisions).
  useEffect(() => {
      if (!schema?.entities) return;

      const colorMap = computeGraphColoring(schema.entities, isDark);

      setNodes((nds) => nds.map(node => ({
          ...node,
          data: { 
              ...node.data, 
              isDark,
              colorIndex: colorMap[node.id] // Inject optimized color index
          }
      })));

      setEdges((eds) => eds.map(edge => {
          // Recalculate colors based on graph color map
          const sourceName = edge.source;
          const targetName = edge.target;
          
          // Use graph coloring index if available, fallback to hash
          const sourceIndex = colorMap[sourceName] ?? Math.abs(generateHashCode(sourceName));
          const targetIndex = colorMap[targetName] ?? Math.abs(generateHashCode(targetName));
          
          const sourceTheme = getEntityTheme(sourceIndex, isDark);
          const targetTheme = getEntityTheme(targetIndex, isDark);
          
          const sourceColor = sourceTheme.header;
          const targetColor = targetTheme.header;
          
          // Generate deterministic safe ID for gradient
          const gradientId = `grad_${sourceName.replace(/\W/g,'')}_${targetName.replace(/\W/g,'')}_${edge.id.replace(/\W/g,'')}`;

          const strokeWidth = isDark ? 2 : 3;
          const opacity = isDark ? 0.8 : 1;
          
          const sourceLabel = edge.data?.sourceLabel || edge.source;
          const targetLabel = edge.data?.targetLabel || edge.target;
          
          const separatorColor = isDark ? '#a1a1aa' : '#52525b'; 

          return {
              ...edge,
              style: { 
                  ...edge.style, 
                  stroke: `url(#${gradientId})`, 
                  strokeWidth: strokeWidth, 
                  opacity: opacity 
              },
              markerStart: (typeof edge.markerStart === 'object' && edge.markerStart) ? { 
                  ...edge.markerStart, 
                  color: sourceColor 
              } : edge.markerStart,
              markerEnd: (typeof edge.markerEnd === 'object' && edge.markerEnd) ? { 
                  ...edge.markerEnd, 
                  color: targetColor 
              } : edge.markerEnd,
              label: (
                  <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isDark ? '#282c34' : '#ffffff', 
                      padding: '2px 6px',
                      borderRadius: '6px',
                      border: `1px solid ${isDark ? '#3e4451' : 'rgba(0,0,0,0.1)'}`, 
                      boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
                      fontFamily: 'monospace',
                      fontSize: '10px',
                      pointerEvents: 'none'
                  }}>
                      <span style={{ color: sourceColor, fontWeight: 'bold' }}>{sourceLabel}</span>
                      <span style={{ color: separatorColor, margin: '0 4px' }}>-</span>
                      <span style={{ color: targetColor, fontWeight: 'bold' }}>{targetLabel}</span>
                  </div>
              ),
              data: {
                  ...edge.data,
                  sourceColor,
                  targetColor,
                  gradientId
              }
          };
      }));
  }, [isDark, setNodes, setEdges, schema]); // Depend on schema to re-color if data changes


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

        // Pre-calculate colors for initial render to avoid flicker
        const colorMap = computeGraphColoring(entities, isDark);

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
                    
                    // --- Calculate Gradient Colors using Graph Coloring ---
                    const sourceIndex = colorMap[entity.name] ?? Math.abs(generateHashCode(entity.name));
                    const targetIndex = colorMap[targetName] ?? Math.abs(generateHashCode(targetName));
                    
                    const sourceTheme = getEntityTheme(sourceIndex, isDark);
                    const targetTheme = getEntityTheme(targetIndex, isDark);
                    
                    const sourceColor = sourceTheme.header;
                    const targetColor = targetTheme.header;
                    
                    // Use sourceColor for field highlighting
                    
                    if (nav.constraints && nav.constraints.length > 0) {
                        nav.constraints.forEach((c: any) => {
                            setFieldColor(entity.name, c.sourceProperty, sourceColor);
                            setFieldColor(targetName, c.targetProperty, targetColor);
                        });
                    }

                    if (processedPairs.has(pairKey)) return;
                    processedPairs.add(pairKey);

                    const sMult = nav.sourceMultiplicity || '?';
                    const tMult = nav.targetMultiplicity || '?';
                    const label = `${entity.name} (${sMult} - ${tMult}) ${targetName}`;
                    const edgeId = `${entity.name}-${targetName}-${nav.name}`;
                    const gradientId = `grad_${entity.name.replace(/\W/g,'')}_${targetName.replace(/\W/g,'')}_${edgeId.replace(/\W/g,'')}`;

                    rawEdges.push({
                        id: edgeId,
                        source: entity.name,
                        target: targetName,
                        label: label, 
                        data: { 
                            sourceColor,
                            targetColor,
                            gradientId,
                            sourceLabel: `${entity.name} (${sMult}`,
                            targetLabel: `${tMult}) ${targetName}`
                        }
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
            dynamicHandles: [],
            isDark: isDark,
            colorIndex: colorMap[e.name] // Inject computed color index
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
            'elk.spacing.nodeNode': '200',
            'elk.layered.spacing.nodeNodeBetweenLayers': '400',
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
            markerStart: { type: MarkerType.ArrowClosed, color: e.data.sourceColor },
            markerEnd: { type: MarkerType.ArrowClosed, color: e.data.targetColor },
            animated: false,
            style: { stroke: `url(#${e.data.gradientId})`, strokeWidth: isDark ? 2 : 3, opacity: isDark ? 0.8 : 1 },
            label: e.label,
            labelStyle: { fill: e.data.sourceColor, fontWeight: isDark ? 400 : 700, fontSize: 10 },
            labelBgStyle: { fill: isDark ? '#ffffff' : '#f4f4f5', fillOpacity: 0.8, rx: 4, ry: 4 },
            data: e.data
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
          setEdges((eds) => eds.map(e => {
            // Restore gradient style
            const gradientStroke = `url(#${e.data?.gradientId})`;
            const targetColor = e.data?.targetColor || '#999';
            const sourceColor = e.data?.sourceColor || '#999';
            
            return {
              ...e, 
              animated: false, 
              style: { stroke: gradientStroke, strokeWidth: isDark ? 2 : 3, opacity: isDark ? 0.8 : 1 }, 
              markerStart: { type: MarkerType.ArrowClosed, color: sourceColor },
              markerEnd: { type: MarkerType.ArrowClosed, color: targetColor },
              zIndex: 0
            };
          }));
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
          
          const gradientStroke = `url(#${e.data?.gradientId})`;
          const stroke = isVisible ? gradientStroke : (isDark ? '#333' : '#ddd');
          
          const targetColor = e.data?.targetColor || '#999';
          const sourceColor = e.data?.sourceColor || '#999';
          const markerColor = isVisible ? targetColor : (isDark ? '#333' : '#ddd');
          const startMarkerColor = isVisible ? sourceColor : (isDark ? '#333' : '#ddd');

          return {
              ...e,
              animated: isVisible,
              style: { 
                  ...e.style, 
                  stroke: stroke,
                  strokeWidth: isVisible ? 4 : 1, 
                  opacity: isVisible ? 1 : 0.1, 
                  zIndex: isVisible ? 10 : 0
              },
              markerStart: { type: MarkerType.ArrowClosed, color: startMarkerColor },
              markerEnd: { type: MarkerType.ArrowClosed, color: markerColor },
              // Dim the label if not visible
              labelStyle: isVisible ? undefined : { opacity: 0 },
          };
      }));
  }, [highlightedIds, setNodes, setEdges, isDark]);

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
     await generateDiagram();
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
    // 修改处：亮色模式下使用 #C7EDCC (Mint Green) 背景，暗色模式使用 One Dark Pro 背景 #21252b
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

      {/* Controls Overlay (Top Right) */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end">
        {/* Toggle View Box: Dark mode uses One Dark Pro palette */}
        <div className={`flex items-center gap-2 p-1.5 px-3 rounded-lg border shadow-sm transition-colors ${
            isDark 
            ? "bg-[#2c313a] border-[#3e4451] text-[#abb2bf]" 
            : "bg-primary border-transparent text-white"
        }`}>
            <span className="text-xs font-medium flex items-center gap-1">
                {showXml 
                    ? <Network size={14} className={isDark ? "text-[#61afef]" : "text-white"}/> 
                    : <FileCode size={14} className={isDark ? "text-[#abb2bf]" : "text-white/80"} />
                }
                {showXml ? "显示ER图" : "显示原始文件"}
            </span>
            <Switch 
                size="sm" 
                color="success" 
                isSelected={showXml} 
                onValueChange={setShowXml} 
                aria-label="Toggle View"
                classNames={{
                    wrapper: isDark ? "bg-[#3e4451] group-data-[selected=true]:bg-[#98c379]" : "bg-default/40 group-data-[selected=true]:bg-success" 
                }}
            />
        </div>

        {!showXml && (
            <>
                {/* Performance Mode Box */}
                <div className={`flex items-center gap-2 p-1.5 px-3 rounded-lg border shadow-sm transition-colors ${
                    isDark 
                    ? "bg-[#2c313a] border-[#3e4451] text-[#abb2bf]" 
                    : "bg-primary border-transparent text-white"
                }`}>
                    <span className="text-xs font-medium flex items-center gap-1">
                        <Zap 
                            size={14} 
                            className={isPerformanceMode ? (isDark ? "text-[#e5c07b]" : "text-yellow-300") : (isDark ? "text-[#5c6370]" : "text-white/70")} 
                            fill={isPerformanceMode ? "currentColor" : "none"} 
                        />
                        性能模式
                    </span>
                    <Switch 
                        size="sm" 
                        color="warning" 
                        isSelected={isPerformanceMode} 
                        onValueChange={setIsPerformanceMode} 
                        aria-label="性能模式"
                        classNames={{
                            wrapper: isDark ? "bg-[#3e4451] group-data-[selected=true]:bg-[#e5c07b]" : "bg-default/40 group-data-[selected=true]:bg-warning"
                        }}
                    />
                </div>
                {/* Reset View Button */}
                <Button 
                    size="sm" 
                    color={isDark ? "default" : "primary"}
                    variant={isDark ? "flat" : "solid"}
                    className={`shadow-sm font-medium ${isDark ? "bg-[#2c313a] border border-[#3e4451] text-[#61afef] hover:bg-[#3e4451] hover:text-white" : ""}`}
                    onPress={resetView}
                >
                    重置视图
                </Button>
            </>
        )}
      </div>

      {/* --- XML Viewer View --- */}
      <div 
        className="w-full h-full absolute inset-0 bg-content1 z-0 flex flex-col"
        style={{ display: showXml ? 'flex' : 'none' }}
      >
          <div className="p-2 border-b border-divider flex items-center gap-4 bg-content2/50 backdrop-blur-md shrink-0">
             <span className="text-xs font-bold text-default-500 px-2 flex items-center gap-2">
                 <FileCode size={14}/> Metadata.xml
             </span>
             <div className="flex gap-1">
                 <Button isIconOnly size="sm" variant="light" onPress={handleDownloadXml} title="下载 XML"><Download size={14}/></Button>
                 <Button isIconOnly size="sm" variant="light" onPress={handleCopyXml} title="复制 XML"><Copy size={14}/></Button>
             </div>
          </div>
          
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
                {/* --- Insert Gradient Defs --- */}
                <EdgeGradients edges={edges} />

                <Controls className="bg-content1 border border-divider shadow-sm" />
                <Background 
                    // 修改处：亮色模式下使用 #047857 (Emerald 700) 网点，与薄荷绿背景形成对比。暗色下使用 One Dark Pro Gutter color (#3e4451)
                    color={isDark ? "#3e4451" : "#047857"} 
                    gap={20} 
                    size={isDark ? 1 : 2} 
                    variant={isDark ? undefined : BackgroundVariant.Dots}
                    // 修改处：亮色模式下使用 #C7EDCC (Mint Green) 背景
                    style={isDark ? {} : { backgroundColor: '#C7EDCC' }}
                />
            </ReactFlow>
        </DiagramContext.Provider>
      </div>
    </div>
  );
};

export default ODataERDiagram;
