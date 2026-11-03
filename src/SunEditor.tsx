import { forwardRef, useEffect, useRef, type HTMLAttributes, type MutableRefObject, type Ref } from 'react';
import type { SunEditor as SE } from 'suneditor/types';

/** `suneditor` module namespace (`default`, `plugins`, `langs`, `helper`, `interfaces`, `modules`). */
export type SunEditorModule = typeof import('suneditor');
export type SunEditorInstance = SE.Instance;
export type SunEditorOptions = SE.InitOptions;
export type SunEditorEvents = NonNullable<SunEditorOptions['events']>;

/**
 * Props of the wrapping `<div>` (`id`, `data-*`, `aria-*`, `className`, `style`, ...).
 * `onChange` and `defaultValue` are replaced by the editor props; `children` is never rendered.
 */
export type SunEditorDivProps = Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue' | 'children'>;

export interface SunEditorProps extends SunEditorDivProps {
	/**
	 * Editor HTML. Uncontrolled when omitted.
	 * When it changes to something other than the last `onChange` value, the editor content is replaced.
	 */
	value?: string;
	/** Fired on every content change with the current HTML. Shorthand for `options.events.onChange`. */
	onChange?: (html: string) => void;
	/**
	 * SunEditor init options. Either an object, or a function receiving the lazily loaded `suneditor`
	 * module so you can reference `plugins` etc. without importing `suneditor` yourself (SSR safe).
	 *
	 * `events` and `theme` are kept in sync on every render; every other option is applied once at creation.
	 * Use `key` to remount with different options, or `ref.current.resetOptions()`. Handlers assigned at
	 * runtime (`editor.events.x = fn` or `resetOptions({ events })`) stay until `options.events` names them.
	 */
	options?: SunEditorOptions | ((suneditor: SunEditorModule) => SunEditorOptions);
	/** Toggle read-only mode. */
	readOnly?: boolean;
	/** Disable the editor (toolbar and content). */
	disabled?: boolean;
}

type InstanceRef = Ref<SunEditorInstance | null> | undefined;

function assignRef<T>(ref: Ref<T> | undefined, value: T) {
	if (typeof ref === 'function') ref(value);
	else if (ref) (ref as MutableRefObject<T>).current = value;
}

/** React component for SunEditor. */
const SunEditor = forwardRef<SunEditorInstance | null, SunEditorProps>(function SunEditor(props, ref) {
	const { value, onChange: _onChange, options: _options, readOnly = false, disabled = false, ...divProps } = props;

	const containerRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<SunEditorInstance | null>(null);
	const moduleRef = useRef<SunEditorModule | null>(null);
	const lastHtmlRef = useRef<string | undefined>(undefined);
	const syncedEventsRef = useRef<Set<string>>(new Set());
	const appliedThemeRef = useRef<string | undefined>(undefined);
	const assignedRef = useRef<InstanceRef>(ref);

	/**
	 * User handlers for the events the wrapper owns (`onChange`, `onload`). Every write to those names on
	 * `editor.events` (the `options` sync, `editor.events.x = fn`, `resetOptions({ events })`) lands here
	 * through the accessors installed by `installOwnEvents`, and the wrapper's handler calls them.
	 */
	const userEventsRef = useRef<{ onChange?: SunEditorEvents['onChange']; onload?: SunEditorEvents['onload'] }>({});

	const latest = useRef(props);
	latest.current = props;

	const resolveOptions = (): SunEditorOptions => {
		const { options } = latest.current;
		if (typeof options === 'function') return moduleRef.current ? options(moduleRef.current) : {};
		return options ?? {};
	};

	// Wrapper-owned handlers.
	const ownEvents = useRef({
		onChange(params: Parameters<NonNullable<SunEditorEvents['onChange']>>[0]) {
			lastHtmlRef.current = params.data;
			userEventsRef.current.onChange?.(params);
			latest.current.onChange?.(params.data);
		},
		onload(params: Parameters<NonNullable<SunEditorEvents['onload']>>[0]) {
			if (editorRef.current) applyState(editorRef.current, latest.current, true);
			return userEventsRef.current.onload?.(params);
		},
	});

	/** `initial` skips the no-op calls right after creation (the editor starts enabled and editable). */
	function applyState(
		editor: SunEditorInstance,
		{ readOnly = false, disabled = false }: SunEditorProps,
		initial = false,
	) {
		if (readOnly || !initial) editor.$.ui.readOnly(readOnly);
		if (disabled) editor.$.ui.disable();
		else if (!initial) editor.$.ui.enable();
	}

	/**
	 * Turns the wrapper-owned entries of `editor.events` into accessors: reads return the wrapper's handler,
	 * writes store the user's handler in `userEventsRef`. A user handler can therefore never displace the
	 * wrapper's, whichever way it is assigned.
	 */
	function installOwnEvents(editor: SunEditorInstance) {
		const target = editor.events as Record<string, unknown>;
		const own = ownEvents.current as Record<string, unknown>;
		const user = userEventsRef.current as Record<string, unknown>;
		for (const name of Object.keys(own)) {
			Object.defineProperty(target, name, {
				configurable: true,
				enumerable: true,
				get: () => own[name],
				set: (handler: unknown) => {
					user[name] = handler;
				},
			});
		}
	}

	function syncEvents(editor: SunEditorInstance, events: SunEditorEvents | undefined) {
		const target = editor.events as Record<string, unknown>;
		const synced = syncedEventsRef.current;
		const next = (events ?? {}) as Record<string, unknown>;

		for (const name of synced) {
			if (!(name in next)) target[name] = null;
		}
		synced.clear();
		for (const name of Object.keys(next)) {
			target[name] = next[name];
			synced.add(name);
		}
	}

	// Create on mount, destroy on unmount. The engine touches `navigator`/`window` at import time,
	// so it is imported here (client only) instead of at module top-level.
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const syncedEvents = syncedEventsRef.current;
		let cancelled = false;
		let editor: SunEditorInstance | null = null;

		import('suneditor')
			.then((mod) => {
				if (cancelled) return;
				moduleRef.current = mod;

				const { value } = latest.current;
				const { events, ...rest } = resolveOptions();
				const initial = value ?? rest.value ?? '';

				const textarea = document.createElement('textarea');
				container.appendChild(textarea);

				lastHtmlRef.current = initial;
				appliedThemeRef.current = rest.theme ?? '';

				// Handlers are seeded here so anything the engine triggers while creating already sees them.
				// (`onload` is not among those: the engine defers it with a timeout, it never fires inside
				// `create()`.) `syncEvents` then re-assigns the user's handlers through the accessors
				// `installOwnEvents` adds, and records their names for later diffs.
				editor = mod.default.create(textarea, {
					...rest,
					value: initial,
					events: { ...events, ...ownEvents.current },
				});
				editorRef.current = editor;

				installOwnEvents(editor);
				syncEvents(editor, events);
				applyState(editor, latest.current, true);
				assignRef(assignedRef.current, editor);
			})
			.catch((error: unknown) => {
				if (!cancelled) console.error('[@suneditor/react] Failed to load or create the editor.', error);
			});

		return () => {
			cancelled = true;
			if (editor) {
				try {
					editor.destroy();
				} catch (error) {
					console.error('[@suneditor/react] Failed to destroy the editor.', error);
				}
			}
			editor = null;
			editorRef.current = null;
			syncedEvents.clear();
			assignRef(assignedRef.current, null);
			container.replaceChildren();
		};
	}, []);

	// Keep live things in sync on every render: the `ref`, event handlers and theme.
	useEffect(() => {
		if (assignedRef.current !== ref) {
			if (editorRef.current) {
				assignRef(assignedRef.current, null);
				assignRef(ref, editorRef.current);
			}
			assignedRef.current = ref;
		}

		const editor = editorRef.current;
		if (!editor) return;
		const options = resolveOptions();
		syncEvents(editor, options.events);
		const theme = options.theme ?? '';
		if (theme !== appliedThemeRef.current) {
			appliedThemeRef.current = theme;
			editor.$.ui.setTheme(theme);
		}
	});

	// Controlled value.
	useEffect(() => {
		const editor = editorRef.current;
		if (!editor || value === undefined || value === lastHtmlRef.current) return;
		lastHtmlRef.current = value;
		editor.$.html.set(value);
	}, [value]);

	useEffect(() => {
		if (editorRef.current) applyState(editorRef.current, { readOnly, disabled });
	}, [readOnly, disabled]);

	return <div {...divProps} ref={containerRef} />;
});

export default SunEditor;
