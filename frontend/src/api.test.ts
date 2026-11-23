import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('HTTP-клиент', () => {
  it('обрабатывает DELETE без тела ответа', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    await expect(api.remove(12)).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      '/api/tasks/12',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it.each([404, 422, 500])('показывает ошибку при HTTP %s', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status })));
    await expect(api.list()).rejects.toThrow();
  });

  it('обрабатывает потерю соединения', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api.list()).rejects.toThrow('Нет соединения с сервером');
  });

  it('передаёт новый статус в JSON', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"id":12,"status":"done"}'));
    vi.stubGlobal('fetch', fetch);
    await api.status(12, 'done');
    expect(fetch).toHaveBeenCalledWith(
      '/api/tasks/12/status',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'done' }),
      }),
    );
  });
});
