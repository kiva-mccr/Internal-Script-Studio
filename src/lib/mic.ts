// Pick the microphone (AU-3, mock-up 19): the microphone takes are recorded with, chosen in Settings and kept in this
// browser (its id and name). '' is the computer's default.
import { keep, recall } from './remember';

export type Mic = { id: string; name: string };
type GetStream = (constraints: MediaStreamConstraints) => Promise<MediaStream>;

const AUDIO = { echoCancellation: true, noiseSuppression: true };

export const chosenMic = (): Mic => ({ id: recall('mic'), name: recall('mic-name') });

export function chooseMic(mic: Mic): void {
  keep('mic', mic.id);
  keep('mic-name', mic.id ? mic.name : '');
}

// The microphones the browser shows. Before Chrome may use the mic it hides their names (and ids), so then there are
// none to list but the default. Tests stand in for it with `window.studioMics`.
export async function listMics(): Promise<Mic[]> {
  const fake = (window as unknown as { studioMics?: () => Promise<Mic[]> }).studioMics;
  if (fake) return fake();
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications' && d.label)
      .map((d) => ({ id: d.deviceId, name: d.label }));
  } catch {
    return [];
  }
}

// The stream from the chosen mic. If it is unplugged (or gone), the default records instead and `fellBack` says so,
// so the take is never lost. Any other error (blocked, no mic at all) is thrown as it is.
export async function openMic(id: string, get: GetStream): Promise<{ stream: MediaStream; fellBack: boolean }> {
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
