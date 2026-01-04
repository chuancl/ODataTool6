
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
  useReactFlow, 
  BackgroundVariant,
  BaseEdge, 
  getSmoothStepPath, 
  EdgeLabelRenderer, 
  EdgeProps 
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
import { generateHashCode, getEntityTheme, computeGraphColoring } from './er-diagram/utils';
import xmlFormat from 'xml-formatter';

// CodeMirror imports
import CodeMirror from '@uiw/react-codemirror';
import { xml } from '@codemirror/lang-xml';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { githubLight } from '@uiw/codemirror-theme-github';

const elk = new ELK();

// --- Custom Edge Component ---
const RelationshipEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  markerStart,
  data
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 20,
  });

  if (!data) return <BaseEdge path={edgePath} markerEnd={markerEnd} markerStart={markerStart} style={style} />;

  const { sourceLabel, targetLabel, sourceColor, targetColor, isDark } = data;

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} markerStart={markerStart} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            zIndex: 10,
            pointerEvents: 'all', 
          }}
          className="nodrag nopan"
        >
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isDark ? '#21252b' : '#ffffff', 
                padding: '4px 8px',
                borderRadius: '6px',
                border: `1px solid ${isDark ? '#3e4451' : '#e4e4e7'}`, 
                boxShadow: isDark ? '0 4px 6px -1px rgba(0, 0, 0, 0.3)' : '0 2px 4px rgba(0,0,0,0.05)',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: '11px', 
                fontWeight: 700,
                whiteSpace: 'nowrap',
            }}>
                <span style={{ color: sourceColor }}>{sourceLabel}</span>
                <span style={{ 
                    color: isDark ? '#ffffff' : '#000000', 
                    margin: '0 6px',
                    fontWeight: 800,
                    opacity: 0.5
                }}>—</span>
                <span style={{ color: targetColor }}>{targetLabel}</span>
            </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

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

// --- Gradient Definitions ---
const EdgeGradients = React.memo(({ edges, nodes }: { edges: Edge[], nodes: Node[] }) => {
    const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

    return (
        <svg style={{ position: 'absolute', top: 0, left: 0, height: 0, width: 0, pointerEvents: 'none' }}>
            <defs>
                {edges.map((e) => {
                    if (!e.data?.gradientId || !e.data?.sourceColor || !e.data?.targetColor) return null;
                    
                    const sourceNode = nodeMap.get(e.source);
                    const targetNode = nodeMap.get(e.target);
                    
                    // Default values
                    let x1 = 0; let y1 = 0;
                    let x2 = 0; let y2 = 0;

                    if (sourceNode && targetNode) {
                        const sW = sourceNode.width || 250; 
                        const sH = sourceNode.height || 100;
                        const tW = targetNode.width || 250;
                        const tH = targetNode.height || 100;

                        // Calculate centers
                        const sx = sourceNode.position.x + sW / 2;
                        const sy = sourceNode.position.y + sH / 2;
                        const tx = targetNode.position.x + tW / 2;
                        const ty = targetNode.position.y + tH / 2;

                        const dx = tx - sx;
                        const dy = ty - sy;

                        // FIX: Use userSpaceOnUse to avoid disappearing straight lines
                        // objectBoundingBox fails when width or height is 0 (straight line)
                        if (Math.abs(dx) > Math.abs(dy)) {
                            // Horizontal Dominance: Keep Y flat to maintain clean horizontal gradient
                            x1 = sx; x2 = tx;
                            y1 = sy; y2 = sy; 
                        } else {
                            // Vertical Dominance: Keep X flat to maintain clean vertical gradient
                            x1 = sx; x2 = sx;
                            y1 = sy; y2 = ty;
                        }
                    }

                    return (
                        <linearGradient 
                            key={e.id} 
                            id={e.data.gradientId} 
                            gradientUnits="userSpaceOnUse" 
                            x1={x1} y1={y1} x2={x2} y2={y2}
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
  const [isPerformanceMode, setIsPerformanceMode] = useState(false);
  const [showXml, setShowXml] = useState(false);
  const [activeEntityIds, setActiveEntityIds] = useState<string[]>([]);
  const [isProcessingLayout, setIsProcessingLayout] = useState(false);
  const [globalMaxZIndex, setGlobalMaxZIndex] = useState(3000);
  const { fitView } = useReactFlow();
  const editorTheme = isDark ? vscodeDark : githubLight;

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
        return xmlContent;
    }
  }, [xmlContent]);

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

  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  // --- Theme & Color Sync Effect ---
  // Re-creates edges when theme or schema changes to ensure colors and labels are correct
  useEffect(() => {
      if (!schema?.entities) return;

      const colorMap = computeGraphColoring(schema.entities, isDark);

      setNodes((nds) => nds.map(node => ({
          ...node,
          data: { 
              ...node.data, 
              isDark,
              colorIndex: colorMap[node.id],
              globalColorMap: colorMap
          }
      })));

      setEdges((eds) => eds.map(edge => {
          const sourceName = edge.source;
          const targetName = edge.target;
          
          const sourceIndex = colorMap[sourceName] ?? Math.abs(generateHashCode(sourceName));
          const targetIndex = colorMap[targetName] ?? Math.abs(generateHashCode(targetName));
          
          const sourceTheme = getEntityTheme(sourceIndex, isDark);
          const targetTheme = getEntityTheme(targetIndex, isDark);
          
          const sourceColor = sourceTheme.header;
          const targetColor = targetTheme.header;
          
          const gradientId = `grad_${sourceName.replace(/\W/g,'')}_${targetName.replace(/\W/g,'')}_${edge.id.replace(/\W/g,'')}`;
          
          return {
              ...edge,
              type: 'relationship', // Ensure custom edge type
              style: { 
                  ...edge.style, 
                  stroke: `url(#${gradientId})`, 
                  strokeWidth: 6, 
                  opacity: isDark ? 0.8 : 1 
              },
              markerStart: (typeof edge.markerStart === 'object' && edge.markerStart) ? { ...edge.markerStart, color: sourceColor } : edge.markerStart,
              markerEnd: (typeof edge.markerEnd === 'object' && edge.markerEnd) ? { ...edge.markerEnd, color: targetColor } : edge.markerEnd,
              
              // No 'label' prop here; data is passed to custom edge
              data: { 
                  ...edge.data, 
                  sourceColor, 
                  targetColor, 
                  gradientId,
                  isDark // Pass theme state to edge
              }
          };
      }));
  }, [isDark, setNodes, setEdges, schema]);

  const performLayoutUpdate = useCallback((draggedNodes: Node[] = []) => {
      const currentNodes = nodesRef.current;
      const currentEdges = edgesRef.current;
      
      const draggedMap = new Map(draggedNodes.map(n => [n.id, n]));
      const mergedNodes = currentNodes.map(n => {
          const dragged = draggedMap.get(n.id);
          if (dragged) return { ...n, position: dragged.position, positionAbsolute: dragged.positionAbsolute };
          return n;
      });

      const { nodes: newNodes, edges: newEdges } = calculateDynamicLayout(mergedNodes, currentEdges);
      setNodes(newNodes);
      setEdges(newEdges);
  }, [setNodes, setEdges]);

  const onNodeDrag = useCallback((event: React.MouseEvent, node: Node, draggedNodes: Node[]) => {
    if (isPerformanceMode) return; 
    performLayoutUpdate(draggedNodes);
  }, [isPerformanceMode, performLayoutUpdate]); 

  const onNodeDragStop = useCallback((event: React.MouseEvent, node: Node, draggedNodes: Node[]) => {
      performLayoutUpdate(draggedNodes);
  }, [performLayoutUpdate]);

  const generateDiagram = useCallback(async () => {
    if (!schema || !schema.entities) {
        setNodes([]); setEdges([]); return;
    }
    
    setIsProcessingLayout(true);

    try {
        const { entities, namespace } = schema;
        if (entities.length === 0) { setIsProcessingLayout(false); return; }

        const fieldColorMap: Record<string, Record<string, string>> = {}; 
        const rawEdges: any[] = [];
        const processedPairs = new Set<string>();
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
                    
                    const sourceIndex = colorMap[entity.name] ?? Math.abs(generateHashCode(entity.name));
                    const targetIndex = colorMap[targetName] ?? Math.abs(generateHashCode(targetName));
                    
                    const sourceTheme = getEntityTheme(sourceIndex, isDark);
                    const targetTheme = getEntityTheme(targetIndex, isDark);
                    const sourceColor = sourceTheme.header;
                    const targetColor = targetTheme.header;
                    
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
                    const edgeId = `${entity.name}-${targetName}-${nav.name}`;
                    const gradientId = `grad_${entity.name.replace(/\W/g,'')}_${targetName.replace(/\W/g,'')}_${edgeId.replace(/\W/g,'')}`;
                    const sourceLabel = `${entity.name} (${sMult}`;
                    const targetLabel = `${tMult}) ${targetName}`;

                    rawEdges.push({
                        id: edgeId,
                        source: entity.name,
                        target: targetName,
                        // No label prop, handled by custom edge
                        data: { sourceColor, targetColor, gradientId, sourceLabel, targetLabel, isDark }
                    });
                }
            }
          });
        });

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
            colorIndex: colorMap[e.name], 
            globalColorMap: colorMap 
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
            type: 'relationship', // Use custom edge type
            pathOptions: { borderRadius: 20 },
            markerStart: { type: MarkerType.ArrowClosed, color: e.data.sourceColor },
            markerEnd: { type: MarkerType.ArrowClosed, color: e.data.targetColor },
            animated: false,
            style: { stroke: `url(#${e.data.gradientId})`, strokeWidth: 6, opacity: isDark ? 0.8 : 1 }, 
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
  }, [schema, setNodes, setEdges, isDark]); 

  useEffect(() => {
    generateDiagram();
  }, [generateDiagram]);

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
            const gradientStroke = `url(#${e.data?.gradientId})`;
            const targetColor = e.data?.targetColor || '#999';
            const sourceColor = e.data?.sourceColor || '#999';
            
            return {
              ...e, 
              animated: false, 
              style: { stroke: gradientStroke, strokeWidth: 6, opacity: isDark ? 0.8 : 1 },
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
                  strokeWidth: isVisible ? 6 : 1, 
                  opacity: isVisible ? 1 : 0.1, 
                  zIndex: isVisible ? 10 : 0
              },
              markerStart: { type: MarkerType.ArrowClosed, color: startMarkerColor },
              markerEnd: { type: MarkerType.ArrowClosed, color: markerColor },
          };
      }));
  }, [highlightedIds, setNodes, setEdges, isDark]);

  const resetView = useCallback(async () => {
     setHighlightedIds(new Set());
     setActiveEntityIds([]); 
     await generateDiagram();
     setTimeout(() => {
         fitView({ duration: 800, padding: 0.1 });
     }, 100);
  }, [generateDiagram, fitView]);

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
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end">
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

      {/* XML Viewer */}
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
