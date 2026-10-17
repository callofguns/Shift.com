// Android/Chrome offer an "Install app" prompt. We save it so the More screen can show a button.
export let installPrompt = null;
const listeners = new Set();

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  listeners.forEach((fn) => fn(e));
});

window.addEventListener('appinstalled', () => {
  installPrompt = null;
  listeners.forEach((fn) => fn(null));
});

export function onInstallPromptChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
