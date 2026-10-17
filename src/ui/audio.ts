let context: AudioContext | undefined, master: GainNode | undefined;
export async function setAmbience(enabled: boolean, volume: number) {
  if (!enabled) {
    if (context?.state === 'running') await context.suspend();
    return;
  }
  if (!context) {
    context = new AudioContext();
    master = context.createGain();
    master.connect(context.destination);
    [130.81, 196, 261.63].forEach((f, i) => {
      const tone = context!.createOscillator(),
        gain = context!.createGain();
      tone.type = 'sine';
      tone.frequency.value = f;
      gain.gain.value = 0.025 / (i + 1);
      tone.connect(gain).connect(master!);
      tone.start();
    });
  }
  master!.gain.setTargetAtTime(volume, context.currentTime, 0.5);
  await context.resume();
}
