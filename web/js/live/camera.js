/**
 * 摄像头：前后翻转、权限被拒/没有摄像头时给出明确原因（界面据此优雅地引导去「上传精修」）。
 */
export function createCamera(/** @type {HTMLVideoElement} */ video) {
  /** @type {MediaStream | null} */ let stream = null;
  let facing = /** @type {'user' | 'environment'} */ ('user');
  let starting = /** @type {Promise<void> | null} */ (null);

  async function start() {
    if (stream) return;
    if (starting) return starting;
    starting = (async () => {
      if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('nocam'), { reason: 'none' });
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 }, frameRate: { ideal: 30 } } });
      } catch (e) {
        const name = /** @type {any} */ (e)?.name || '';
        const reason = name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'none' : 'busy';
        throw Object.assign(new Error(name || 'camera'), { reason });
      }
      video.srcObject = stream;
      video.muted = true; video.playsInline = true;
      await video.play().catch(() => {});
      if (!video.videoWidth) await new Promise(r => video.addEventListener('loadedmetadata', r, { once: true }));
    })();
    try { await starting; } finally { starting = null; }
  }
  function stop() {
    stream?.getTracks().forEach(t => t.stop());
    stream = null; video.srcObject = null;
  }
  async function flip() {
    facing = facing === 'user' ? 'environment' : 'user';
    stop();
    try { await start(); } catch (e) { facing = facing === 'user' ? 'environment' : 'user'; await start(); throw e; }
  }
  return {
    start, stop, flip,
    get on() { return !!stream; },
    get facing() { return facing; },
    get ready() { return !!stream && video.readyState >= 2 && video.videoWidth > 0; },
  };
}

/** 摄像头权限现在是什么状态（不弹窗）。 */
export async function cameraPermission() {
  try { return (await navigator.permissions?.query({ name: /** @type {any} */ ('camera') }))?.state || 'prompt'; } catch { return 'prompt'; }
}
