import { describe, expect, it, vi } from 'vitest';
import { openMic } from '../../src/lib/mic';

const stream = {} as MediaStream;
const err = (name: string) => Object.assign(new Error(name), { name });

describe('openMic', () => {
  it('records with the default when no mic was picked', async () => {
    const get = vi.fn().mockResolvedValue(stream);
    expect(await openMic('', get)).toEqual({ stream, fellBack: false });
    expect(get.mock.calls[0][0].audio.deviceId).toBeUndefined();
  });

  it('asks for exactly the picked mic', async () => {
    const get = vi.fn().mockResolvedValue(stream);
    expect(await openMic('yeti', get)).toEqual({ stream, fellBack: false });
    expect(get.mock.calls[0][0].audio.deviceId).toEqual({ exact: 'yeti' });
  });

  it('falls back to the default when the picked mic is unplugged, and says so', async () => {
    for (const name of ['OverconstrainedError', 'NotFoundError']) {
      const get = vi.fn().mockRejectedValueOnce(err(name)).mockResolvedValue(stream);
      expect(await openMic('yeti', get)).toEqual({ stream, fellBack: true });
      expect(get.mock.calls[1][0].audio.deviceId).toBeUndefined();
    }
  });

  it('passes on a blocked microphone', async () => {
    const get = vi.fn().mockRejectedValue(err('NotAllowedError'));
    await expect(openMic('yeti', get)).rejects.toMatchObject({ name: 'NotAllowedError' });
    expect(get).toHaveBeenCalledTimes(1);
  });
});
