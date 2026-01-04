
import { useCallback, useEffect, useRef, useState } from 'react';
import { Node, Edge, useNodesState, useEdgesState, MarkerType } from 'reactflow';
import ELK from 'elkjs/lib/elk.bundled.js';
import { ParsedSchema } from '@/utils/odata-helper';
import { generateHashCode, getEntityTheme, computeGraphColoring } from '../utils';
import { calculateDynamicLayout } from '../layout';

const elk = new ELK();

interface UseDiagramLayoutParams {
    schema: ParsedSchema | null;
    isDark: boolean;
    isPerformanceMode: boolean;
}

export const useDiagramLayout = ({ schema, isDark, isPerformanceMode }: UseDiagramLayoutParams) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [isProcessingLayout, setIsProcessingLayout] = useState(false);
    const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());

    const nodesRef = useRef(nodes);
    const edgesRef = useRef(edges);

    useEffect(() => { nodesRef.current = nodes; }, [nodes]);
    useEffect(() => { edgesRef.current = edges; }, [edges]);

    // --- Layout Calculation Helper ---
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

    // --- Drag Handlers ---
    const onNodeDrag = useCallback((event: React.MouseEvent, node: Node, draggedNodes: Node[]) => {
        if (isPerformanceMode) return; 
        performLayoutUpdate(draggedNodes);
    }, [isPerformanceMode, performLayoutUpdate]); 

    const onNodeDragStop = useCallback((event: React.MouseEvent, node: Node, draggedNodes: Node[]) => {
        performLayoutUpdate(draggedNodes);
    }, [performLayoutUpdate]);

    // --- Main Generation Logic ---
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
                type: 'relationship', 
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

    // --- Highlight Logic ---
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

    // --- Apply Highlights Effect ---
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

    // --- Theme & Color Sync Effect ---
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
                type: 'relationship',
                style: { 
                    ...edge.style, 
                    stroke: `url(#${gradientId})`, 
                    strokeWidth: 6, 
                    opacity: isDark ? 0.8 : 1 
                },
                markerStart: (typeof edge.markerStart === 'object' && edge.markerStart) ? { ...edge.markerStart, color: sourceColor } : edge.markerStart,
                markerEnd: (typeof edge.markerEnd === 'object' && edge.markerEnd) ? { ...edge.markerEnd, color: targetColor } : edge.markerEnd,
                data: { 
                    ...edge.data, 
                    sourceColor, 
                    targetColor, 
                    gradientId,
                    isDark 
                }
            };
        }));
    }, [isDark, setNodes, setEdges, schema]);

    // Initial Generation
    useEffect(() => {
        generateDiagram();
    }, [generateDiagram]);

    const resetHighlight = useCallback(() => setHighlightedIds(new Set()), []);

    return {
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
        setNodes, // Exposed for active entity z-index manipulation
        setEdges
    };
};
