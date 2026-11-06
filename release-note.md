## 1.0.0

### New Feature

- `SunEditor` React component for SunEditor 3 (`suneditor@^3.4.1` peer dependency).
- Renders on the server (Next.js App Router and Pages Router) without `next/dynamic`; the engine is loaded in the browser only.
- `options` accepts an object or a function that receives the lazily loaded `suneditor` module.
- Controlled `value` / `onChange`, `readOnly`, `disabled`, live `events` and `theme` sync, and `ref` to the engine instance.
- Support multi-root editing: `SunEditorGroup` creates one editor with a shared toolbar, plugins, events and theme, and a `SunEditorRoot` per editable area with its own `name`, `value` / `onChange`, `readOnly`, `disabled` and frame `options`.
- `SunEditorFrameOptions`, `SunEditorGroupProps` and `SunEditorRootProps` types are exported.
- ESM and CJS builds with type declarations.
