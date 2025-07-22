import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
  CHECK_LIST,
  ELEMENT_TRANSFORMERS,
  MULTILINE_ELEMENT_TRANSFORMERS,
  TEXT_FORMAT_TRANSFORMERS,
  TEXT_MATCH_TRANSFORMERS,
} from '@lexical/markdown';
import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { ListItemNode, ListNode } from '@lexical/list';
import { OverflowNode } from '@lexical/overflow';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import { ParagraphNode, TextNode, EditorState, LexicalEditor } from 'lexical';

import { ContentEditable } from '@/registry/new-york-v4/editor/editor-ui/content-editable';
import { TweetNode } from '@/registry/new-york-v4/editor/nodes/embeds/tweet-node';
import { EmojiNode } from '@/registry/new-york-v4/editor/nodes/emoji-node';
import { EquationNode } from '@/registry/new-york-v4/editor/nodes/equation-node';
import { ImageNode } from '@/registry/new-york-v4/editor/nodes/image-node';
import { TwitterPlugin } from '@/registry/new-york-v4/editor/plugins/embeds/twitter-plugin';
import { EmojisPlugin } from '@/registry/new-york-v4/editor/plugins/emojis-plugin';
import { EquationsPlugin } from '@/registry/new-york-v4/editor/plugins/equations-plugin';
import { ImagesPlugin } from '@/registry/new-york-v4/editor/plugins/images-plugin';
import { TableActionMenuPlugin } from '@/registry/new-york-v4/editor/plugins/table-action-menu-plugin';
import { TableCellResizerPlugin } from '@/registry/new-york-v4/editor/plugins/table-cell-resizer-plugin';
import { TableHoverActionsPlugin } from '@/registry/new-york-v4/editor/plugins/table-hover-actions-plugin';
import { editorTheme } from '@/registry/new-york-v4/editor/themes/editor-theme';
import { EMOJI } from '@/registry/new-york-v4/editor/transformers/markdown-emoji-transformer';
import { EQUATION } from '@/registry/new-york-v4/editor/transformers/markdown-equation-transformer';
import { HR } from '@/registry/new-york-v4/editor/transformers/markdown-hr-transformer';
import { IMAGE } from '@/registry/new-york-v4/editor/transformers/markdown-image-transformer';
import { TABLE } from '@/registry/new-york-v4/editor/transformers/markdown-table-transformer';
import { TWEET } from '@/registry/new-york-v4/editor/transformers/markdown-tweet-transformer';
import { TooltipProvider } from '@/components/ui/tooltip';

export function sanitizeNotePath(input: string): string {
  let p = input.replace(/[^a-zA-Z0-9\-_./]/g, '');
  p = p.replace(/^\.+/, '').replace(/^\/+/, '');
  if (!p.endsWith('.md')) p += '.md';
  return p;
}

interface NoteEditorProps {
  notePath: string;
}

function NoteEditor({ notePath }: NoteEditorProps) {
  const [markdown, setMarkdown] = useState('');

  useEffect(() => {
    window.electronAPI.readNote(notePath).then(setMarkdown);
  }, [notePath]);

  const onChange = (state: any, editor: any) => {
    state.read(() => {
      const md = $convertToMarkdownString(TRANSFORMERS);
      window.electronAPI.writeNote(notePath, md);
    });
  };

  const editorConfig: any = {
    namespace: 'Editor',
    theme: editorTheme,
    editorState: () => $convertFromMarkdownString(markdown, TRANSFORMERS),
    nodes: [
      HeadingNode,
      ParagraphNode,
      TextNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      LinkNode,
      OverflowNode,
      TableNode,
      TableCellNode,
      TableRowNode,
      CodeNode,
      CodeHighlightNode,
      HorizontalRuleNode,
      ImageNode,
      EmojiNode,
      EquationNode,
      AutoLinkNode,
      TweetNode,
    ],
    onError: (error: Error) => {
      console.error(error);
    },
  };

  const placeholder = 'Start typing...';

  const Plugins = () => {
    const [floatingAnchorElem, setFloatingAnchorElem] = useState(null as any);
    const onRef = (_elem: HTMLDivElement) => {
      if (_elem !== null) {
        setFloatingAnchorElem(_elem);
      }
    };

    return (
      <div className="relative">
        <RichTextPlugin
          contentEditable={
            <div className="">
              <div className="" ref={onRef}>
                <ContentEditable
                  placeholder={placeholder}
                  className="ContentEditable__root relative block h-72 min-h-72 min-h-full overflow-auto px-8 py-4 focus:outline-none"
                />
              </div>
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <TablePlugin />
        <TableCellResizerPlugin />
        <TableHoverActionsPlugin anchorElem={floatingAnchorElem} />
        <TableActionMenuPlugin anchorElem={floatingAnchorElem} cellMerge={true} />
        <HorizontalRulePlugin />
        <ImagesPlugin />
        <EmojisPlugin />
        <EquationsPlugin />
        <TwitterPlugin />
        <CheckListPlugin />
        <ListPlugin />
        <MarkdownShortcutPlugin
          transformers={[
            TABLE,
            HR,
            IMAGE,
            EMOJI,
            EQUATION,
            TWEET,
            CHECK_LIST,
            ...ELEMENT_TRANSFORMERS,
            ...MULTILINE_ELEMENT_TRANSFORMERS,
            ...TEXT_FORMAT_TRANSFORMERS,
            ...TEXT_MATCH_TRANSFORMERS,
          ]}
        />
        <OnChangePlugin onChange={onChange} />
      </div>
    );
  };

  return (
    <div className="bg-background w-full h-full overflow-hidden rounded-lg border">
      <LexicalComposer initialConfig={{ ...editorConfig }}>
        <TooltipProvider>
          <Plugins />
        </TooltipProvider>
      </LexicalComposer>
    </div>
  );
}

export function setupNoteEditor(container: HTMLElement, notePath: string): () => void {
  container.innerHTML = '';
  const root = createRoot(container);
  root.render(<NoteEditor notePath={notePath} />);
  return () => root.unmount();
}
