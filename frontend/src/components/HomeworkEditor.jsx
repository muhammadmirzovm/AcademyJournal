import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Italic, Underline, Strikethrough, Code, List, ListOrdered, Undo2, Redo2, RemoveFormatting } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { homeworkHtml } from '../utils/homework'

export default function HomeworkEditor({ value, format = 'plain', onChange }) {
  const { t } = useTranslation()
  const editor = useEditor({
    extensions: [StarterKit.configure({
      heading: false, horizontalRule: false, codeBlock: false, blockquote: false, link: false, trailingNode: false,
    })],
    content: homeworkHtml(value, format),
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-label': t('lesson.assignment'), class: 'homework-rich-text' } },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
  })
  useEffect(() => {
    if (!editor) return
    const html = homeworkHtml(value, format)
    if (editor.getHTML() !== html) editor.commands.setContent(html, { emitUpdate: false })
  }, [editor, value, format])

  const buttons = [
    ['bold', Bold, 'bold', () => editor.chain().focus().toggleBold().run()],
    ['italic', Italic, 'italic', () => editor.chain().focus().toggleItalic().run()],
    ['underline', Underline, 'underline', () => editor.chain().focus().toggleUnderline().run()],
    ['strike', Strikethrough, 'strike', () => editor.chain().focus().toggleStrike().run()],
    ['code', Code, 'code', () => editor.chain().focus().toggleCode().run()],
    ['bullet_list', List, 'bulletList', () => editor.chain().focus().toggleBulletList().run()],
    ['ordered_list', ListOrdered, 'orderedList', () => editor.chain().focus().toggleOrderedList().run()],
    ['clear', RemoveFormatting, null, () => editor.chain().focus().clearNodes().unsetAllMarks().run()],
    ['undo', Undo2, null, () => editor.chain().focus().undo().run()],
    ['redo', Redo2, null, () => editor.chain().focus().redo().run()],
  ]
  return <div className="homework-editor">
    <div className="homework-toolbar" role="toolbar" aria-label={t('rich_text.toolbar')}>
      {buttons.map(([key, Icon, mark, action]) => <button key={key} type="button" title={t(`rich_text.${key}`)} aria-label={t(`rich_text.${key}`)}
        aria-pressed={mark ? Boolean(editor?.isActive(mark)) : undefined} disabled={!editor}
        onMouseDown={event => event.preventDefault()} onClick={action}>
        <Icon size={16} />
      </button>)}
    </div>
    <EditorContent editor={editor} />
    <p className="homework-editor-hint">{t('rich_text.hint')}</p>
  </div>
}
