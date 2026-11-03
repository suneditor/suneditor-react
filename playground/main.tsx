import { StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import SunEditor, { type SunEditorInstance } from '@suneditor/react';
import ko from 'suneditor/langs/ko';
import 'suneditor/css/editor';
import 'suneditor/css/contents';
import 'suneditor/src/themes/dark.css';

function App() {
	const ref = useRef<SunEditorInstance | null>(null);
	const [html, setHtml] = useState('<p>Hello <b>SunEditor</b></p>');
	const [readOnly, setReadOnly] = useState(false);
	const [disabled, setDisabled] = useState(false);
	const [dark, setDark] = useState(false);
	const [korean, setKorean] = useState(false);
	const [mounted, setMounted] = useState(true);
	const [saves, setSaves] = useState(0);

	return (
		<main style={{ maxWidth: 960, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
			<h1>@suneditor/react playground</h1>
			<p style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
				<button onClick={() => setHtml(`<p>Set from outside ${Date.now()}</p>`)}>set value</button>
				<button onClick={() => setReadOnly((v) => !v)}>readOnly: {String(readOnly)}</button>
				<button onClick={() => setDisabled((v) => !v)}>disabled: {String(disabled)}</button>
				<button onClick={() => setDark((v) => !v)}>theme: {dark ? 'dark' : 'default'}</button>
				<button onClick={() => setKorean((v) => !v)}>lang: {korean ? 'ko' : 'en'} (remounts)</button>
				<button onClick={() => setMounted((v) => !v)}>mounted: {String(mounted)}</button>
				<button onClick={() => console.warn(ref.current?.$.html.get())}>log ref.$.html.get()</button>
				<span>saves: {saves}</span>
			</p>
			{mounted && (
				<SunEditor
					key={String(korean)}
					ref={ref}
					value={html}
					onChange={setHtml}
					readOnly={readOnly}
					disabled={disabled}
					options={(se) => ({
						plugins: [
							se.plugins.link,
							se.plugins.image,
							se.plugins.table,
							se.plugins.list,
							se.plugins.align,
							se.plugins.fontColor,
						],
						buttonList: [
							['undo', 'redo'],
							['bold', 'italic', 'underline', 'strike'],
							['fontColor', 'align', 'list'],
							['table', 'link', 'image'],
							['codeView', 'save'],
						],
						height: '300px',
						theme: dark ? 'dark' : '',
						lang: korean ? ko : undefined,
						events: {
							// Closes over `saves` on purpose: handlers must always see the latest render.
							onSave: async () => {
								setSaves(saves + 1);
								return true;
							},
						},
					})}
				/>
			)}
			<h3>state.html</h3>
			<pre style={{ whiteSpace: 'pre-wrap', background: '#f4f4f4', padding: 8 }}>{html}</pre>
		</main>
	);
}

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
