
import React from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getSmoothStepPath } from 'reactflow';

export const RelationshipEdge = ({
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
            opacity: style.opacity, // 关键修改：同步连线的透明度
            transition: 'opacity 0.3s ease' // 添加过渡动画
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
