import { describe, expect, it, vi } from 'vitest';
import { micsFrom, openMic } from '../../src/lib/mic';

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

  it("turns the browser's noise reduction off when Settings says so (AU-4)", async () => {
    const get = vi.fn().mockResolvedValue(stream);
    await openMic('', get);
    await openMic('yeti', get, false);
    expect(get.mock.calls[0][0].audio.noiseSuppression).toBe(true);
    expect(get.mock.calls[1][0].audio.noiseSuppression).toBe(false);
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

const dev = (deviceId: string, label: string, groupId = deviceId, kind = 'audioinput') => ({ deviceId, label, groupId, kind }) as MediaDeviceInfo;

describe('micsFrom (AU-5)', () => {
  it("marks the computer's default mic and leaves out the browser's extra entries", () => {
    const devices = [
      dev('default', 'Default - MacBook Pro Microphone (Built-in)', 'g2'),
      dev('communications', 'Communications - Blue Yeti', 'g1'),
      dev('yeti', 'Blue Yeti', 'g1'),
      dev('mbp', 'MacBook Pro Microphone (Built-in)', 'g2'),
      dev('spk', 'Speakers', 'g2', 'audiooutput')
    ];
    expect(micsFrom(devices)).toEqual([
      { id: 'yeti', name: 'Blue Yeti' },
      { id: 'mbp', name: 'MacBook Pro Microphone (Built-in)', isDefault: true }
    ]);
  });

  it('tells two mics on one device apart by name', () => {
    const devices = [dev('default', 'Default - Headset mic 2', 'g'), dev('a', 'Headset mic 1', 'g'), dev('b', 'Headset mic 2', 'g')];
    expect(micsFrom(devices).find((m) => m.isDefault)?.id).toBe('b');
  });

  it('takes the first mic as the default when the browser has no "default" entry', () => {
    expect(micsFrom([dev('a', 'A'), dev('b', 'B')])[0]).toEqual({ id: 'a', name: 'A', isDefault: true });
  });

  it('lists none while the browser hides the names', () => {
    expect(micsFrom([dev('', ''), dev('', '')])).toEqual([]);
  });
});
