export const isPersonalWorkspaceReadyOffline = async () => {
  const controller = navigator.serviceWorker?.controller;
  if (!controller?.scriptURL.endsWith('/local-workspace/service-worker.js'))
    return false;
  return new Promise<boolean>((resolve) => {
    const channel = new MessageChannel();
    const finish = (ready: boolean) => {
      clearTimeout(timeout);
      channel.port1.close();
      resolve(ready);
    };
    const timeout = setTimeout(() => finish(false), 5000);
    channel.port1.onmessage = (event) => finish(event.data === true);
    controller.postMessage('CHECK_READY', [channel.port2]);
  });
};

export const preparePersonalWorkspaceOffline = async () => {
  if (!('serviceWorker' in navigator))
    throw new Error('Offline startup is unavailable in this browser');
  const registration = await navigator.serviceWorker.register(
    '/local-workspace/service-worker.js',
    { scope: '/local-workspace/', updateViaCache: 'none' },
  );
  const installing = registration.installing;
  if (installing)
    await new Promise<void>((resolve, reject) => {
      const finish = () => {
        if (
          installing.state === 'activated' ||
          installing.state === 'installed'
        ) {
          cleanup();
          resolve();
        }
        if (installing.state === 'redundant') {
          cleanup();
          reject(new Error('Offline preparation failed'));
        }
      };
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Offline preparation timed out'));
      }, 60000);
      const cleanup = () => {
        clearTimeout(timeout);
        installing.removeEventListener('statechange', finish);
      };
      installing.addEventListener('statechange', finish);
      finish();
    });
};

export const removePersonalWorkspaceOffline = async () => {
  const registration =
    await navigator.serviceWorker?.getRegistration('/local-workspace/');
  if (registration?.scope === `${window.location.origin}/local-workspace/`)
    await registration.unregister();
  for (const key of await caches.keys()) {
    if (key.startsWith('twenty-personal-shell-')) await caches.delete(key);
  }
};
