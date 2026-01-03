
import React, { useMemo, useState, useEffect } from 'react';
import { Select, SelectItem } from "@nextui-org/select";
import { Chip } from "@nextui-org/chip";
import { Tooltip } from "@nextui-org/tooltip";
import { ChevronRight, ChevronDown, AlertTriangle } from 'lucide-react';
import { 
    ALL_STRATEGIES, 
    getGroupedStrategies, 
    isStrategyCompatible,
    MockStrategy
} from './mock-utils';

interface StrategySelectProps {
    value: string;
    onChange: (value: string) => void;
    odataType: string;
    label?: string;
}

interface FlatItem {
    key: string;
    type: 'category' | 'strategy';
    label: string;
    value: string;
    isCompatible: boolean;
    level: number;
    isExpanded?: boolean;
    strategy?: MockStrategy; // 为了获取 fakerModule/Method
}

export const StrategySelect: React.FC<StrategySelectProps> = ({ value, onChange, odataType, label }) => {
    const selectedStrategy = useMemo(() => ALL_STRATEGIES.find(s => s.value === value), [value]);

    // 优化：默认仅展开 Custom 和当前选中项所属的分类。移除 'Person' 默认展开以减少列表长度，帮助准确定位。
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
        const defaults = new Set(['Custom (自定义)']);
        if (selectedStrategy) {
            defaults.add(selectedStrategy.category);
        }
        return defaults;
    });

    // 当 value 变化时（例如重置或自动匹配），同步更新 expandedCategories 状态
    useEffect(() => {
        if (selectedStrategy && !expandedCategories.has(selectedStrategy.category)) {
            setExpandedCategories(prev => {
                const next = new Set(prev);
                next.add(selectedStrategy.category);
                return next;
            });
        }
    }, [selectedStrategy]); // 依赖 selectedStrategy 对象引用变化

    const grouped = useMemo(() => getGroupedStrategies(), []);
    
    // 构造扁平化列表 (用于 Select items)
    const flatItems = useMemo(() => {
        const items: FlatItem[] = [];
        
        // 排序 Categories (Custom first, then alphabetical)
        const categories = Object.keys(grouped).sort((a, b) => {
            if (a.startsWith('Custom')) return -1;
            if (b.startsWith('Custom')) return 1;
            return a.localeCompare(b);
        });

        categories.forEach(cat => {
            // 关键修正：如果当前选中的策略属于该分类，强制视为展开。
            // 这样能保证在 Select 初次渲染时，选中的 Item 一定存在于列表中，从而让 NextUI 正确计算 Scroll 位置。
            const isSelectedCategory = selectedStrategy?.category === cat;
            const isExpanded = expandedCategories.has(cat) || isSelectedCategory;

            items.push({
                key: `CAT_${cat}`,
                type: 'category',
                label: cat,
                value: `CAT_${cat}`, 
                isCompatible: true,
                level: 0,
                isExpanded
            });

            if (isExpanded) {
                grouped[cat].forEach(strat => {
                    items.push({
                        key: strat.value,
                        type: 'strategy',
                        label: strat.label,
                        value: strat.value,
                        isCompatible: isStrategyCompatible(strat.value, odataType),
                        level: 1,
                        strategy: strat
                    });
                });
            }
        });

        return items;
    }, [grouped, expandedCategories, odataType, selectedStrategy]);

    const isCurrentCompatible = selectedStrategy ? isStrategyCompatible(value, odataType) : true;

    // Memoize selected keys specifically to ensure stability for NextUI
    const selectedKeys = useMemo(() => {
        return selectedStrategy ? new Set([selectedStrategy.value]) : new Set([]);
    }, [selectedStrategy]);

    const toggleCategory = (catName: string) => {
        // 如果该分类包含当前选中项，则不允许折叠 (保持可见性)
        if (selectedStrategy?.category === catName) return;

        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(catName)) next.delete(catName);
            else next.add(catName);
            return next;
        });
    };

    return (
        <Select 
            aria-label={label || "Select Strategy"}
            size="sm" 
            variant="faded" 
            selectedKeys={selectedKeys}
            onSelectionChange={(keys) => {
                const k = Array.from(keys)[0] as string;
                if (k && !k.startsWith('CAT_')) onChange(k);
            }}
            selectionMode="single"
            disallowEmptySelection
            classNames={{ 
                trigger: "h-8 min-h-8 px-2", 
                value: `text-[11px] ${!isCurrentCompatible ? 'text-warning-600 font-medium' : ''}` 
            }}
            items={flatItems}
            renderValue={() => {
                if (!selectedStrategy) return <span>Select...</span>;
                return (
                    <div className="flex items-center gap-1">
                        {!isCurrentCompatible && <AlertTriangle size={12} className="text-warning" />}
                        <span>{selectedStrategy.label}</span>
                    </div>
                );
            }}
        >
            {(item) => {
                if (item.type === 'category') {
                    // 如果该分类包含当前选中项，禁用折叠交互样式
                    const isForcedOpen = selectedStrategy?.category === item.label;

                    return (
                        <SelectItem 
                            key={item.key} 
                            textValue={item.label}
                            className="font-bold text-default-600 bg-default-50 sticky top-0 z-10 p-0 rounded-none border-b border-divider/50 data-[hover=true]:bg-default-100 outline-none"
                            isReadOnly
                        >
                            <div 
                                className={`flex items-center gap-2 w-full h-full py-2 px-3 ${isForcedOpen ? 'cursor-default opacity-80' : 'cursor-pointer'}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleCategory(item.label);
                                }}
                            >
                                <div className="text-default-400">
                                    {/* 如果强制展开，显示固定图标或不显示折叠状态 */}
                                    {item.isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                                </div>
                                <span className="text-[11px] uppercase tracking-wider select-none">{item.label}</span>
                                {isForcedOpen && <span className="text-[9px] text-default-400 ml-auto font-normal lowercase">(active)</span>}
                            </div>
                        </SelectItem>
                    );
                }
                
                // 构建 Tooltip 内容
                const tooltipContent = item.strategy?.type === 'faker' 
                    ? `faker.${item.strategy.fakerModule}.${item.strategy.fakerMethod}()`
                    : (item.strategy?.type === 'custom.increment' 
                        ? 'Auto-incrementing number/string (e.g. 1, 2, 3...)'
                        : 'Fixed value logic');

                return (
                    <SelectItem key={item.key} value={item.key} textValue={item.label}>
                         <Tooltip 
                            content={<span className="font-mono text-[10px]">{tooltipContent}</span>} 
                            placement="right" 
                            delay={300}
                            closeDelay={0}
                        >
                            <div className="flex justify-between items-center w-full gap-2 pl-6">
                                <span className={`text-[11px] ${!item.isCompatible ? 'text-default-400 line-through decoration-default-300' : ''}`}>
                                    {item.label}
                                </span>
                                {!item.isCompatible && (
                                    <Chip size="sm" color="warning" variant="flat" className="h-4 text-[9px] px-1 min-w-min">
                                        Type mismatch
                                    </Chip>
                                )}
                            </div>
                        </Tooltip>
                    </SelectItem>
                );
            }}
        </Select>
    );
};
