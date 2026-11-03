// NOTE: the "use client" directive is injected by tsup (see tsup.config.ts).
import {
	createContext,
	forwardRef,
	useContext,
	useEffect,
	useRef,
	useState,
	type HTMLAttributes,
	type MutableRefObject,
	type ReactNode,
	type Ref,
} from 'react';
import type { SunEditor as SE } from 'suneditor/types';

/** The `suneditor` module namespace (`default`, `plugins`, `langs`, `helper`, `interfaces`, `modules`). */
export type SunEditorModule = typeof import('suneditor');
/** Editor instance returned by `suneditor.create()`. Exposed through `ref`. */
export type SunEditorInstance = SE.Instance;
/** All engine options. Passed through untouched, so new engine options need no wrapper change. */
export type SunEditorOptions = SE.InitOptions;
/** Options of one root frame (`height`, `placeholder`, `iframe`, ...). Passed through untouched. */
export type SunEditorFrameOptions = SE.InitFrameOptions;
export type SunEditorEvents = NonNullable<SunEditorOptions['events']>;

/**
 * Props of the wrapping `<div>` (`id`, `data-*`, `aria-*`, `className`, `style`, ...).
 * `onChange` and `defaultValue` are replaced by the editor props; `children` is never rendered.
 */
export type SunEditorDivProps = Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue' | 'children'>;

/** Props every editable root has, whether it is the single `<SunEditor>` or one `<SunEditorRoot>`. */
interface RootProps {
	/**
	 * Editor HTML. Uncontrolled when omitted.
	 * When it changes to something other than the last `onChange` value, the editor content is replaced.
	 */
	value?: string;
	/** Fired on every content change of this root with the current HTML. */
	onChange?: (html: string) => void;
	/** Toggle read-only mode. */
	readOnly?: boolean;
	/** Disable the editor (toolbar and content). */
	disabled?: boolean;
}

export interface SunEditorProps extends SunEditorDivProps, RootProps {
	/** Shorthand for `options.events.onChange`. */
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
}

/** One editable area of a multi-root editor. Must be rendered inside `<SunEditorGroup>`. */
export interface SunEditorRootProps extends SunEditorDivProps, RootProps {
	/** Root key, unique within the group. This is the `rootKey` of the engine API. */
	name: string;
	/** Frame options of this root (`height`, `placeholder`, `iframe`, ...). Applied once at creation. */
	options?: SunEditorFrameOptions;
}

/**
 * Multi-root editor: one engine instance (toolbar, plugins, events, theme) with a `<SunEditorRoot>` per
 * editable area. Roots are collected when the group mounts; the engine cannot add or remove roots later,
 * so remount the group with a different `key` to change them. Renders no element of its own.
 */
export interface SunEditorGroupProps {
	/** Instance options shared by every root. Same contract as `SunEditorProps['options']`. */
	options?: SunEditorProps['options'];
	children?: ReactNode;
}

type RootKey = string | null;
type InstanceRef = Ref<SunEditorInstance | null> | undefined;

interface RootEntry {
	key: RootKey;
	element: HTMLElement;
	/** Always the root's latest props, so creation and engine callbacks never see stale closures. */
	latest: MutableRefObject<RootProps & { options?: SunEditorFrameOptions }>;
}

interface GroupContextValue {
	/** Registers a root for creation. Returns the unregister function. */
	register(entry: RootEntry): () => void;
	setValue(key: RootKey, value: string | undefined): void;
	applyState(key: RootKey, props: RootProps): void;
}

const GroupContext = createContext<GroupContextValue | null>(null);

function assignRef<T>(ref: Ref<T> | undefined, value: T) {
	if (typeof ref === 'function') ref(value);
	else if (ref) (ref as MutableRefObject<T>).current = value;
}

/** Misuse warnings. Dev builds only; bundlers inline `process.env.NODE_ENV`, plain browsers have no `process`. */
function warn(message: string) {
	if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') return;
	console.warn(`[@suneditor/react] ${message}`);
}

/**
 * Applies `readOnly` / `disabled` to one root. A `null` key means the single-root editor, where the engine
 * falls back to the active frame. `initial` skips the no-op calls right after creation (the editor starts
 * enabled and editable).
 */
function applyRootState(
	editor: SunEditorInstance,
	key: RootKey,
	{ readOnly = false, disabled = false }: RootProps,
	initial = false,
) {
	// The single-root editor calls the engine without a root key, exactly like a plain `create(element)` user.
	const root: [] | [string] = key === null ? [] : [key];
	if (readOnly || !initial) editor.$.ui.readOnly(readOnly, ...root);
	if (disabled) editor.$.ui.disable(...root);
	else if (!initial) editor.$.ui.enable(...root);
}

export const SunEditorGroup = forwardRef<SunEditorInstance | null, SunEditorGroupProps>(
	function SunEditorGroup(props, ref) {
		const editorRef = useRef<SunEditorInstance | null>(null);
		const moduleRef = useRef<SunEditorModule | null>(null);
		/** Registered roots in registration (= document) order. */
		const rootsRef = useRef<Map<RootKey, RootEntry>>(new Map());
		/** Last HTML known to each root (emitted by onChange or pushed via `value`). Guards the controlled-value loop. */
		const lastHtmlRef = useRef<Map<RootKey, string>>(new Map());
		/** User event names currently assigned on the instance, so removed handlers can be cleared. */
		const syncedEventsRef = useRef<Set<string>>(new Set());
		const appliedThemeRef = useRef<string | undefined>(undefined);
		/** The `ref` that currently holds the instance, so a ref swapped after mount is re-assigned and the old one cleared. */
		const assignedRef = useRef<InstanceRef>(ref);
		/**
		 * User handlers for the events the wrapper owns (`onChange`, `onload`). Every write to those names on
		 * `editor.events` (the `options` sync, `editor.events.x = fn`, `resetOptions({ events })`) lands here
		 * through the accessors installed by `installOwnEvents`, and the wrapper's handler calls them.
		 */
		const userEventsRef = useRef<{ onChange?: SunEditorEvents['onChange']; onload?: SunEditorEvents['onload'] }>(
			{},
		);

		// Always points at the latest committed props, so engine callbacks never see stale closures.
		const latest = useRef(props);
		useEffect(() => {
			latest.current = props;
		});

		const resolveOptions = (): SunEditorOptions => {
			const { options } = latest.current;
			if (typeof options === 'function') return moduleRef.current ? options(moduleRef.current) : {};
			return options ?? {};
		};

		function applyAllStates(editor: SunEditorInstance, initial: boolean) {
			for (const root of rootsRef.current.values())
				applyRootState(editor, root.key, root.latest.current, initial);
		}

		// Wrapper-owned handlers. They only read refs, so they are created once and never go stale.
		const ownEvents = useRef({
			onChange(params: Parameters<NonNullable<SunEditorEvents['onChange']>>[0]) {
				const key = (params.frameContext.get('key') ?? null) as RootKey;
				lastHtmlRef.current.set(key, params.data);
				userEventsRef.current.onChange?.(params);
				rootsRef.current.get(key)?.latest.current.onChange?.(params.data);
			},
			onload(params: Parameters<NonNullable<SunEditorEvents['onload']>>[0]) {
				// iframe mode finishes initializing asynchronously; re-apply the state props once it is ready.
				if (editorRef.current) applyAllStates(editorRef.current, true);
				return userEventsRef.current.onload?.(params);
			},
		});

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

		// Created once: the roots call these through the context, and everything they touch is a ref.
		const [context] = useState<GroupContextValue>(() => ({
			register(entry) {
				const roots = rootsRef.current;
				if (editorRef.current) {
					warn(
						`root "${entry.key}" was added after the editor was created and is ignored. Change the \`key\` of <SunEditorGroup> to recreate the editor with the current roots.`,
					);
				} else if (roots.has(entry.key)) {
					warn(`duplicate root name "${entry.key}"; the later <SunEditorRoot> replaces the earlier one.`);
				}
				roots.set(entry.key, entry);
				return () => {
					if (roots.get(entry.key) === entry) roots.delete(entry.key);
					if (editorRef.current) {
						warn(
							`root "${entry.key}" was removed while the editor is alive. Change the \`key\` of <SunEditorGroup> to recreate the editor with the current roots.`,
						);
					}
				};
			},
			setValue(key, value) {
				const editor = editorRef.current;
				const lastHtml = lastHtmlRef.current;
				// `lastHtml` holds exactly the roots the editor was created with; later roots are ignored.
				if (!editor || !lastHtml.has(key) || value === undefined || value === lastHtml.get(key)) return;
				lastHtml.set(key, value);
				if (key === null) {
					editor.$.html.set(value);
					return;
				}
				// `html.set` leaves the written root active; restore the one the user is in.
				const active = editor.$.store.get('rootKey');
				// The engine types `rootKey` as a number, but keys are the strings given to `create()`.
				editor.$.html.set(value, { rootKey: key as unknown as number });
				if (active !== key) editor.changeFrameContext(active);
			},
			applyState(key, props) {
				if (editorRef.current && lastHtmlRef.current.has(key)) applyRootState(editorRef.current, key, props);
			},
		}));

		// Create on mount, destroy on unmount. The engine touches `navigator`/`window` at import time,
		// so it is imported here (client only) instead of at module top-level. The roots registered
		// themselves in their own effects, which React runs before this one.
		useEffect(() => {
			const roots = rootsRef.current;
			const syncedEvents = syncedEventsRef.current;
			let cancelled = false;
			let editor: SunEditorInstance | null = null;

			import('suneditor')
				.then((mod) => {
					if (cancelled) return;
					moduleRef.current = mod;

					const entries = [...roots.values()];
					if (entries.length === 0) return;

					const { events, ...rest } = resolveOptions();
					const lastHtml = lastHtmlRef.current;
					lastHtml.clear();
					appliedThemeRef.current = rest.theme ?? '';
					// Handlers are seeded here so anything the engine triggers while creating already sees them.
					// (`onload` is not among those: the engine defers it with a timeout, it never fires inside
					// `create()`.) `syncEvents` then re-assigns the user's handlers through the accessors
					// `installOwnEvents` adds, and records their names for later diffs.
					const seededEvents = { ...events, ...ownEvents.current };
					const mountTextarea = (entry: RootEntry) => {
						const textarea = document.createElement('textarea');
						entry.element.appendChild(textarea);
						return textarea;
					};

					const single = entries.length === 1 && entries[0]!.key === null;
					if (single) {
						const entry = entries[0]!;
						const initial = entry.latest.current.value ?? rest.value ?? '';
						lastHtml.set(null, initial);
						editor = mod.default.create(mountTextarea(entry), {
							...rest,
							value: initial,
							events: seededEvents,
						});
					} else {
						const targets: Record<string, { target: Element; options: SunEditorFrameOptions }> = {};
						for (const entry of entries) {
							if (entry.key === null) {
								warn('a root without `name` inside a multi-root group is ignored.');
								continue;
							}
							const frame = entry.latest.current.options ?? {};
							const initial = entry.latest.current.value ?? frame.value ?? rest.value ?? '';
							lastHtml.set(entry.key, initial);
							targets[entry.key] = {
								target: mountTextarea(entry),
								options: { ...frame, value: initial },
							};
						}
						editor = mod.default.create(targets, { ...rest, events: seededEvents });
					}
					editorRef.current = editor;

					installOwnEvents(editor);
					syncEvents(editor, events);
					applyAllStates(editor, true);
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
				for (const entry of roots.values()) entry.element.replaceChildren();
			};
			// Intentionally created once; option changes after mount are not applied (see `options` docs).
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

		return <GroupContext.Provider value={context}>{props.children}</GroupContext.Provider>;
	},
);

/** Shared by `<SunEditor>` (no `name`, single root) and `<SunEditorRoot>` (named root of a group). */
function EditorRoot(props: Omit<SunEditorRootProps, 'name'> & { name?: string }) {
	const group = useContext(GroupContext);
	if (!group) throw new Error('[@suneditor/react] <SunEditorRoot> must be rendered inside <SunEditorGroup>.');

	// Everything that is not an editor prop goes to the wrapping <div>.
	const {
		name,
		value,
		onChange: _onChange,
		options: _options,
		readOnly = false,
		disabled = false,
		...divProps
	} = props;
	const key = name ?? null;

	const containerRef = useRef<HTMLDivElement>(null);
	const latest = useRef(props);
	useEffect(() => {
		latest.current = props;
	});

	useEffect(() => {
		const element = containerRef.current;
		if (!element) return;
		return group.register({ key, element, latest });
	}, [group, key]);

	// Controlled value.
	useEffect(() => {
		group.setValue(key, value);
	}, [group, key, value]);

	useEffect(() => {
		group.applyState(key, { readOnly, disabled });
	}, [group, key, readOnly, disabled]);

	return <div {...divProps} ref={containerRef} />;
}

export function SunEditorRoot(props: SunEditorRootProps) {
	return <EditorRoot {...props} />;
}

/** React component for SunEditor. The engine is loaded on the client only, so it is safe to render on the server. */
const SunEditor = forwardRef<SunEditorInstance | null, SunEditorProps>(function SunEditor({ options, ...root }, ref) {
	return (
		<SunEditorGroup ref={ref} options={options}>
			<EditorRoot {...root} />
		</SunEditorGroup>
	);
});

export default SunEditor;
