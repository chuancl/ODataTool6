
import React from 'react';
import { Button } from "@nextui-org/button";
import { Switch } from "@nextui-org/switch";
import { Zap, FileCode, Network } from 'lucide-react';

interface ControlPanelProps {
    isDark: boolean;
    showXml: boolean;
    setShowXml: (show: boolean) => void;
    isPerformanceMode: boolean;
    setIsPerformanceMode: (mode: boolean) => void;
    onResetView: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
    isDark,
    showXml,
    setShowXml,
    isPerformanceMode,
    setIsPerformanceMode,
    onResetView
}) => {
    return (
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
                        onPress={onResetView}
                    >
                        重置视图
                    </Button>
                </>
            )}
        </div>
    );
};
