
import React, { useMemo, useState } from 'react';
import { EntityProperty } from '@/utils/odata-helper';
import { Key, Link2, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { useReactTable, getCoreRowModel, getSortedRowModel, flexRender, createColumnHelper, SortingState, ColumnOrderState } from '@tanstack/react-table';

export const EntityDetailsTable = ({ 
    properties, 
    keys, 
    getFkInfo,
    onJumpToEntity,
    onFocus,
    themeBody,
    themeNav,
    isDark = false // Add isDark prop
}: { 
    properties: EntityProperty[], 
    keys: string[], 
    getFkInfo: (name: string) => any,
    onJumpToEntity: (name: string) => void,
    onFocus?: () => void,
    themeBody?: string,
    themeNav?: string,
    isDark?: boolean
}) => {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(['name', 'type', 'size', 'attributes', 'defaultValue', 'relation']);
    const [draggingColumn, setDraggingColumn] = useState<string | null>(null);

    const columnHelper = createColumnHelper<EntityProperty>();

    const columns = useMemo(() => [
        // 1. Name Column
        columnHelper.accessor('name', {
            id: 'name',
            header: 'Field',
            enableSorting: true,
            minSize: 110,
            cell: info => {
                const isKey = keys.includes(info.getValue());
                return (
                    <div className="flex items-center gap-2">
                        {isKey ? <Key size={14} className={isDark ? "text-[#e5c07b] shrink-0" : "text-warning shrink-0"} /> : <div className="w-3.5" />}
                        <span className={`${isKey ? "font-bold" : ""} text-xs ${isDark ? (isKey ? "text-[#e5c07b]" : "text-[#abb2bf]") : (isKey ? "text-foreground" : "text-default-700")}`}>
                            {info.getValue()}
                        </span>
                    </div>
                );
            }
        }),

        // 2. Type Column
        columnHelper.accessor('type', {
            id: 'type',
            header: 'Type',
            enableSorting: true,
            size: 100,
            cell: info => <span className={`font-mono text-xs ${isDark ? "text-[#c678dd]" : "text-primary/80"}`}>{info.getValue().split('.').pop()}</span>
        }),

        // 3. Size/Precision Column
        columnHelper.accessor(row => row.maxLength || row.precision || 0, {
            id: 'size',
            header: 'Size',
            enableSorting: true,
            size: 70,
            cell: info => {
                const p = info.row.original;
                const textColor = isDark ? "text-[#5c6370]" : "text-default-500";
                if (p.maxLength) return <span className={`font-mono text-xs ${textColor}`}>{p.maxLength}</span>;
                if (p.precision) return <span className={`font-mono text-xs ${textColor}`}>{p.precision}{p.scale !== undefined ? `,${p.scale}` : ''}</span>;
                return <span className={`text-xs ${isDark ? "text-[#5c6370]/50" : "text-default-300"}`}>-</span>;
            }
        }),

        // 4. Attributes Column
        columnHelper.accessor(row => `${row.nullable}${row.unicode}${row.fixedLength}${row.concurrencyMode}`, {
            id: 'attributes',
            header: 'Attributes',
            enableSorting: false, 
            size: 180,
            cell: info => {
                const p = info.row.original;
                return (
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Nullable status */}
                        {!p.nullable && (
                            <span title="Field is Required (Not Null)" className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-semibold border ${isDark ? "bg-[#e06c75]/10 text-[#e06c75] border-[#e06c75]/20" : "bg-danger/10 text-danger border-danger/20"}`}>Required</span>
                        )}
                        
                        {/* Fixed Length */}
                        {p.fixedLength && (
                             <span title="Fixed Length String/Binary" className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium border ${isDark ? "bg-[#abb2bf]/10 text-[#abb2bf] border-[#abb2bf]/20" : "bg-default-100 text-default-600 border-default-200"}`}>Fixed Length</span>
                        )}

                        {/* Unicode Status */}
                        {p.unicode === false ? (
                             <span title="Non-Unicode (ANSI)" className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium border ${isDark ? "bg-[#d19a66]/10 text-[#d19a66] border-[#d19a66]/20" : "bg-warning/10 text-warning-700 border-warning/20"}`}>Non-Unicode</span>
                        ) : (
                             <span title="Unicode Enabled" className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium border ${isDark ? "bg-[#56b6c2]/10 text-[#56b6c2] border-[#56b6c2]/20" : "bg-primary/5 text-primary/70 border-primary/10"}`}>Unicode</span>
                        )}

                        {/* Concurrency */}
                        {p.concurrencyMode === 'Fixed' && (
                            <span title="Optimistic Concurrency Control" className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium border ${isDark ? "bg-[#98c379]/10 text-[#98c379] border-[#98c379]/20" : "bg-success/10 text-success-700 border-success/20"}`}>Concurrency</span>
                        )}
                    </div>
                );
            }
        }),

        // 5. Default Value
        columnHelper.accessor('defaultValue', {
            id: 'defaultValue',
            header: 'Default',
            enableSorting: true,
            size: 90,
            cell: info => info.getValue() ? 
                <span className={`font-mono text-xs px-1 rounded border max-w-[80px] truncate block ${isDark ? "bg-[#21252b] text-[#98c379] border-[#3e4451]" : "bg-default-50 text-default-600 border-default-100"}`} title={info.getValue()}>{info.getValue()}</span> : 
                <span className={`text-xs ${isDark ? "text-[#5c6370]/50" : "text-default-200"}`}>-</span>
        }),

        // 6. Relation Column
        columnHelper.display({
            id: 'relation',
            header: 'Relation',
            size: 200,
            cell: info => {
                const fk = getFkInfo(info.row.original.name);
                if (!fk) return null;
                return (
                    <div className="flex items-center gap-1 text-xs w-full group">
                        <Link2 size={12} className={isDark ? "text-[#61afef] shrink-0" : "text-secondary shrink-0"} />
                        <div className="flex items-center gap-0.5 overflow-hidden">
                            <span 
                                className={`font-bold cursor-pointer hover:underline truncate ${isDark ? "text-[#61afef]" : "text-secondary hover:text-secondary-600"}`} 
                                // STRATEGY: 
                                // 1. Stop propagation on MouseDown. This prevents the Root 'onMouseDown' (which triggers Z-index update) 
                                //    from firing immediately. This PROTECTS the link click from being killed by a re-render race condition.
                                onMouseDown={(e) => e.stopPropagation()}
                                // 2. Handle Jump AND manually trigger Z-index update (onFocus) on Click.
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    onFocus?.(); 
                                    onJumpToEntity(fk.targetEntity); 
                                }}
                                title={`Jump to Entity: ${fk.targetEntity}`}
                            >
                                {fk.targetEntity}
                            </span>
                            <span className={isDark ? "text-[#5c6370]" : "text-default-400"}>.</span>
                            <span className={`font-mono truncate ${isDark ? "text-[#98c379]" : "text-default-600"}`} title={`Target Field: ${fk.targetProperty}`}>{fk.targetProperty}</span>
                        </div>
                    </div>
                );
            }
        })

    ], [keys, getFkInfo, onJumpToEntity, onFocus, isDark]);

    const table = useReactTable({
        data: properties,
        columns,
        state: { sorting, columnOrder },
        onSortingChange: setSorting,
        onColumnOrderChange: setColumnOrder,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        enableColumnResizing: true,
        columnResizeMode: 'onChange',
    });

    // Dark Mode Colors
    const darkHeaderBg = '#21252b';
    const darkBorder = '#3e4451';
    const darkHover = '#2c313a';
    const darkText = '#abb2bf';
    const darkMuted = '#5c6370';

    return (
        <div className="w-full h-full flex flex-col" style={!isDark && themeBody ? { backgroundColor: themeBody } : {}}>
            <table className="w-full text-left border-collapse table-fixed">
                <thead 
                    className={`sticky top-0 z-20 backdrop-blur-md shadow-sm border-b ${isDark ? '' : (themeBody ? '' : 'bg-default-50/90')}`}
                    style={
                        isDark 
                        ? { backgroundColor: darkHeaderBg, borderColor: darkBorder, color: darkText } 
                        : (themeNav ? { backgroundColor: themeNav } : (themeBody ? { backgroundColor: themeBody, backgroundImage: 'linear-gradient(rgba(0,0,0,0.05), rgba(0,0,0,0.05))' } : {}))
                    }
                >
                    {table.getHeaderGroups().map(headerGroup => (
                        <tr key={headerGroup.id}>
                            {headerGroup.headers.map(header => (
                                <th 
                                    key={header.id} 
                                    className={`relative p-2 py-3 text-xs font-bold uppercase tracking-wider select-none group border-r transition-colors ${
                                        isDark 
                                        ? 'text-[#5c6370] border-[#3e4451] hover:bg-[#2c313a]' 
                                        : `text-default-600 border-divider/10 ${themeBody ? 'hover:bg-black/5' : 'hover:bg-default-100'}`
                                    }`}
                                    style={{ width: header.getSize() }}
                                    draggable={!header.isPlaceholder}
                                    onDragStart={(e) => {
                                        setDraggingColumn(header.column.id);
                                        e.dataTransfer.effectAllowed = 'move';
                                    }}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        if (draggingColumn && draggingColumn !== header.column.id) {
                                            const newOrder = [...columnOrder];
                                            const dragIndex = newOrder.indexOf(draggingColumn);
                                            const dropIndex = newOrder.indexOf(header.column.id);
                                            if (dragIndex !== -1 && dropIndex !== -1) {
                                                newOrder.splice(dragIndex, 1);
                                                newOrder.splice(dropIndex, 0, draggingColumn);
                                                setColumnOrder(newOrder);
                                            }
                                            setDraggingColumn(null);
                                        }
                                    }}
                                >
                                    <div className="flex items-center gap-1 w-full">
                                        <GripVertical 
                                            size={12} 
                                            className={`${isDark ? 'text-[#5c6370]' : 'text-default-300'} cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity`} 
                                        />
                                        
                                        <div 
                                            className="flex items-center gap-1 cursor-pointer flex-1 overflow-hidden"
                                            onClick={header.column.getToggleSortingHandler()}
                                        >
                                            <span className="truncate">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                                            {{
                                                asc: <ChevronUp size={12} className={isDark ? "text-[#61afef]" : "text-primary"} shrink-0 />,
                                                desc: <ChevronDown size={12} className={isDark ? "text-[#61afef]" : "text-primary"} shrink-0 />,
                                            }[header.column.getIsSorted() as string] ?? null}
                                        </div>
                                    </div>
                                    
                                    {/* Resizer Handle */}
                                    <div
                                        onMouseDown={header.getResizeHandler()}
                                        onTouchStart={header.getResizeHandler()}
                                        className={`absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none ${
                                            header.column.getIsResizing() 
                                            ? (isDark ? 'bg-[#61afef] w-1.5' : 'bg-primary w-1.5') 
                                            : 'bg-transparent hover:bg-primary/50'
                                        }`}
                                    />
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody>
                    {table.getRowModel().rows.map((row, idx) => (
                        <tr 
                            key={row.id} 
                            className={`
                                border-b last:border-0 transition-colors
                                ${isDark 
                                    ? `border-[#3e4451] hover:bg-[#2c313a] ${idx % 2 === 0 ? 'bg-transparent' : 'bg-[#21252b]/30'}`
                                    : `border-divider/40 ${themeBody ? 'hover:bg-black/5' : 'hover:bg-primary/5'} ${idx % 2 === 0 ? 'bg-transparent' : (themeBody ? 'bg-black/5' : 'bg-default-50/30')}`
                                }
                            `}
                        >
                            {row.getVisibleCells().map(cell => (
                                <td key={cell.id} className={`p-2 text-xs h-10 border-r last:border-r-0 align-middle overflow-hidden text-ellipsis ${isDark ? 'border-[#3e4451]' : 'border-divider/20'}`}>
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {properties.length === 0 && <div className={`p-8 text-center text-sm ${isDark ? "text-[#5c6370]" : "text-default-400"}`}>No properties found for this entity.</div>}
        </div>
    );
};
