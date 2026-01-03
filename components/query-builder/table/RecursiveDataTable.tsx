
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { 
    ChevronUp, ChevronDown, GripVertical
} from 'lucide-react';
import { 
    useReactTable, 
    getCoreRowModel, 
    getSortedRowModel, 
    getExpandedRowModel,
    flexRender, 
    SortingState,
    ColumnOrderState,
    RowSelectionState,
    ExpandedState
} from '@tanstack/react-table';

import { isExpandableData, updateRecursiveSelection } from './utils';
import { exportToExcel } from './excel-export';
import { ExpandedRowView } from './ExpandedRowView';
import { ParsedSchema } from '@/utils/odata-helper';
import { TableHeader } from './TableHeader';
import { useTableColumns } from './useTableColumns';
import { useToast } from '@/components/ui/ToastContext';
import { TableContext, TableContextType, GetUpdatesFn, UpdateResult, useTableContext } from './TableContext';

interface RecursiveDataTableProps {
    data: any[];
    isDark: boolean;
    isRoot?: boolean; 
    onDelete?: (selectedRows: any[]) => void; 
    onUpdate?: (updates: { item: any, changes: any }[]) => void;
    onCreate?: (selectedRows: any[]) => void; // 新增：Create Callback
    onExport?: () => void;
    loading?: boolean;
    parentSelected?: boolean; 
    entityName?: string;
    schema?: ParsedSchema | null;
    enableEdit?: boolean; // 新增：控制是否允许编辑
    enableDelete?: boolean; // 新增：控制是否允许删除
    hideUpdateButton?: boolean; // 新增：在编辑模式下隐藏更新按钮 (用于 Mock Data)
    onDraftChange?: (draft: Record<number, Record<string, any>>) => void; // 新增：Draft 变更回调
    externalIsEditing?: boolean; // 新增：外部控制的编辑状态
}

export const RecursiveDataTable: React.FC<RecursiveDataTableProps> = ({ 
    data, 
    isDark, 
    isRoot = false, 
    onDelete, 
    onUpdate,
    onCreate,
    onExport, 
    loading = false,
    parentSelected = false,
    entityName = 'Main',
    schema,
    enableEdit = true,
    enableDelete = true,
    hideUpdateButton = false,
    onDraftChange,
    externalIsEditing
}) => {
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(() => {
        if (typeof window !== 'undefined') return Math.max(600, window.innerWidth - 100);
        return 1000;
    });

    // --- Toast ---
    const toast = useToast();

    // --- Table State ---
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({}); 
    const [expanded, setExpanded] = useState<ExpandedState>({});
    const [draggingColumn, setDraggingColumn] = useState<string | null>(null);

    // --- Editing State ---
    const [isEditing, setIsEditing] = useState(false);
    const [editDraft, setEditDraft] = useState<Record<number, Record<string, any>>>({});

    // --- Context for Recursive Updates ---
    const parentContext = useTableContext();
    const tableId = useMemo(() => Math.random().toString(36).substr(2, 9), []);
    // Only Root maintains the registry
    const registryRef = useRef<Map<string, GetUpdatesFn>>(new Map());

    // --- 1. 初始化及同步选中状态 ---
    useEffect(() => {
        const newSelection: RowSelectionState = {};
        data.forEach((row, index) => {
            if (row['__selected'] === true) {
                newSelection[index] = true;
            }
        });
        setRowSelection(newSelection);
        
        // Fix: 只有在非外部控制模式下，才因数据变更重置编辑状态。
        // 如果 externalIsEditing 有值 (无论是 true 还是 false)，说明父级在控制，
        // 此时不要因为 parentSelected 变化 (导致 data 引用变化) 而重置子表状态。
        if (externalIsEditing === undefined) {
            setEditDraft({});
            onDraftChange?.({});
            setIsEditing(false);
        }
    }, [data, parentSelected, externalIsEditing]);

    // 同步外部编辑状态
    useEffect(() => {
        if (externalIsEditing !== undefined) {
            setIsEditing(externalIsEditing);
            // 只有当明确关闭编辑模式时，才清理草稿
            if (!externalIsEditing) {
                setEditDraft({});
                onDraftChange?.({});
            }
        }
    }, [externalIsEditing]);

    // 监听容器宽度变化
    useEffect(() => {
        if (!tableContainerRef.current) return;
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                if (entry.contentRect.width > 0) setContainerWidth(entry.contentRect.width);
            }
        });
        observer.observe(tableContainerRef.current);
        return () => observer.disconnect();
    }, []);

    // --- Schema Analysis ---
    const { pkSet, fkSet, fkInfoMap, schemaProperties, navPropSet } = useMemo(() => {
        const pkSet = new Set<string>();
        const fkSet = new Set<string>();
        const navPropSet = new Set<string>();
        const fkInfoMap = new Map<string, string>(); 
        const schemaProperties: Record<string, any> = {};

        if (schema && entityName && schema.entities) {
            let entityType = schema.entities.find(e => e.name === entityName);
            // 尝试模糊匹配或查找 EntitySet 对应的 Type
            if (!entityType) {
                const es = schema.entitySets.find(s => s.name === entityName);
                if (es) {
                    const typeName = es.entityType.split('.').pop();
                    entityType = schema.entities.find(e => e.name === typeName);
                }
            }
            if (!entityType) {
                 entityType = schema.entities.find(e => entityName.startsWith(e.name));
            }

            if (entityType) {
                entityType.keys.forEach(k => pkSet.add(k));
                entityType.properties.forEach(p => {
                    schemaProperties[p.name] = p;
                });
                entityType.navigationProperties.forEach(nav => {
                    navPropSet.add(nav.name);
                    if (nav.constraints) {
                        nav.constraints.forEach(c => {
                            fkSet.add(c.sourceProperty);
                            let target = nav.targetType || "Entity";
                            if (target.startsWith('Collection(')) target = target.slice(11, -1);
                            target = target.split('.').pop() || target;
                            fkInfoMap.set(c.sourceProperty, target);
                        });
                    }
                });
            }
        }
        return { pkSet, fkSet, fkInfoMap, schemaProperties, navPropSet };
    }, [schema, entityName]);

    // --- Helper: Get Local Updates ---
    const getLocalUpdates = useCallback((): UpdateResult[] => {
        const updates: UpdateResult[] = [];
        const changedIndices = Object.keys(editDraft).map(Number);
        
        changedIndices.forEach(idx => {
            // Check row selection (handle both number and string keys)
            // 修改点：这里的逻辑确保了只收集“被勾选”的行的修改
            const isSelected = rowSelection[idx] === true || rowSelection[String(idx)] === true;

            if (isSelected) {
                const originalItem = data[idx];
                const changes = editDraft[idx];
                
                const realChanges: any = {};
                let hasChanges = false;
                Object.entries(changes).forEach(([key, newVal]) => {
                    // Loose equality check to handle string vs number inputs
                    if (originalItem[key] != newVal) {
                        realChanges[key] = newVal;
                        hasChanges = true;
                    }
                });

                if (hasChanges) {
                    updates.push({ item: originalItem, changes: realChanges });
                }
            }
        });
        return updates;
    }, [editDraft, rowSelection, data]);

    // --- Register to Parent Context (if Sub-Table) ---
    useEffect(() => {
        if (!isRoot && parentContext) {
            parentContext.register(tableId, getLocalUpdates);
            return () => parentContext.unregister(tableId);
        }
    }, [isRoot, parentContext, tableId, getLocalUpdates]);

    // --- Edit Handlers (Root Only mostly) ---
    const handleStartEdit = () => {
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditDraft({});
        onDraftChange?.({});
    };

    const handleConfirmUpdate = () => {
        if (!onUpdate) {
            console.error("No onUpdate handler provided");
            return;
        }
        
        // 1. Get Root Updates
        const allUpdates: UpdateResult[] = [...getLocalUpdates()];

        // 2. Get Children Updates (if Root)
        if (isRoot) {
            registryRef.current.forEach(getUpdatesFn => {
                allUpdates.push(...getUpdatesFn());
            });
        }

        if (allUpdates.length === 0) {
             // 简单的检查，如果真的有输入但没勾选，给提示
             const hasDrafts = Object.keys(editDraft).length > 0; 
             if (hasDrafts) {
                 toast.warning("检测到修改，但未选中对应行。\n请勾选修改过的行再点击更新。\n(Changes detected but rows not selected. Please select modified rows.)");
             } else {
                 toast.info("未检测到任何实质性修改 (No changes detected)");
             }
             return;
        }

        onUpdate(allUpdates);
    };

    const handleInputChange = (rowIndex: number, columnId: string, value: any) => {
        setEditDraft(prev => {
            const next = {
                ...prev,
                [rowIndex]: {
                    ...(prev[rowIndex] || {}),
                    [columnId]: value
                }
            };
            if (onDraftChange) onDraftChange(next);
            return next;
        });
        
        // 自动选中正在修改的行 (Auto-select row on edit)
        if (!rowSelection[rowIndex] && !rowSelection[String(rowIndex)]) {
            setRowSelection(prev => ({ ...prev, [rowIndex]: true }));
            updateRecursiveSelection(data[rowIndex], true);
        }
    };

    // --- Columns Definition (Use Hook) ---
    const columns = useTableColumns({
        data,
        containerWidth,
        pkSet,
        fkSet,
        fkInfoMap,
        navPropSet
    });

    // Sync column order
    useEffect(() => {
        if (columns.length > 0) {
            setColumnOrder(prev => {
                 const newOrder = columns.map(c => c.id as string);
                 return newOrder;
            });
        }
    }, [columns]); 

    const safeColumnOrder = useMemo(() => {
        const validIds = new Set(columns.map(c => c.id));
        return columnOrder.filter(id => validIds.has(id));
    }, [columnOrder, columns]);

    const table = useReactTable({
        data,
        columns,
        meta: {
            editDraft,
            handleInputChange,
            isEditing,
            schemaProperties,
            pkSet
        },
        state: { 
            sorting, 
            columnOrder: safeColumnOrder,
            rowSelection, 
            expanded 
        },
        enableRowSelection: true, 
        enableExpanding: true,
        getRowCanExpand: row => {
            const keys = Object.keys(row.original);
            return keys.some(k => k !== '__metadata' && k !== '__selected' && isExpandableData(row.original[k]));
        },
        onExpandedChange: setExpanded,
        onRowSelectionChange: setRowSelection,
        onSortingChange: setSorting,
        onColumnOrderChange: setColumnOrder,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        enableColumnResizing: true,
        columnResizeMode: 'onChange',
    });

    const handleExport = () => {
        exportToExcel(data, entityName, toast);
    };

    const handleDeleteClick = () => {
        const selectedRows = data.filter(r => r['__selected'] === true);
        if (onDelete) {
            onDelete(selectedRows);
        }
    };

    // 处理新增点击：合并修改草稿
    const handleCreateClick = () => {
        const selectedRowsWithEdits: any[] = [];
        
        data.forEach((row, idx) => {
            // Check if selected using the mutation marker
            if (row['__selected'] === true) {
                const draft = editDraft[idx];
                if (draft) {
                    // Merge edits into original row for creation payload
                    selectedRowsWithEdits.push({ ...row, ...draft });
                } else {
                    selectedRowsWithEdits.push(row);
                }
            }
        });

        if (onCreate) {
            onCreate(selectedRowsWithEdits);
        }
    };

    // --- Provider Logic (If Root) ---
    const contextValue: TableContextType = useMemo(() => ({
        register: (id, getUpdates) => {
            registryRef.current.set(id, getUpdates);
        },
        unregister: (id) => {
            registryRef.current.delete(id);
        }
    }), []);

    const tableContent = (
        <div className="h-full flex flex-col bg-content1 overflow-hidden">
            <TableHeader 
                isRoot={isRoot}
                isEditing={isEditing}
                onStartEdit={handleStartEdit}
                onCancelEdit={handleCancelEdit}
                onConfirmUpdate={handleConfirmUpdate}
                onDelete={handleDeleteClick}
                onExport={handleExport}
                onCreate={onCreate ? handleCreateClick : undefined}
                enableEdit={enableEdit}
                enableDelete={enableDelete}
                hideUpdateButton={hideUpdateButton}
            />

            <div className="overflow-auto flex-1 w-full bg-content1 scrollbar-thin" ref={tableContainerRef}>
                <table 
                    className="w-full text-left border-collapse table-fixed"
                    style={{ width: table.getTotalSize() }}
                >
                    <thead className="sticky top-0 z-20 bg-default-50/90 backdrop-blur-md shadow-sm border-b border-divider">
                        {table.getHeaderGroups().map(headerGroup => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map(header => (
                                    <th 
                                        key={header.id} 
                                        className="relative p-2 py-3 text-xs font-bold text-default-600 select-none group border-r border-divider/10 hover:bg-default-100 transition-colors"
                                        style={{ width: header.getSize() }}
                                        draggable={!header.isPlaceholder && !['expander', 'select', 'index'].includes(header.id)}
                                        onDragStart={(e) => {
                                            if (['expander', 'select', 'index'].includes(header.id)) return;
                                            setDraggingColumn(header.column.id);
                                            e.dataTransfer.effectAllowed = 'move';
                                            e.currentTarget.style.opacity = '0.5';
                                        }}
                                        onDragEnd={(e) => {
                                            e.currentTarget.style.opacity = '1';
                                            setDraggingColumn(null);
                                        }}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            if (draggingColumn && draggingColumn !== header.column.id && !['expander', 'select', 'index'].includes(header.id)) {
                                                const newOrder = [...columnOrder];
                                                const dragIndex = newOrder.indexOf(draggingColumn);
                                                const dropIndex = newOrder.indexOf(header.column.id);
                                                if (dragIndex !== -1 && dropIndex !== -1) {
                                                    newOrder.splice(dragIndex, 1);
                                                    newOrder.splice(dropIndex, 0, draggingColumn);
                                                    setColumnOrder(newOrder);
                                                }
                                            }
                                        }}
                                    >
                                        <div className="flex items-center gap-1 w-full overflow-hidden justify-center">
                                            {!['expander', 'select', 'index'].includes(header.id) && (
                                                <GripVertical size={12} className="text-default-300 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity shrink-0 absolute left-1" />
                                            )}
                                            {['expander', 'select', 'index'].includes(header.id) ? (
                                                <div className="flex items-center justify-center w-full">
                                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                                </div>
                                            ) : (
                                                <div 
                                                    className="flex items-center gap-1 cursor-pointer flex-1 overflow-hidden pl-4"
                                                    onClick={header.column.getToggleSortingHandler()}
                                                >
                                                    <span className="truncate" title={header.column.id}>
                                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                                    </span>
                                                    {{
                                                        asc: <ChevronUp size={12} className="text-primary shrink-0" />,
                                                        desc: <ChevronDown size={12} className="text-primary shrink-0" />,
                                                    }[header.column.getIsSorted() as string] ?? null}
                                                </div>
                                            )}
                                        </div>
                                        {header.column.getCanResize() && (
                                            <div
                                                onMouseDown={header.getResizeHandler()}
                                                onTouchStart={header.getResizeHandler()}
                                                className={`absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none hover:bg-primary/50 transition-colors z-10 ${
                                                    header.column.getIsResizing() ? 'bg-primary w-1' : 'bg-transparent'
                                                }`}
                                            />
                                        )}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {table.getRowModel().rows.map((row, idx) => (
                            <React.Fragment key={row.id}>
                                <tr 
                                    className={`
                                        border-b border-divider/40 last:border-0 transition-colors
                                        hover:bg-primary/5
                                        ${row.getIsSelected() ? 'bg-primary/10' : (idx % 2 === 0 ? 'bg-transparent' : 'bg-default-50/30')}
                                        ${row.getIsExpanded() ? 'bg-default-100 border-b-0' : ''}
                                    `}
                                >
                                    {row.getVisibleCells().map(cell => (
                                        <td 
                                            key={cell.id} 
                                            className="p-2 text-sm text-default-700 align-middle overflow-hidden border-r border-divider/10 last:border-0"
                                            style={{ width: cell.column.getSize() }}
                                        >
                                            <div className="w-full">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </div>
                                        </td>
                                    ))}
                                </tr>
                                {row.getIsExpanded() && (
                                    <tr className="bg-default-50/50">
                                        <td colSpan={row.getVisibleCells().length} className="p-0 border-b border-divider">
                                            <ExpandedRowView 
                                                rowData={row.original} 
                                                isDark={isDark} 
                                                parentSelected={row.getIsSelected()} 
                                                schema={schema} 
                                                parentEntityName={entityName}
                                                onUpdate={onUpdate}
                                                isEditing={isEditing} // Pass current editing state to expanded view
                                            />
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
                
                {data.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center h-40 text-default-400">
                        <p>暂无数据</p>
                    </div>
                )}
            </div>
        </div>
    );

    // If Root, Wrap in Provider to manage updates for all descendants.
    if (isRoot) {
        return (
            <TableContext.Provider value={contextValue}>
                {tableContent}
            </TableContext.Provider>
        );
    }

    return tableContent;
};
