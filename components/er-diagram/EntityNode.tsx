
import React, { useCallback, useEffect, useState, useContext } from 'react';
import { Handle, Position, NodeProps, useUpdateNodeInternals, useReactFlow } from 'reactflow';
import { Button } from "@nextui-org/button";
import { Popover, PopoverTrigger, PopoverContent } from "@nextui-org/popover";
import { ScrollShadow } from "@nextui-org/scroll-shadow";
import { Divider } from "@nextui-org/divider";
import { Chip } from "@nextui-org/chip";
import { Key, Link2, Info, X, ChevronDown, ChevronUp, ArrowRightCircle, Table2, Database, Zap, AlignJustify, Hash, CaseSensitive, Download } from 'lucide-react';
import { EntityProperty } from '@/utils/odata-helper';
import { EntityDetailsTable } from './EntityDetailsTable';
import { DiagramContext } from './DiagramContext';
import { DynamicHandleConfig } from './layout';
import { generateHashCode, getEntityTheme } from './utils';

// --------------------------------------------------------
// Component: EntityNode
// --------------------------------------------------------
export const EntityNode = React.memo(({ id, data, selected }: NodeProps) => {
  const updateNodeInternals = useUpdateNodeInternals();
  const { fitView, getNodes } = useReactFlow();
  const [isExpanded, setIsExpanded] = useState(false);
  const [activePopoverProp, setActivePopoverProp] = useState<string | null>(null);
  
  const { activeEntityIds, addActiveEntity, removeActiveEntity, switchActiveEntity } = useContext(DiagramContext);

  const showEntityDetails = activeEntityIds.includes(id);
  const isDark = data.isDark ?? true; // Get theme from data
  const isLightMode = !isDark;

  // Calculate distinct theme for the Entity
  const hashCode = Math.abs(generateHashCode(id));
  const theme = getEntityTheme(hashCode, isDark); // Changed: Pass isDark

  // 监听 Handles 变化
  const dynamicHandles: DynamicHandleConfig[] = data.dynamicHandles || [];
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, updateNodeInternals, JSON.stringify(dynamicHandles)]);

  useEffect(() => {
    const timer = setTimeout(() => updateNodeInternals(id), 50);
    return () => clearTimeout(timer);
  }, [isExpanded, id, updateNodeInternals]);

  const handleJumpToEntity = useCallback((targetEntityName: string, shouldOpenPopover: boolean = false) => {
    if (!targetEntityName) return;
    const safeTargetName = targetEntityName.trim();
    const nodes = getNodes();
    let targetNode = nodes.find(n => n.id === safeTargetName);
    if (!targetNode) {
        targetNode = nodes.find(n => n.id.toLowerCase() === safeTargetName.toLowerCase());
    }

    if (targetNode) {
      const targetId = targetNode.id;
      fitView({ nodes: [{ id: targetId }], padding: 0.5, duration: 800 });
      if (shouldOpenPopover) {
        switchActiveEntity(id, targetId);
      }
    }
  }, [getNodes, fitView, switchActiveEntity, id]);

  const handleExportCSV = () => {
    const headers = ['Name', 'Type', 'Nullable', 'MaxLength', 'Precision', 'Scale', 'Unicode', 'FixedLength', 'DefaultValue', 'ConcurrencyMode'];
    const rows = data.properties.map((p: EntityProperty) => [
      p.name, p.type, p.nullable, p.maxLength, p.precision, p.scale, p.unicode, p.fixedLength, p.defaultValue, p.concurrencyMode
    ].map((v: any) => v === undefined || v === null ? '' : String(v)));

    const csvContent = [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${data.label}_Schema.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getForeignKeyInfo = useCallback((propName: string) => {
    if (!data.navigationProperties) return null;
    for (const nav of data.navigationProperties) {
      if (nav.constraints) {
        const constraint = nav.constraints.find((c: any) => c.sourceProperty === propName);
        if (constraint) {
          let targetTypeClean = nav.targetType;
          if (targetTypeClean?.startsWith('Collection(')) targetTypeClean = targetTypeClean.slice(11, -1);
          targetTypeClean = targetTypeClean?.split('.').pop();
          return {
            targetEntity: targetTypeClean,
            targetProperty: constraint.targetProperty,
            navName: nav.name
          };
        }
      }
    }
    return null;
  }, [data.navigationProperties]);

  const visibleProperties = isExpanded ? data.properties : data.properties.slice(0, 12);
  const hiddenCount = data.properties.length - 12;

  // --- Dynamic Styles based on Theme ---
  const containerStyle = isDark 
    ? `bg-content1 border-divider shadow-sm rounded-lg border-2`
    : `border-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.15)] rounded-lg overflow-hidden`; 

  // In light mode, apply coordinated body color (Light) and border (Dark)
  const containerDynamicStyle = isLightMode 
    ? { backgroundColor: theme.body, borderColor: theme.border } 
    : {};

  const selectedStyle = isDark 
    ? `border-primary shadow-2xl ring-2 ring-primary/30`
    : `ring-2 ring-black scale-[1.02] transition-transform shadow-[6px_6px_0px_0px_rgba(0,0,0,0.2)]`;

  // Header: Use Theme Color in both modes for consistency
  // Dark Mode: Text is Theme Color, BG is faint Theme Color
  // Light Mode: Text is White, BG is Theme Color
  const headerStyle = isDark 
    ? { className: `border-b border-divider`, style: { color: theme.header, backgroundColor: `${theme.header}15` } }
    : { className: `text-white border-b border-black/10`, style: { backgroundColor: theme.header } };

  return (
    <div className="relative group" style={{ zIndex: showEntityDetails ? 2000 : undefined }}>
      {/* --- Main Node Card --- */}
      <div 
        className={`
          relative flex flex-col min-w-[240px] max-w-[300px] transition-all
          ${containerStyle}
          ${selected ? selectedStyle : ''}
        `}
        style={containerDynamicStyle}
      >
        {dynamicHandles.map((handle) => {
          const isVertical = handle.position === Position.Top || handle.position === Position.Bottom;
          const style: React.CSSProperties = {
            position: 'absolute',
            [isVertical ? 'left' : 'top']: `${handle.offset}%`,
            opacity: 0, 
            width: '12px', height: '12px',
            zIndex: 10,
          };
          if (handle.position === Position.Top) style.top = '-6px';
          if (handle.position === Position.Bottom) style.bottom = '-6px';
          if (handle.position === Position.Left) style.left = '-6px';
          if (handle.position === Position.Right) style.right = '-6px';
          return <Handle key={handle.id} id={handle.id} type={handle.type} position={handle.position} style={style} />;
        })}

        {/* --- Entity Title Header --- */}
        <div 
            className={`p-2 font-bold text-center text-sm flex items-center justify-center gap-2 group transition-colors ${headerStyle.className}`}
            style={headerStyle.style}
        >
          <Table2 size={14} className={isDark ? "" : "text-white"} style={isDark ? { color: theme.header } : {}} strokeWidth={isDark ? 2 : 3} />
          <span 
              className="hover:underline underline-offset-2 decoration-current cursor-pointer"
              onClick={(e) => { e.stopPropagation(); addActiveEntity(id); }}
          >
             {data.label}
          </span>
          <Info size={12} className="opacity-0 group-hover:opacity-80 transition-opacity" strokeWidth={isDark ? 2 : 3}/>
        </div>

        {/* --- Entity Content Area --- */}
        <div className={`p-2 flex flex-col gap-0.5 ${isDark ? 'bg-content1' : 'bg-transparent'}`}>
          {/* Properties */}
          {visibleProperties.map((prop: EntityProperty) => {
            const fieldColor = data.fieldColors?.[prop.name];
            const isKey = data.keys.includes(prop.name);
            const fkInfo = getForeignKeyInfo(prop.name);
            const isOpen = activePopoverProp === prop.name;

            // --- COLOR LOGIC ---
            // 1. Calculate FK Target Color
            let fkTargetColor = null;
            if (fkInfo?.targetEntity) {
                const fkHashCode = Math.abs(generateHashCode(fkInfo.targetEntity));
                fkTargetColor = getEntityTheme(fkHashCode, isDark).header; // Changed: Pass isDark
            }

            // 2. Determine Property Text Color
            // Priority: PK Color > FK Color > Default
            let propTextColor = undefined;
            if (isKey) {
                propTextColor = theme.header; // Use Current Entity Color
            } else if (fkTargetColor) {
                propTextColor = fkTargetColor; // Use Target Entity Color
            }

            // Light mode specific property styling
            let propContainerClass = "text-[10px] flex items-center justify-between p-1.5 rounded-sm border-l-2 transition-colors group ";
            let textClass = "";
            let metaClass = "";
            let rowStyle: React.CSSProperties = {};
            
            if (isDark) {
                propContainerClass += isKey ? 'font-semibold ' : 'text-default-600 ';
                // Dynamic background for PK/FK to match text color faintly
                if (isKey) {
                    rowStyle.backgroundColor = `${theme.header}10`; // Very faint background
                } else if (!fieldColor) {
                    propContainerClass += 'border-transparent';
                }
                
                metaClass = "text-default-400 opacity-70";
            } else {
                // Light Mode
                propContainerClass += "border-transparent hover:bg-black/5 "; 
                textClass = isKey ? "font-extrabold" : "font-medium";
                metaClass = "opacity-60";
            }

            // Override text color if we have a specific propTextColor (PK or FK)
            const finalTextColor = propTextColor || (isLightMode ? theme.text : undefined);
            
            // Apply field highlight color if exists (e.g. from hovering lines)
            if (fieldColor) {
                rowStyle.borderColor = fieldColor;
                rowStyle.backgroundColor = isDark ? `${fieldColor}15` : `${fieldColor}10`;
            }

            return (
              <div 
                key={prop.name} 
                className={propContainerClass}
                style={rowStyle}
              >
                <span className="flex items-center gap-1.5 truncate max-w-[140px]">
                  {/* Icons use the same color as the text */}
                  {isKey && <Key size={10} className="shrink-0" style={{ color: propTextColor }} strokeWidth={2.5} />}
                  {fkInfo && <Link2 size={10} className="shrink-0" style={{ color: propTextColor }} strokeWidth={2.5} />}
                  
                  <Popover placement="right" showArrow offset={10} isOpen={isOpen} onOpenChange={(open) => setActivePopoverProp(open ? prop.name : null)}>
                      <PopoverTrigger>
                          <span 
                              className={`cursor-pointer transition-colors hover:underline decoration-dotted ${!propTextColor && isDark ? 'hover:text-primary' : ''} ${textClass}`} 
                              style={{ 
                                  color: finalTextColor, 
                                  fontWeight: fieldColor || isKey ? 700 : 500 
                              }}
                              onClick={(e) => e.stopPropagation()}
                          >
                              {prop.name}
                          </span>
                      </PopoverTrigger>
                      <PopoverContent className={`p-3 w-[280px] ${!isDark ? "border-2" : ""}`} style={!isDark ? { borderColor: theme.border } : {}} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                          <div className="text-xs flex flex-col gap-3">
                              {/* ... Popover Content ... */}
                              <div className="font-bold flex items-center justify-between border-b border-divider pb-2">
                                  <span className="flex items-center gap-2 text-sm">
                                      {prop.name}
                                      {isKey && <Chip size="sm" color="warning" variant="flat" className="h-4 text-[9px] px-1">PK</Chip>}
                                      {fkInfo && <Chip size="sm" color="secondary" variant="flat" className="h-4 text-[9px] px-1">FK</Chip>}
                                  </span>
                              </div>
                              <div className="grid grid-cols-[60px_1fr] gap-x-2 gap-y-2 text-default-600">
                                  <span className="text-default-400">Type</span>
                                  <span className="font-mono bg-default-100 px-1 rounded w-fit">{prop.type}</span>
                                  <span className="text-default-400">Required</span>
                                  <span className={!prop.nullable ? "text-danger font-medium" : "text-default-500"}>
                                      {!prop.nullable ? 'Yes (Not Null)' : 'No (Nullable)'}
                                  </span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                  {prop.maxLength !== undefined && (
                                      <div className="flex flex-col bg-content2 p-1.5 rounded min-w-[50px] border border-divider">
                                          <span className="text-[9px] text-default-400 flex items-center gap-1"><AlignJustify size={10}/> MaxLen</span>
                                          <span className="font-mono font-bold">{prop.maxLength}</span>
                                      </div>
                                  )}
                              </div>
                          </div>
                      </PopoverContent>
                  </Popover>
                </span>
                <span 
                    className={`text-[9px] ml-1 font-mono ${metaClass}`}
                    style={isLightMode ? { color: theme.text } : {}}
                >
                    {prop.type.split('.').pop()}
                </span>
              </div>
            );
          })}

          {/* Expand/Collapse */}
          {!isExpanded && hiddenCount > 0 && (
              <div 
                  className={`text-[9px] cursor-pointer p-1 rounded text-center flex items-center justify-center gap-1 transition-colors mt-1 border border-dashed ${isDark ? "text-primary hover:bg-primary/5 hover:border-primary/50 border-divider" : "hover:bg-black/5 border-black/20"}`}
                  style={isLightMode ? { color: theme.header, borderColor: theme.header } : {}}
                  onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
              >
                  <ChevronDown size={10} />
                  <span>Show {hiddenCount} hidden properties</span>
              </div>
          )}
          {isExpanded && hiddenCount > 0 && (
              <div 
                  className={`text-[9px] cursor-pointer p-1 rounded text-center flex items-center justify-center gap-1 transition-colors mt-1 ${isDark ? "text-default-400 hover:bg-black/5" : "hover:bg-black/5"}`}
                  style={isLightMode ? { color: theme.text } : {}}
                  onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
              >
                  <ChevronUp size={10} />
                  <span>Collapse properties</span>
              </div>
          )}

          {/* Navigation Properties */}
          {data.navigationProperties && data.navigationProperties.length > 0 && (
              <div className={`mt-2 pt-2 ${isDark ? "border-t border-divider/50" : "border-t border-black/5"}`}>
                  <div 
                    className={`text-[9px] font-bold mb-1.5 px-1 uppercase tracking-wider flex items-center gap-2 ${isDark ? "text-default-500" : ""}`}
                    style={isLightMode ? { color: theme.text, opacity: 0.8 } : {}}
                  >
                      <span>Navigation</span>
                      <div className={`h-px flex-1 ${isDark ? "bg-divider" : "bg-black/10"}`}></div>
                  </div>
                  <div 
                    className={`rounded-md p-1 flex flex-col gap-1 ${isDark ? 'bg-secondary/10 border border-secondary/10' : 'bg-transparent border border-black/5'}`}
                    style={isLightMode ? { backgroundColor: theme.nav } : {}}
                  >
                      {data.navigationProperties.slice(0, 8).map((nav: any) => {
                          const cleanType = nav.targetType?.replace('Collection(', '').replace(')', '').split('.').pop() || '';
                          
                          // Calculate target entity color for Nav Item
                          const targetHashCode = Math.abs(generateHashCode(cleanType));
                          const targetTheme = getEntityTheme(targetHashCode, isDark); // Changed: Pass isDark
                          const targetColor = targetTheme.header;

                          return (
                              <div 
                                  key={nav.name} 
                                  className={`group flex items-center justify-start gap-2 p-1.5 rounded-sm transition-all cursor-pointer ${isDark ? "hover:bg-content1 bg-content1/50 border-transparent hover:border-secondary/20" : "hover:bg-white/40 bg-white/20 border border-transparent hover:shadow-sm"}`}
                                  onClick={(e) => { e.stopPropagation(); handleJumpToEntity(cleanType, false); }}
                                  title={`Jump to ${cleanType}`}
                              >
                                  <span className="flex items-center gap-1.5 truncate w-full">
                                      <ArrowRightCircle 
                                        size={10} 
                                        className={`shrink-0 transition-opacity opacity-70 group-hover:opacity-100`} 
                                        style={{ color: targetColor }} 
                                      />
                                      <span 
                                        className="font-medium text-[10px]" 
                                        style={{ color: targetColor }}
                                      >
                                        {nav.name}
                                      </span>
                                  </span>
                              </div>
                          );
                      })}
                      {data.navigationProperties.length > 8 && (
                          <div className={`text-[9px] text-center pt-1 italic ${isDark ? "text-default-400" : ""}`} style={isLightMode ? { color: theme.text, opacity: 0.6 } : {}}>
                              + {data.navigationProperties.length - 8} more relations
                          </div>
                      )}
                  </div>
              </div>
          )}
        </div>
      </div>

      {/* --- ATTACHED DETAILS TABLE (Popout) --- */}
      {showEntityDetails && (
        <div 
            className="absolute left-[100%] top-0 ml-5 w-[850px] cursor-default z-[2000] animate-appearance-in nodrag nowheel"
            onMouseDown={() => addActiveEntity(id)}
            onClick={(e) => e.stopPropagation()}
        >
            <div className={`bg-content1 rounded-lg border border-divider overflow-hidden flex flex-col max-h-[600px] ${isDark ? 'shadow-2xl ring-1 ring-black/5' : 'shadow-[8px_8px_0px_0px_rgba(0,0,0,0.15)] border-2'}`} style={isLightMode ? { borderColor: theme.header } : {}}>
                <div 
                    className={`flex justify-between items-center p-3 border-b border-divider shrink-0 ${isDark ? 'bg-default-100' : 'text-white'}`}
                    style={isLightMode ? { backgroundColor: theme.header, borderColor: theme.header } : {}}
                >
                    <div className="flex items-center gap-3 font-bold text-sm text-inherit">
                        <Database size={18} className={isDark ? "text-primary" : "text-white"} />
                        {data.label}
                        <span className={`text-xs font-normal px-1.5 rounded border ${isDark ? "text-default-500 bg-white border-divider" : "text-white/80 bg-white/20 border-white/30"}`}>{data.namespace}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button size="sm" variant={isDark ? "flat" : "solid"} className={isLightMode ? "bg-white/20 text-white hover:bg-white/30" : ""} color="primary" onPress={handleExportCSV} startContent={<Download size={14} />}>
                            Export CSV
                        </Button>
                        <Button isIconOnly size="sm" variant="light" className={isLightMode ? "text-white hover:bg-white/20" : ""} onPress={() => removeActiveEntity(id)}>
                            <X size={18} />
                        </Button>
                    </div>
                </div>
                
                <ScrollShadow 
                    className={`flex-1 overflow-auto ${isDark ? "bg-content1" : ""}`} 
                    style={isLightMode ? { backgroundColor: theme.body } : {}}
                    size={10}
                >
                        <EntityDetailsTable 
                            properties={data.properties} 
                            keys={data.keys} 
                            getFkInfo={getForeignKeyInfo}
                            onJumpToEntity={(name) => handleJumpToEntity(name, true)}
                            onFocus={() => addActiveEntity(id)} 
                            themeBody={isLightMode ? theme.body : undefined}
                            themeNav={isLightMode ? theme.nav : undefined}
                        />
                </ScrollShadow>
                
                <div 
                    className={`bg-default-50 p-2 text-xs text-default-500 text-center border-t border-divider shrink-0 flex justify-between px-4 ${isLightMode ? '' : ''}`}
                    style={isLightMode ? { backgroundColor: theme.nav, color: theme.text, borderColor: theme.border } : {}}
                >
                    <span>{data.properties.length} Properties</span>
                    <span>{data.navigationProperties?.length || 0} Relations</span>
                </div>
            </div>
        </div>
      )}
    </div>
  );
});
