import { useState, useEffect, useCallback } from 'react';

export const DEFAULT_SOCIAL_LINKS = {
  instagram: 'https://www.instagram.com/skandx.in',
  facebook: 'https://www.facebook.com/SkandXOfficial',
  whatsapp: 'https://wa.me/919497861379?text=Hello%20SkandX%20Team%2C%20I%20need%20help%20with%20my%20account.',
  whatsappNumber: '+919497861379',
  telegram: 'https://t.me/skandx_official',
  telegramBot: 'https://t.me/SkandXAlerts_bot'
};

let memorySocialLinks = null;
let fetchPromise = null;
const listeners = new Set();

function normalizeLinks(obj) {
  const merged = { ...DEFAULT_SOCIAL_LINKS, ...(obj || {}) };
  if (merged.facebook === 'https://www.facebook.com/skandx.in') {
    merged.facebook = DEFAULT_SOCIAL_LINKS.facebook;
  }
  return merged;
}

function getInitialLinks() {
  if (memorySocialLinks) return memorySocialLinks;
  try {
    const raw = localStorage.getItem('skx_social_links');
    if (raw) {
      const parsed = JSON.parse(raw);
      memorySocialLinks = normalizeLinks(parsed);
      return memorySocialLinks;
    }
  } catch (e) {}
  return DEFAULT_SOCIAL_LINKS;
}

function notifyListeners(nextLinks) {
  memorySocialLinks = normalizeLinks(nextLinks);
  try {
    localStorage.setItem('skx_social_links', JSON.stringify(memorySocialLinks));
  } catch (e) {}
  listeners.forEach(fn => {
    try { fn(memorySocialLinks); } catch (e) {}
  });
}

export async function fetchPlatformSocialLinks(force = false) {
  if (memorySocialLinks && !force) return memorySocialLinks;
  if (fetchPromise && !force) return fetchPromise;

  const apiBase = import.meta.env.VITE_API_URL || '';
  fetchPromise = fetch(`${apiBase}/api/social-links`)
    .then(r => r.json())
    .then(data => {
      if (data && data.links) {
        notifyListeners(data.links);
        return memorySocialLinks;
      }
      return getInitialLinks();
    })
    .catch(() => getInitialLinks())
    .finally(() => {
      fetchPromise = null;
    });

  return fetchPromise;
}

export function useSocialLinks() {
  const [links, setLinks] = useState(getInitialLinks);

  useEffect(() => {
    listeners.add(setLinks);
    fetchPlatformSocialLinks(false);
    return () => {
      listeners.delete(setLinks);
    };
  }, []);

  const refreshLinks = useCallback(() => fetchPlatformSocialLinks(true), []);

  const saveSocialLinks = useCallback(async (newLinks) => {
    const apiBase = import.meta.env.VITE_API_URL || '';
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${apiBase}/api/admin/social-links`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify(newLinks)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save social links');
    }
    if (data.links) {
      notifyListeners(data.links);
    }
    return data;
  }, []);

  return { links, refreshLinks, saveSocialLinks };
}
