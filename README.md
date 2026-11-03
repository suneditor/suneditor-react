# @suneditor/react

Official React component for [SunEditor](https://github.com/JiHong88/suneditor) 3.

- TypeScript, zero runtime dependencies besides `react` and `suneditor`
- Works in Next.js (App Router / Pages Router) out of the box. The engine is loaded on the client only, so no `next/dynamic` is needed
- Every SunEditor option is passed through as-is. New engine options need no wrapper update

## Install

```bash
npm install @suneditor/react suneditor
```

## Usage

```tsx
import SunEditor from '@suneditor/react';
import 'suneditor/css/editor';
import 'suneditor/css/contents';

export default function App() {
	return (
		<SunEditor
			options={(se) => ({
				plugins: [se.plugins.link, se.plugins.image, se.plugins.table],
				buttonList: [
					['undo', 'redo'],
					['bold', 'italic', 'underline'],
					['table', 'link', 'image'],
				],
				height: '400px',
			})}
		/>
	);
}
```

`options` receives the lazily loaded `suneditor` module (`se.plugins`, `se.langs`, `se.interfaces`, ...).
Prefer this form in Next.js: importing `suneditor` statically in a client component breaks server rendering because the engine touches `window` at import time.
A plain object also works when you are not server rendering, or for options that need no engine import.
Language packs are plain objects and can always be imported statically: `import ko from 'suneditor/langs/ko'`.

### Controlled value

```tsx
const [html, setHtml] = useState('<p>Hello</p>');

<SunEditor value={html} onChange={setHtml} options={...} />
```

Changing `value` to something other than the last `onChange` result replaces the editor content.
Omit `value` for an uncontrolled editor and read the content from the instance when you need it.

### Instance access

```tsx
const ref = useRef<SunEditorInstance | null>(null);

<SunEditor ref={ref} options={...} />

ref.current?.$.html.get();
ref.current?.$.html.set('<p>new</p>');
ref.current?.resetOptions({ height: '600px' });
```

`ref` is the object returned by `suneditor.create()`, so the whole engine API is available.

### Events

Pass handlers through `options.events`. They are re-synced on every render, so they can safely close over React state.

```tsx
<SunEditor
	options={(se) => ({
		plugins: [se.plugins.image],
		events: {
			onSave: async () => { await save(html); return true; },
			onImageUploadBefore: ({ info, handler }) => { ... },
		},
	})}
/>
```

### Toolbar or status bar in another element

Engine options that take a DOM element work with refs because the `options` function runs after mount:

```tsx
const toolbarRef = useRef<HTMLDivElement>(null);

<div ref={toolbarRef} />
<SunEditor options={(se) => ({ plugins: [se.plugins.link], toolbar_container: toolbarRef.current })} />
```

### Multi-root

One engine instance (toolbar, plugins, events, theme) with several editable areas. Put a `<SunEditorRoot>` per area inside `<SunEditorGroup>`; any other JSX can sit between them. The group renders no element of its own.

```tsx
const toolbarRef = useRef<HTMLDivElement>(null);

<SunEditorGroup options={(se) => ({ plugins: [se.plugins.link], toolbar_container: toolbarRef.current })}>
	<div ref={toolbarRef} />
	<h2>Title</h2>
	<SunEditorRoot name='header' value={header} onChange={setHeader} options={{ height: '80px' }} />
	<SunEditorRoot name='body' value={body} onChange={setBody} readOnly={locked} />
</SunEditorGroup>;
```

- `name` is the engine `rootKey` (`ref.current.changeFrameContext('body')`, `html.get({ rootKey: 'body' })`).
- Each root has its own `value` / `onChange`, `readOnly`, `disabled` and frame `options` (`height`, `placeholder`, `iframe`, ...).
- The engine needs `toolbar_container` for the shared toolbar unless `mode` is `inline` or `balloon`.
- Roots are collected when the group mounts. The engine cannot add or remove roots later, so change the group's `key` to recreate it with different roots.

## Props

| Prop                 | Type                                           | Description                                                                                                 |
| -------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `value`              | `string`                                       | Editor HTML (controlled).                                                                                   |
| `onChange`           | `(html: string) => void`                       | Called on every content change. Shorthand for `options.events.onChange`.                                    |
| `options`            | `SunEditorOptions \| (se) => SunEditorOptions` | SunEditor init options. `events` and `theme` are applied live. Everything else is applied once at creation. |
| `readOnly`           | `boolean`                                      | Toggle read-only mode.                                                                                      |
| `disabled`           | `boolean`                                      | Disable the editor.                                                                                         |
| `className`, `style` |                                                | Applied to the wrapping `<div>`.                                                                            |
| `...divProps`        | `HTMLAttributes<HTMLDivElement>`               | Any other prop (`id`, `data-*`, `aria-*`, ...) is applied to the wrapping `<div>`. `children` is ignored.   |
| `ref`                | `SunEditorInstance \| null`                    | The editor instance.                                                                                        |

Options other than `events` and `theme` are applied when the editor is created.
To change them later, remount with a different `key` or call `ref.current.resetOptions()`.

## Types

```ts
import type {
	SunEditorProps,
	SunEditorGroupProps,
	SunEditorRootProps,
	SunEditorInstance,
	SunEditorOptions,
	SunEditorFrameOptions,
	SunEditorEvents,
} from '@suneditor/react';
```

All engine types are also available from `suneditor/types`.

## Next.js notes

- The component is a client module (`"use client"` is in the build output) and loads the engine only in the browser, so it can be rendered from a server component directly.
- Keep `suneditor` out of static imports in client components. Use the `options={(se) => ...}` form to reach `se.plugins`.
- CSS imports (`suneditor/css/editor`, `suneditor/css/contents`, `suneditor/src/themes/*.css`) work in both the App Router and the Pages Router.

## Development

```bash
npm install
npm run dev     # Vite playground that imports src/ directly
npm test        # Vitest + jsdom against the real engine
npm run check   # lint, format, typecheck, test, build
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the design rules (small API surface, no engine option mirroring), how to work against a local engine checkout, and how to verify in a Next.js app.

## License

MIT
