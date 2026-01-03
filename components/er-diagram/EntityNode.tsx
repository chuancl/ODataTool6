
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
import { generateHashCode, getColor } from './utils';

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

  // Calculate distinct color for Light Mode header
  const hashCode = Math.abs(generateHashCode(id));
  const headerColorBold = getColor(hashCode, true); // Get Bold/Warm color

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
    // Light Mode: Use a warm background (Amber-50/Orange-50 equivalent) instead of white
    : `bg-[#FFF9E6] border-black border-2 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-lg`;

  const selectedStyle = isDark 
    ? `border-primary shadow-2xl ring-2 ring-primary/30`
    : `ring-2 ring-black scale-[1.02] transition-transform`;

  const headerStyle = isDark 
    ? { className: `bg-primary/10 text-primary border-b border-divider` }
    : { className: `text-white border-b-2 border-black`, style: { backgroundColor: headerColorBold, textShadow: '1px 1px 0 #000' } };

  return (
    <div className="relative group" style={{ zIndex: showEntityDetails ? 2000 : undefined }}>
      {/* --- Main Node Card --- */}
      <div 
        className={`
          relative flex flex-col min-w-[240px] max-w-[300px] transition-all
          ${containerStyle}
          ${selected ? selectedStyle : ''}
        `}
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
            className={`p-2 font-bold text-center text-sm rounded-t-[calc(0.5rem-2px)] flex items-center justify-center gap-2 group transition-colors ${headerStyle.className}`}
            style={headerStyle.style}
        >
          <Table2 size={14} className={isDark ? "" : "text-white"} strokeWidth={isDark ? 2 : 3} />
          <span 
              className="hover:underline underline-offset-2 decoration-current cursor-pointer"
              onClick={(e) => { e.stopPropagation(); addActiveEntity(id); }}
          >
             {data.label}
          </span>
          <Info size={12} className="opacity-0 group-hover:opacity-80 transition-opacity" strokeWidth={isDark ? 2 : 3}/>
        </div>

        {/* --- Entity Content Area --- */}
        <div className={`p-2 flex flex-col gap-0.5 rounded-b-[calc(0.5rem-2px)] ${isDark ? 'bg-content1' : 'bg-transparent'}`}>
          {/* Properties */}
          {visibleProperties.map((prop: EntityProperty) => {
            const fieldColor = data.fieldColors?.[prop.name];
            const isKey = data.keys.includes(prop.name);
            const fkInfo = getForeignKeyInfo(prop.name);
            const isOpen = activePopoverProp === prop.name;

            // Light mode specific property styling
            let propContainerClass = "text-[10px] flex items-center justify-between p-1.5 rounded-sm border-l-2 transition-colors group ";
            
            if (isDark) {
                propContainerClass += isKey ? 'bg-warning/10 text-warning-700 font-semibold ' : 'text-default-600 ';
                if (!fieldColor) propContainerClass += 'border-transparent';
            } else {
                // Light Mode
                // Hover effect: Darken slightly
                propContainerClass += "border-transparent hover:bg-black/5 "; 
                propContainerClass += isKey ? 'text-black font-extrabold ' : 'text-gray-900 font-medium ';
            }

            return (
              <div 
                key={prop.name} 
                className={propContainerClass}
                style={fieldColor ? { borderColor: fieldColor, backgroundColor: isDark ? `${fieldColor}15` : `${fieldColor}10` } : {}}
              >
                <span className="flex items-center gap-1.5 truncate max-w-[140px]">
                  {isKey && <Key size={10} className="shrink-0 text-amber-500" fill={!isDark ? "currentColor" : "none"} />}
                  {fkInfo && <Link2 size={10} className="shrink-0 text-blue-500" strokeWidth={2.5} />}
                  
                  <Popover placement="right" showArrow offset={10} isOpen={isOpen} onOpenChange={(open) => setActivePopoverProp(open ? prop.name : null)}>
                      <PopoverTrigger>
                          <span 
                              className={`cursor-pointer transition-colors hover:underline decoration-dotted ${isDark ? 'hover:text-primary' : 'hover:text-blue-700'}`} 
                              style={fieldColor ? { color: fieldColor, fontWeight: 700 } : {}}
                              onClick={(e) => e.stopPropagation()}
                          >
                              {prop.name}
                          </span>
                      </PopoverTrigger>
                      <PopoverContent className={`p-3 w-[280px] ${!isDark ? "border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" : ""}`} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                          <div className="text-xs flex flex-col gap-3">
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
                                  {prop.defaultValue && (
                                      <>
                                          <span className="text-default-400">Default</span>
                                          <span className="font-mono bg-default-50 px-1 rounded border border-default-200">{prop.defaultValue}</span>
                                      </>
                                  )}
                              </div>
                              <Divider className="opacity-50"/>
                              <div className="flex flex-wrap gap-2">
                                  {prop.maxLength !== undefined && (
                                      <div className="flex flex-col bg-content2 p-1.5 rounded min-w-[50px] border border-divider">
                                          <span className="text-[9px] text-default-400 flex items-center gap-1"><AlignJustify size={10}/> MaxLen</span>
                                          <span className="font-mono font-bold">{prop.maxLength}</span>
                                      </div>
                                  )}
                                  {(prop.precision !== undefined || prop.scale !== undefined) && (
                                      <div className="flex flex-col bg-content2 p-1.5 rounded min-w-[50px] border border-divider">
                                          <span className="text-[9px] text-default-400 flex items-center gap-1"><Hash size={10}/> Scale</span>
                                          <span className="font-mono font-bold">{prop.precision || '-'}/{prop.scale || '-'}</span>
                                      </div>
                                  )}
                                  {prop.fixedLength && (
                                      <div className="flex flex-col bg-default-100 p-1.5 rounded min-w-[50px] border border-divider">
                                          <span className="text-[9px] text-default-400 flex items-center gap-1"><AlignJustify size={10}/> Fixed</span>
                                          <span className="font-bold text-default-700 text-[10px]">Yes</span>
                                      </div>
                                  )}
                                  <div className="flex flex-col bg-default-100 p-1.5 rounded min-w-[50px] border border-divider">
                                      <span className="text-[9px] text-default-400 flex items-center gap-1"><CaseSensitive size={10}/> Unicode</span>
                                      <span className={`font-bold text-[10px] ${prop.unicode === false ? 'text-warning-700' : 'text-primary'}`}>
                                          {prop.unicode === false ? 'False (ANSI)' : 'True'}
                                      </span>
                                  </div>
                                  {prop.concurrencyMode && (
                                      <div className="flex flex-col bg-warning/10 p-1.5 rounded min-w-[50px] border border-warning/20">
                                          <span className="text-[9px] text-warning-600 flex items-center gap-1"><Zap size={10}/> Mode</span>
                                          <span className="font-bold text-warning-800 text-[10px]">{prop.concurrencyMode}</span>
                                      </div>
                                  )}
                              </div>
                              {fkInfo && (
                                  <div className="bg-secondary/10 p-2 rounded border border-secondary/20 mt-1 cursor-pointer hover:bg-secondary/20 transition-colors"
                                      onClick={(e) => { 
                                          e.stopPropagation(); 
                                          setActivePopoverProp(null); 
                                          handleJumpToEntity(fkInfo.targetEntity, false); 
                                      }}
                                  >
                                      <div className="text-[10px] text-secondary font-bold mb-1 flex items-center gap-1">
                                          <Link2 size={10} /> Foreign Key Relation
                                      </div>
                                      <div className="grid grid-cols-[40px_1fr] gap-1 text-[10px]">
                                          <span className="opacity-70">To:</span> <span className="font-bold">{fkInfo.targetEntity}</span>
                                          <span className="opacity-70">Field:</span> <span className="font-mono">{fkInfo.targetProperty}</span>
                                          <span className="opacity-70">Via:</span> <span className="italic opacity-80">{fkInfo.navName}</span>
                                      </div>
                                  </div>
                              )}
                          </div>
                      </PopoverContent>
                  </Popover>
                </span>
                <span className="text-[9px] text-default-400 ml-1 opacity-70 font-mono">{prop.type.split('.').pop()}</span>
              </div>
            );
          })}

          {/* Expand/Collapse */}
          {!isExpanded && hiddenCount > 0 && (
              <div 
                  className={`text-[9px] cursor-pointer p-1 rounded text-center flex items-center justify-center gap-1 transition-colors mt-1 border border-dashed border-divider ${isDark ? "text-primary hover:bg-primary/5 hover:border-primary/50" : "text-blue-600 font-bold hover:bg-blue-50 border-blue-200"}`}
                  onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
              >
                  <ChevronDown size={10} />
                  <span>Show {hiddenCount} hidden properties</span>
              </div>
          )}
          {isExpanded && hiddenCount > 0 && (
              <div 
                  className="text-[9px] text-default-400 cursor-pointer hover:bg-default-100 p-1 rounded text-center flex items-center justify-center gap-1 transition-colors mt-1"
                  onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
              >
                  <ChevronUp size={10} />
                  <span>Collapse properties</span>
              </div>
          )}

          {/* Navigation Properties */}
          {data.navigationProperties && data.navigationProperties.length > 0 && (
              <div className="mt-2 pt-2 border-t border-divider/50">
                  <div className="text-[9px] font-bold text-default-400 mb-1.5 px-1 uppercase tracking-wider flex items-center gap-2">
                      <span>Navigation</span>
                      <div className="h-px bg-divider flex-1"></div>
                  </div>
                  <div className={`rounded-md p-1 flex flex-col gap-1 ${isDark ? 'bg-secondary/10 border border-secondary/10' : 'bg-[#FFECB3] border border-orange-200'}`}>
                      {data.navigationProperties.slice(0, 8).map((nav: any) => {
                          const cleanType = nav.targetType?.replace('Collection(', '').replace(')', '').split('.').pop();
                          return (
                              <div 
                                  key={nav.name} 
                                  className={`group flex items-center justify-start gap-2 p-1.5 rounded-sm transition-all cursor-pointer ${isDark ? "hover:bg-content1 bg-content1/50 border-transparent hover:border-secondary/20 text-secondary-700" : "hover:bg-white bg-white/50 border border-transparent hover:border-orange-300 text-orange-900 font-medium hover:shadow-sm"}`}
                                  onClick={(e) => { e.stopPropagation(); handleJumpToEntity(cleanType, false); }}
                                  title={`Jump to ${cleanType}`}
                              >
                                  <span className="flex items-center gap-1.5 truncate w-full">
                                      <ArrowRightCircle size={10} className={`shrink-0 transition-opacity ${isDark ? "text-secondary opacity-70 group-hover:opacity-100" : "text-orange-700 opacity-100"}`} />
                                      <span className="font-medium text-[10px]">{nav.name}</span>
                                  </span>
                              </div>
                          );
                      })}
                      {data.navigationProperties.length > 8 && (
                          <div className="text-[9px] text-default-400 text-center pt-1 italic">
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
            <div className={`bg-content1 rounded-lg border border-divider overflow-hidden flex flex-col max-h-[600px] ${isDark ? 'shadow-2xl ring-1 ring-black/5' : 'shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-2 border-black'}`}>
                <div 
                    className={`flex justify-between items-center p-3 border-b border-divider shrink-0 ${isDark ? 'bg-default-100' : 'bg-white border-b-2 border-black'}`}
                >
                    <div className="flex items-center gap-3 font-bold text-default-700 text-sm">
                        <Database size={18} className={isDark ? "text-primary" : "text-black"} />
                        {data.label}
                        <span className="text-xs font-normal text-default-500 bg-white px-1.5 rounded border border-divider">{data.namespace}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button size="sm" variant={isDark ? "flat" : "solid"} color="primary" onPress={handleExportCSV} startContent={<Download size={14} />} className={!isDark ? "bg-black text-white font-bold" : ""}>
                            Export CSV
                        </Button>
                        <Button isIconOnly size="sm" variant="light" onPress={() => removeActiveEntity(id)}>
                            <X size={18} />
                        </Button>
                    </div>
                </div>
                
                <ScrollShadow className="flex-1 overflow-auto bg-content1" size={10}>
                        <EntityDetailsTable 
                            properties={data.properties} 
                            keys={data.keys} 
                            getFkInfo={getForeignKeyInfo}
                            onJumpToEntity={(name) => handleJumpToEntity(name, true)}
                            onFocus={() => addActiveEntity(id)} 
                        />
                </ScrollShadow>
                
                <div className={`bg-default-50 p-2 text-xs text-default-500 text-center border-t border-divider shrink-0 flex justify-between px-4 ${!isDark ? 'border-t-2 border-black font-bold text-black bg-gray-100' : ''}`}>
                    <span>{data.properties.length} Properties</span>
                    <span>{data.navigationProperties?.length || 0} Relations</span>
                </div>
            </div>
        </div>
      )}
    </div>
  );
});
