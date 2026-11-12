// Pick the microphone (AU-3, mock-up 19): the microphone takes are recorded with, chosen in Settings and kept in this
// browser (its id and name). '' is the computer's default.
import { keep, recall } from './remember';

// isDefault: the computer's default mic (its sound settings), shown "(default)" in Settings.
export type Mic = { id: string; name: string; isDefault?: boolean };
type GetStream = (constraints: MediaStreamConstraints) => Promise<MediaStream>;


export const chosenMic = (): Mic => ({ id: recall('mic'), name: recall('mic-name') });

export function chooseMic(mic: Mic): void {
  keep('mic', mic.id);
  keep('mic-name', mic.id ? mic.name : '');
}

// The microphones the browser shows, with the computer's default marked (AU-5, board 33). Before the browser may use
// the mic it hides their names (and ids), so then there are none to list. Tests stand in for the browser's device list
// with `window.studioMics`.
export async function listMics(): Promise<Mic[]> {
  const fake = (window as unknown as { studioMics?: () => Promise<Device[]> }).studioMics;
  try {
    return micsFrom(fake ? await fake() : await navigator.mediaDevices.enumerateDevices());
  } catch {
    return [];
  }
}

type Device = Pick<MediaDeviceInfo, 'deviceId' | 'kind' | 'label' | 'groupId'>;

// Chrome and Edge list the computer's default twice: as itself and as an extra "default" entry ("Default - Blue
// Yeti", same groupId). The extra entries ("default", "communications") are left out and mark the real mic instead.
// With no "default" entry the browser lists the default first.
export function micsFrom(devices: Device[]): Mic[] {
  const inputs = devices.filter((d) => d.kind === 'audioinput' && d.deviceId && d.label);
  const extra = inputs.find((d) => d.deviceId === 'default');
  const mics = inputs.filter((d) => d.deviceId !== 'default' && d.deviceId !== 'communications');
  const byGroup = extra?.groupId ? mics.filter((d) => d.groupId === extra.groupId) : [];
  const byName = extra ? mics.filter((d) => extra.label.endsWith(d.label)) : [];
  const def = (byGroup.length === 1 ? byGroup[0] : byName[0] ?? byGroup[0]) ?? (extra ? undefined : mics[0]);
  return mics.map((d) => ({ id: d.deviceId, name: d.label, ...(d === def ? { isDefault: true } : {}) }));
}

// The stream from the chosen mic. If it is unplugged (or gone), the default records instead and `fellBack` says so,
// so the take is never lost. Any other error (blocked, no mic at all) is thrown as it is.
// noise: the browser's own noise reduction, in Edge and Chrome alike (Settings > Voice-over, AU-4).
export async function openMic(id: string, get: GetStream, noise = true): Promise<{ stream: MediaStream; fellBack: boolean }> {
  const AUDIO = { echoCancellation: true, noiseSuppression: noise };
  if (!id) return { stream: await get({ audio: AUDIO }), fellBack: false };
  try {
    return { stream: await get({ audio: { ...AUDIO, deviceId: { exact: id } } }), fellBack: false };
  } catch (e) {
    // Chrome throws an OverconstrainedError (not always a DOMException) for a mic that isn't there any more.
    const name = (e as { name?: string } | null)?.name;
    if (name !== 'OverconstrainedError' && name !== 'NotFoundError') throw e;
    return { stream: await get({ audio: AUDIO }), fellBack: true };
  }
}
