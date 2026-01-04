
import React from 'react';
import { Input } from "@nextui-org/input";
import { Button } from "@nextui-org/button";
import { Chip } from "@nextui-org/chip";
import { Copy, Play } from 'lucide-react';

interface UrlBarProps {
    isDark: boolean;
    generatedUrl: string;
    setGeneratedUrl: (url: string) => void;
    loading: boolean;
    onRun: () => void;
    onCopyCode: () => void;
}

export const UrlBar: React.FC<UrlBarProps> = ({ isDark, generatedUrl, setGeneratedUrl, loading, onRun, onCopyCode }) => {
    const containerClass = isDark
        ? "bg-content2 border border-divider"
        : "bg-white/80 backdrop-blur-md border border-white/40 shadow-sm";

    return (
        <div className={`flex gap-2 items-center p-2 rounded-lg shrink-0 transition-all ${containerClass}`}>
            <Chip size="sm" color="primary" variant={isDark ? "flat" : "solid"} className="shrink-0">GET</Chip>
            <Input
                value={generatedUrl}
                onValueChange={setGeneratedUrl}
                size="sm"
                variant="flat"
                className="font-mono text-sm"
                classNames={{ 
                    inputWrapper: isDark ? "bg-transparent shadow-none" : "bg-default-100/50 hover:bg-default-200/50 shadow-none"
                }}
            />
            <Button isIconOnly size="sm" variant="light" onPress={onCopyCode} title="复制 SAPUI5 代码">
                <Copy size={16} />
            </Button>
            <Button color="primary" size="sm" onPress={onRun} isLoading={loading} startContent={<Play size={16} />} className={isDark ? "" : "shadow-md shadow-primary/30"}>
                运行查询
            </Button>
        </div>
    );
};
