// This service worker immediately unregisters itself and clears all caches.
// It replaces the old broken service worker that was causing blank screens on refresh.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', async () => {
  // Unregister this service worker so the browser goes back to network-first
  await self.registration.unregister();
  // Clear all cached data from the old service worker
  const keys = await caches.keys();
  await Promise.all(keys.map(k => caches.delete(k)));
  // Force all open tabs to reload without SW interference
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => client.navigate(client.url));
});
