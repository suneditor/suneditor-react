import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';

// Browser APIs the engine uses that jsdom does not implement.
class ResizeObserverMock {
	observe() {}
	unobserve() {}
	disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

const css = ((globalThis as { CSS?: Partial<typeof CSS> }).CSS ??= {});
css.supports ??= () => false;
css.escape ??= (value: string) => value;

HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
window.open = vi.fn();

if (!('visualViewport' in window)) {
	Object.defineProperty(window, 'visualViewport', {
		configurable: true,
		value: {
			width: 1200,
			height: 800,
			scale: 1,
			offsetTop: 0,
			offsetLeft: 0,
			addEventListener() {},
			removeEventListener() {},
		},
	});
}

// jsdom has no `innerText`; the engine reads it in a few places (e.g. `isEmpty`).
if (!Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerText')?.get) {
	Object.defineProperty(HTMLElement.prototype, 'innerText', {
		configurable: true,
		get() {
			return this.textContent;
		},
		set(value: string) {
			this.textContent = value;
		},
	});
}

// Loading the engine's module graph cold takes over a second on CI runners, longer than `waitFor` allows.
// Warm it up here so the first test measures the component, not the import.
beforeAll(async () => {
	await import('suneditor');
});

afterEach(() => {
	cleanup();
});
