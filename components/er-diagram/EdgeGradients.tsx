
import React, { useMemo } from 'react';
import { Edge, Node } from 'reactflow';

interface EdgeGradientsProps {
    edges: Edge[];
    nodes: Node[];
}

export const EdgeGradients = React.memo(({ edges, nodes }: EdgeGradientsProps) => {
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
