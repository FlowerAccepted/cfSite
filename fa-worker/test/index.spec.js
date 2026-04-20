import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src';

describe('fa-worker routing and cors', () => {
	it('responds with OK on root', async () => {
		const request = new Request('http://example.com/');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		expect(await response.text()).toBe('OK');
	});

	it('responds with Not Found for unknown paths', async () => {
		const response = await SELF.fetch('http://example.com/not-exists');
		expect(response.status).toBe(404);
		expect(await response.text()).toBe('Not Found');
	});

	it('blocks disallowed cross-origin preflight by default', async () => {
		const request = new Request('http://example.com/api/me', {
			method: 'OPTIONS',
			headers: {
				Origin: 'https://evil.example',
				'Access-Control-Request-Method': 'GET',
			},
		});
		const response = await SELF.fetch(request);
		expect(response.status).toBe(403);
		expect(await response.text()).toBe('Origin not allowed');
	});
});
