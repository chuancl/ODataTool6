
import React, { useMemo } from 'react';
import { Button } from "@nextui-org/button";
import { FileCode, Download, Copy } from 'lucide-react';
import xmlFormat from 'xml-formatter';
import CodeMirror from '@uiw/react-codemirror';
import { xml } from '@codemirror/lang-xml';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { githubLight } from '@uiw/codemirror-theme-github';

interface XmlViewerProps {
    xmlContent?: string;
    isDark: boolean;
}

export const XmlViewer: React.FC<XmlViewerProps> = ({ xmlContent, isDark }) => {
    const editorTheme = isDark ? vscodeDark : githubLight;

    const formattedXml = useMemo(() => {
        if (!xmlContent) return '';
        try {
            return xmlFormat(xmlContent, {
                indentation: '  ',
                filter: (node) => node.type !== 'Comment',
                collapseContent: true,
                lineSeparator: '\n'
            });
        } catch (e) {
            return xmlContent;
        }
    }, [xmlContent]);

    const handleDownloadXml = () => {
        if (!formattedXml) return;
        const blob = new Blob([formattedXml], { type: 'application/xml' });
        const u = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = u; link.download = 'metadata.xml';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(u);
    };
  
    const handleCopyXml = () => {
        if (formattedXml) navigator.clipboard.writeText(formattedXml);
    };

    return (
        <div className="w-full h-full absolute inset-0 bg-content1 z-0 flex flex-col">
            <div className="p-2 border-b border-divider flex items-center gap-4 bg-content2/50 backdrop-blur-md shrink-0">
               <span className="text-xs font-bold text-default-500 px-2 flex items-center gap-2">
                   <FileCode size={14}/> Metadata.xml
               </span>
               <div className="flex gap-1">
                   <Button isIconOnly size="sm" variant="light" onPress={handleDownloadXml} title="下载 XML"><Download size={14}/></Button>
                   <Button isIconOnly size="sm" variant="light" onPress={handleCopyXml} title="复制 XML"><Copy size={14}/></Button>
               </div>
            </div>
            
            <div className="flex-1 overflow-hidden relative text-sm">
               <CodeMirror
                  value={formattedXml || '<!-- No XML Content Available -->'}
                  height="100%"
                  className="h-full [&_.cm-scroller]:overflow-scroll"
                  extensions={[xml()]}
                  theme={editorTheme}
                  readOnly={true}
                  editable={false}
                  basicSetup={{
                      lineNumbers: true,
                      foldGutter: true,
                      highlightActiveLine: true
                  }}
              />
            </div>
        </div>
    );
};
