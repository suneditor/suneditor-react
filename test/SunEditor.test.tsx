import { act, render, waitFor } from '@testing-library/react';
import { StrictMode, createRef } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import SunEditor, {
	SunEditorGroup,
	SunEditorRoot,
	type SunEditorInstance,
	type SunEditorOptions,
	type SunEditorProps,
} from '../src';

/** The engine types `rootKey` as a number, but keys are the strings given to `create()`. */
const rootKey = (key: string) => ({ rootKey: key as unknown as number });

const baseOptions: SunEditorOptions = { buttonList: [['bold', 'italic']] };

/** Renders and waits until the lazily loaded engine has created the editor. */
async function mount(props: SunEditorProps = {}) {
	const ref = createRef<SunEditorInstance | null>();
	const utils = render(<SunEditor ref={ref} options={baseOptions} {...props} />);
	await waitFor(() => expect(ref.current).not.toBeNull());
	const editor = ref.current as SunEditorInstance;
	const wysiwyg = () => utils.container.querySelector('.se-wrapper-wysiwyg') as HTMLElement;
	return { ...utils, ref, editor, wysiwyg };
}

describe('<SunEditor />', () => {
	it('renders on the server without touching the engine', () => {
		const html = renderToString(<SunEditor className='x' style={{ height: 10 }} />);
		expect(html).toBe('<div class="x" style="height:10px"></div>');
	});

	it('creates the editor on mount and exposes the instance through ref', async () => {
		const { container, editor } = await mount();
		expect(container.querySelector('.sun-editor')).toBeInTheDocument();
		expect(container.querySelectorAll('.se-container')).toHaveLength(1);
		expect(typeof editor.destroy).toBe('function');
		expect(editor.isEmpty()).toBe(true);
	});

	it('destroys the editor and empties the container on unmount', async () => {
		const { container, ref, unmount } = await mount();
		unmount();
		expect(ref.current).toBeNull();
		expect(container.innerHTML).toBe('');
	});

	it('creates exactly one editor under StrictMode', async () => {
		const onload = vi.fn();
		const ref = createRef<SunEditorInstance | null>();
		const { container } = render(
			<StrictMode>
				<SunEditor ref={ref} options={{ ...baseOptions, events: { onload } }} />
			</StrictMode>,
		);
		await waitFor(() => expect(ref.current).not.toBeNull());
		expect(container.querySelectorAll('.se-container')).toHaveLength(1);
		expect(onload).toHaveBeenCalledTimes(1);
	});

	it('passes the lazily loaded module to the options function', async () => {
		const options = vi.fn((se) => ({ ...baseOptions, plugins: [se.plugins.link] }));
		const { editor } = await mount({ options });
		const se = options.mock.calls[0]?.[0];
		expect(typeof se.default.create).toBe('function');
		expect(se.plugins.link).toBeDefined();
		expect(editor.$.plugins.link).toBeDefined();
	});

	it('uses `value` as the initial content, falling back to options.value', async () => {
		const a = await mount({
			value: '<p>from value</p>',
			options: { ...baseOptions, value: '<p>from options</p>' },
		});
		expect(a.wysiwyg().innerHTML).toContain('from value');
		a.unmount();

		const b = await mount({ options: { ...baseOptions, value: '<p>from options</p>' } });
		expect(b.wysiwyg().innerHTML).toContain('from options');
	});

	it('calls onChange (prop and options.events.onChange) when the content changes', async () => {
		const onChange = vi.fn();
		const onChangeEvent = vi.fn();
		const { editor } = await mount({ onChange, options: { ...baseOptions, events: { onChange: onChangeEvent } } });

		await act(async () => {
			editor.$.html.set('<p>changed</p>');
		});

		await waitFor(() => expect(onChange).toHaveBeenCalled());
		expect(onChange.mock.lastCall?.[0]).toContain('changed');
		expect(onChangeEvent).toHaveBeenCalled();
		expect(onChangeEvent.mock.lastCall?.[0].data).toContain('changed');
	});

	it('replaces the content when `value` changes from outside', async () => {
		const { editor, rerender, wysiwyg } = await mount({ value: '<p>one</p>' });
		const set = vi.spyOn(editor.$.html, 'set');

		rerender(<SunEditor options={baseOptions} value='<p>two</p>' />);
		await waitFor(() => expect(wysiwyg().innerHTML).toContain('two'));
		expect(set).toHaveBeenCalledTimes(1);
	});

	it('does not write back a `value` that equals the last onChange result (no feedback loop)', async () => {
		const onChange = vi.fn();
		const { editor, rerender } = await mount({ value: '<p>one</p>', onChange });
		await act(async () => {
			editor.$.html.set('<p>typed</p>');
		});
		await waitFor(() => expect(onChange).toHaveBeenCalled());
		const emitted = onChange.mock.lastCall?.[0] as string;

		const set = vi.spyOn(editor.$.html, 'set');
		rerender(<SunEditor options={baseOptions} value={emitted} onChange={onChange} />);
		await act(async () => {});
		expect(set).not.toHaveBeenCalled();
	});

	it('hands the instance to a ref swapped after mount and clears the previous one', async () => {
		const { editor, ref: first, rerender, unmount } = await mount();
		const second = createRef<SunEditorInstance | null>();
		const third = vi.fn();

		rerender(<SunEditor ref={second} options={baseOptions} />);
		expect(second.current).toBe(editor);
		expect(first.current).toBeNull();

		rerender(<SunEditor ref={third} options={baseOptions} />);
		expect(third).toHaveBeenLastCalledWith(editor);
		expect(second.current).toBeNull();

		unmount();
		expect(third).toHaveBeenLastCalledWith(null);
	});

	it('keeps its own onChange when a handler is assigned on the instance (editor.events / resetOptions)', async () => {
		const onChange = vi.fn();
		const runtime = vi.fn();
		const { editor, rerender } = await mount({ onChange, options: { ...baseOptions, events: {} } });

		// The engine's `resetOptions({ events })` does exactly this assignment.
		editor.events.onChange = runtime;
		await act(async () => {
			editor.$.html.set('<p>typed</p>');
		});
		await waitFor(() => expect(runtime).toHaveBeenCalled());
		expect(runtime.mock.lastCall?.[0].data).toContain('typed');
		expect(onChange.mock.lastCall?.[0]).toContain('typed');

		// A render that does not name `onChange` in `options.events` leaves the runtime handler in place...
		rerender(<SunEditor options={{ ...baseOptions, events: {} }} onChange={onChange} />);
		expect(typeof editor.events.onChange).toBe('function');
		await act(async () => {
			editor.$.html.set('<p>again</p>');
		});
		expect(runtime.mock.lastCall?.[0].data).toContain('again');

		// ...and one that names it replaces the runtime handler.
		const fromOptions = vi.fn();
		rerender(<SunEditor options={{ ...baseOptions, events: { onChange: fromOptions } }} onChange={onChange} />);
		runtime.mockClear();
		await act(async () => {
			editor.$.html.set('<p>third</p>');
		});
		expect(fromOptions.mock.lastCall?.[0].data).toContain('third');
		expect(runtime).not.toHaveBeenCalled();
	});

	it('does not call the options function on content changes', async () => {
		const options = vi.fn(() => baseOptions);
		const { editor } = await mount({ options, onChange: vi.fn() });
		const calls = options.mock.calls.length;

		await act(async () => {
			editor.$.html.set('<p>changed</p>');
		});
		expect(options.mock.calls.length).toBe(calls);
	});

	it('keeps event handlers in sync with the latest render', async () => {
		const first = vi.fn(async () => true);
		const second = vi.fn(async () => true);
		const { editor, rerender } = await mount({ options: { ...baseOptions, events: { onSave: first } } });
		expect(editor.events.onSave).toBe(first);

		rerender(<SunEditor options={{ ...baseOptions, events: { onSave: second } }} />);
		expect(editor.events.onSave).toBe(second);

		rerender(<SunEditor options={{ ...baseOptions, events: {} }} />);
		expect(editor.events.onSave).toBeNull();
		// wrapper-owned handlers survive the sync
		expect(typeof editor.events.onChange).toBe('function');
	});

	it('toggles readOnly and disabled', async () => {
		const { editor, rerender, wysiwyg } = await mount();
		const readOnly = vi.spyOn(editor.$.ui, 'readOnly');
		const disable = vi.spyOn(editor.$.ui, 'disable');
		const enable = vi.spyOn(editor.$.ui, 'enable');

		rerender(<SunEditor options={baseOptions} readOnly />);
		expect(readOnly).toHaveBeenLastCalledWith(true);
		expect(wysiwyg()).toHaveClass('se-read-only');

		rerender(<SunEditor options={baseOptions} disabled />);
		expect(readOnly).toHaveBeenLastCalledWith(false);
		expect(disable).toHaveBeenCalledTimes(1);
		expect(wysiwyg()).not.toHaveClass('se-read-only');
		expect(wysiwyg().getAttribute('contenteditable')).toBe('false');

		rerender(<SunEditor options={baseOptions} />);
		expect(enable).toHaveBeenCalled();
		expect(wysiwyg().getAttribute('contenteditable')).toBe('true');
	});

	it('applies readOnly and disabled given at mount time', async () => {
		const { wysiwyg } = await mount({ readOnly: true, disabled: true });
		expect(wysiwyg()).toHaveClass('se-read-only');
		expect(wysiwyg().getAttribute('contenteditable')).toBe('false');
	});

	it('switches the theme live', async () => {
		const { container, rerender } = await mount();
		rerender(<SunEditor options={{ ...baseOptions, theme: 'dark' }} />);
		expect(container.querySelector('.sun-editor')).toHaveClass('se-theme-dark');
		rerender(<SunEditor options={{ ...baseOptions, theme: '' }} />);
		expect(container.querySelector('.sun-editor')).not.toHaveClass('se-theme-dark');
	});

	it('forwards other div attributes (id, data-*, aria-*) to the wrapping element', async () => {
		const ref = createRef<SunEditorInstance | null>();
		const { container } = render(
			<SunEditor
				ref={ref}
				options={baseOptions}
				id='body'
				data-testid='editor'
				aria-label='Body'
				title='T'
				value='<p>x</p>'
				readOnly
			/>,
		);
		await waitFor(() => expect(ref.current).not.toBeNull());
		const root = container.firstElementChild as HTMLDivElement;
		expect(root.id).toBe('body');
		expect(root.dataset.testid).toBe('editor');
		expect(root.getAttribute('aria-label')).toBe('Body');
		expect(root.title).toBe('T');
		// Editor props never leak to the DOM.
		expect(root.hasAttribute('value')).toBe(false);
		expect(root.hasAttribute('readonly')).toBe(false);
	});

	it('forwards className and style to the wrapping element', async () => {
		const { container } = await mount({ className: 'my-editor', style: { maxWidth: 500 } });
		const root = container.firstElementChild as HTMLElement;
		expect(root).toHaveClass('my-editor');
		expect(root.style.maxWidth).toBe('500px');
		expect(root.querySelector('.sun-editor')).toBeInTheDocument();
	});
});

describe('<SunEditorGroup /> (multi-root)', () => {
	type Props = { header?: string; body?: string; headerReadOnly?: boolean; bodyDisabled?: boolean; extra?: boolean };

	/**
	 * Two named roots with other JSX in between, like a real document layout. The engine requires
	 * `toolbar_container` (or inline/balloon mode) for multi root, so the toolbar goes into its own element.
	 */
	async function mountGroup(props: Props = {}, onChange: { header?: () => void; body?: () => void } = {}) {
		const ref = createRef<SunEditorInstance | null>();
		const toolbar = createRef<HTMLDivElement>();
		const ui = (p: Props) => (
			<SunEditorGroup ref={ref} options={() => ({ ...baseOptions, toolbar_container: toolbar.current })}>
				<div ref={toolbar} data-testid='toolbar' />
				<h2>Title</h2>
				<SunEditorRoot
					name='header'
					value={p.header ?? '<p>H</p>'}
					onChange={onChange.header}
					readOnly={p.headerReadOnly}
					options={{ height: '80px' }}
				/>
				<SunEditorRoot
					name='body'
					value={p.body ?? '<p>B</p>'}
					onChange={onChange.body}
					disabled={p.bodyDisabled}
				/>
				{p.extra && <SunEditorRoot name='extra' />}
			</SunEditorGroup>
		);
		const utils = render(ui(props));
		await waitFor(() => expect(ref.current).not.toBeNull());
		const editor = ref.current as SunEditorInstance;
		const areas = () => [...utils.container.querySelectorAll<HTMLElement>('.se-wrapper-wysiwyg')];
		return { ...utils, ref, editor, areas, rerender: (p: Props) => utils.rerender(ui(p)) };
	}

	it('renders roots and other children on the server without touching the engine', () => {
		const html = renderToString(
			<SunEditorGroup options={baseOptions}>
				<h2>Title</h2>
				<SunEditorRoot name='header' className='h' />
				<SunEditorRoot name='body' />
			</SunEditorGroup>,
		);
		expect(html).toBe('<h2>Title</h2><div class="h"></div><div></div>');
	});

	it('creates one editor with a wysiwyg per root and one shared toolbar', async () => {
		const { container, editor, areas, getByTestId } = await mountGroup();
		expect(container.querySelectorAll('.se-toolbar')).toHaveLength(1);
		expect(getByTestId('toolbar').querySelector('.se-toolbar')).not.toBeNull();
		expect(areas()).toHaveLength(2);
		expect(areas()[0]?.innerHTML).toContain('H');
		expect(areas()[1]?.innerHTML).toContain('B');
		expect(editor.$.html.get(rootKey('body'))).toContain('B');
		expect(container.querySelector('h2')?.nextElementSibling?.querySelector('.se-wrapper-wysiwyg')).toBe(
			areas()[0],
		);
	});

	it('creates exactly one editor under StrictMode', async () => {
		const ref = createRef<SunEditorInstance | null>();
		const { container } = render(
			<StrictMode>
				<SunEditorGroup ref={ref} options={{ ...baseOptions, mode: 'inline' }}>
					<SunEditorRoot name='header' />
					<SunEditorRoot name='body' />
				</SunEditorGroup>
			</StrictMode>,
		);
		await waitFor(() => expect(ref.current).not.toBeNull());
		expect(container.querySelectorAll('.se-toolbar')).toHaveLength(1);
		expect(container.querySelectorAll('.se-wrapper-wysiwyg')).toHaveLength(2);
	});

	it('routes onChange to the root that changed', async () => {
		const header = vi.fn();
		const body = vi.fn();
		const { editor } = await mountGroup({}, { header, body });

		await act(async () => {
			editor.$.html.set('<p>typed</p>', rootKey('body'));
		});
		expect(body.mock.lastCall?.[0]).toContain('typed');
		expect(header).not.toHaveBeenCalled();
	});

	it('sets a controlled value per root without switching the active root', async () => {
		const { editor, areas, rerender } = await mountGroup();
		editor.changeFrameContext('body');

		rerender({ header: '<p>H2</p>' });
		await waitFor(() => expect(areas()[0]?.innerHTML).toContain('H2'));
		expect(areas()[1]?.innerHTML).toContain('B');
		expect(editor.$.store.get('rootKey')).toBe('body');
	});

	it('applies readOnly and disabled per root', async () => {
		const { areas, rerender } = await mountGroup({ headerReadOnly: true, bodyDisabled: true });
		expect(areas()[0]).toHaveClass('se-read-only');
		expect(areas()[1]).not.toHaveClass('se-read-only');
		expect(areas()[1]?.getAttribute('contenteditable')).toBe('false');
		expect(areas()[0]?.getAttribute('contenteditable')).toBe('true');

		rerender({ headerReadOnly: false, bodyDisabled: false });
		expect(areas()[0]).not.toHaveClass('se-read-only');
		expect(areas()[1]?.getAttribute('contenteditable')).toBe('true');
	});

	it('warns when a root is added after the editor was created', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { areas, rerender } = await mountGroup();
		rerender({ extra: true });
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('root "extra" was added after'));
		expect(areas()).toHaveLength(2);
		warn.mockRestore();
	});

	it('throws when a root is rendered outside a group', () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(() => render(<SunEditorRoot name='x' />)).toThrow('<SunEditorRoot> must be rendered inside');
		error.mockRestore();
	});
});
