
import React, { useState, useEffect } from 'react';
import { Button } from "@nextui-org/button";
import { Chip } from "@nextui-org/chip";
import { Tabs, Tab } from "@nextui-org/tabs";
import { 
    Table as TableIcon, Braces, Download, Copy, FileCode, AlertCircle
} from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { githubLight } from '@uiw/codemirror-theme-github';
import { RecursiveDataTable } from './table/RecursiveDataTable';
import { ParsedSchema } from '@/utils/odata-helper';

interface ResultTabsProps {
    queryResult: any[];
    rawJsonResult: string;
    rawXmlResult: string;
    loading: boolean;
    isDark: boolean;
    onDelete: (selectedRows: any[]) => void;
    onUpdate?: (updates: { item: any, changes: any }[]) => void;
    onExport: () => void;
    downloadFile: (content: string, filename: string, type: 'json' | 'xml') => void;
    entityName?: string; 
    schema: ParsedSchema | null;
    // New Props
    onCreate?: (selectedRows: any[]) => void;
    enableEdit?: boolean;
    enableDelete?: boolean;
    hideUpdateButton?: boolean;
    hideXmlTab?: boolean; // 新增：控制 XML Tab 显隐
    onDraftChange?: (draft: Record<number, Record<string, any>>) => void; // 新增：传递 draft 回调
    // JSON Editing Props
    enableJsonEdit?: boolean;
    onJsonChange?: (data: any[]) => void;
}

export const ResultTabs: React.FC<ResultTabsProps> = ({
    queryResult, rawJsonResult, rawXmlResult, loading, isDark,
    onDelete, onUpdate, onExport, downloadFile, entityName, schema,
    onCreate, enableEdit, enableDelete, hideUpdateButton,
    hideXmlTab = false,
    onDraftChange,
    enableJsonEdit = false,
    onJsonChange
}) => {
    const editorTheme = isDark ? vscodeDark : githubLight;
    
    // Manage active tab state locally
    const [activeTab, setActiveTab] = useState<string>('table');

    // --- JSON Editing Logic ---
    const [jsonValue, setJsonValue] = useState(rawJsonResult);
    const [isJsonFocused, setIsJsonFocused] = useState(false);
    const [jsonError, setJsonError] = useState<string | null>(null);

    // Sync from prop ONLY when not focused (to prevent overwriting user typing with auto-formatted JSON)
    useEffect(() => {
        if (!isJsonFocused) {
            setJsonValue(rawJsonResult);
            setJsonError(null);
        }
    }, [rawJsonResult, isJsonFocused]);

    const handleJsonEditorChange = (val: string) => {
        setJsonValue(val);
        // Clear error while typing
        if (jsonError) setJsonError(null);
    };

    const handleJsonBlur = () => {
        setIsJsonFocused(false);
        if (enableJsonEdit && onJsonChange) {
            try {
                const parsed = JSON.parse(jsonValue);
                if (Array.isArray(parsed)) {
                    onJsonChange(parsed);
                    setJsonError(null);
                } else {
                    // console.warn("JSON edit must be an array");
                    // Optionally keep the error if strict array requirement is needed
                }
            } catch (e: any) {
                setJsonError("Invalid JSON");
            }
        }
    };

    return (
        <div className="flex-1 min-h-0 bg-content1 rounded-xl border border-divider overflow-hidden flex flex-col shadow-sm">
            {/* Navigation Tabs (Controller) */}
            <Tabs
                aria-label="Result Options"
                color="primary"
                variant="underlined"
                selectedKey={activeTab}
                onSelectionChange={(k) => setActiveTab(k as string)}
                classNames={{
                    tabList: "gap-6 w-full relative rounded-none p-0 border-b border-divider px-4 bg-default-100",
                    cursor: "w-full bg-primary",
                    tab: "max-w-fit px-2 h-10 text-sm",
                    tabContent: "group-data-[selected=true]:font-bold",
                    panel: "hidden" // Hide default logic
                }}
            >
                <Tab key="table" title={
                    <div className="flex items-center space-x-2">
                        <TableIcon size={14} />
                        <span>表格预览</span>
                        <Chip size="sm" variant="flat" className="h-4 text-[10px] px-1 ml-1">{queryResult.length}</Chip>
                    </div>
                } />
                <Tab key="json" title={
                    <div className="flex items-center space-x-2">
                        <Braces size={14} />
                        <span>JSON 预览</span>
                        {enableJsonEdit && <Chip size="sm" color="warning" variant="dot" className="h-4 text-[10px] border-0">Editable</Chip>}
                    </div>
                } />
                {!hideXmlTab && <Tab key="xml" title={
                    <div className="flex items-center space-x-2">
                        <FileCode size={14} />
                        <span>XML 预览</span>
                    </div>
                } />}
            </Tabs>

            {/* Content Area (Keep-Alive) */}
            <div className="flex-1 p-0 overflow-hidden h-full flex flex-col relative">
                
                {/* 1. Table View */}
                <div className="absolute inset-0 flex flex-col" style={{ display: activeTab === 'table' ? 'flex' : 'none', visibility: activeTab === 'table' ? 'visible' : 'hidden' }}>
                    <RecursiveDataTable 
                        data={queryResult} 
                        isDark={isDark}
                        isRoot={true}
                        onDelete={onDelete}
                        onUpdate={onUpdate}
                        onExport={onExport}
                        loading={loading}
                        entityName={entityName}
                        schema={schema} 
                        onCreate={onCreate}
                        enableEdit={enableEdit}
                        enableDelete={enableDelete}
                        hideUpdateButton={hideUpdateButton}
                        onDraftChange={onDraftChange}
                    />
                </div>

                {/* 2. JSON Preview */}
                <div className="absolute inset-0 flex flex-col" style={{ display: activeTab === 'json' ? 'flex' : 'none', visibility: activeTab === 'json' ? 'visible' : 'hidden' }}>
                    <div className="p-2 border-b border-divider flex justify-between items-center shrink-0 bg-content2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold px-2 text-warning-500">
                                {enableJsonEdit ? "JSON 编辑 (Blur to Sync)" : "JSON 响应结果"}
                            </span>
                            {jsonError && (
                                <span className="text-xs text-danger flex items-center gap-1 bg-danger/10 px-2 rounded">
                                    <AlertCircle size={12}/> {jsonError}
                                </span>
                            )}
                        </div>
                        <div className="flex gap-1">
                            <Button isIconOnly size="sm" variant="light" onPress={() => downloadFile(jsonValue, 'result.json', 'json')} title="导出 JSON">
                                <Download size={14} />
                            </Button>
                            <Button isIconOnly size="sm" variant="light" onPress={() => navigator.clipboard.writeText(jsonValue)} title="复制 JSON">
                                <Copy size={14} />
                            </Button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden relative text-sm">
                        <CodeMirror
                            value={jsonValue || '// 请先生成数据'}
                            height="100%"
                            className="h-full [&_.cm-scroller]:overflow-scroll"
                            extensions={[json()]}
                            theme={editorTheme}
                            readOnly={!enableJsonEdit}
                            editable={enableJsonEdit}
                            onChange={handleJsonEditorChange}
                            onFocus={() => setIsJsonFocused(true)}
                            onBlur={handleJsonBlur}
                            basicSetup={{
                                lineNumbers: true,
                                foldGutter: true,
                                highlightActiveLine: false
                            }}
                        />
                    </div>
                </div>

                {/* 3. XML Preview */}
                {!hideXmlTab && (
                    <div className="absolute inset-0 flex flex-col" style={{ display: activeTab === 'xml' ? 'flex' : 'none', visibility: activeTab === 'xml' ? 'visible' : 'hidden' }}>
                        <div className="p-2 border-b border-divider flex justify-between items-center shrink-0 bg-content2">
                            <span className="text-xs font-bold px-2 text-primary-500">XML / Atom 响应结果</span>
                            <div className="flex gap-1">
                                <Button isIconOnly size="sm" variant="light" onPress={() => downloadFile(rawXmlResult, 'result.xml', 'xml')} title="导出 XML">
                                    <Download size={14} />
                                </Button>
                                <Button isIconOnly size="sm" variant="light" onPress={() => navigator.clipboard.writeText(rawXmlResult)} title="复制 XML">
                                    <Copy size={14} />
                                </Button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden relative text-sm">
                            <CodeMirror
                                value={rawXmlResult || '// 请先运行查询以获取结果'}
                                height="100%"
                                className="h-full [&_.cm-scroller]:overflow-scroll"
                                extensions={[xml()]}
                                theme={editorTheme}
                                readOnly={true}
                                editable={false}
                                basicSetup={{
                                    lineNumbers: true,
                                    foldGutter: true,
                                    highlightActiveLine: false
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};