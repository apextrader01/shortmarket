import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import AdBannerWidget from './AdBannerWidget';
import {
  Users, Flame, Clock, UserCheck, Search, Plus, Image as ImageIcon,
  MessageSquare, Share2, Trash2, Pin, X, Check, ChevronRight,
  TrendingUp, ShieldCheck, Sparkles, Zap, Award, ExternalLink,
  Send, ArrowLeft, Layers, RefreshCw, Infinity as InfinityIcon,
  Bookmark, Copy
} from 'lucide-react';

/**
 * ⚡ Browser-Side Adaptive 50MB -> ~40KB WebP Compressor
 * Accepts any user photo or 4K chart screenshot up to 50 MB,
 * scales on an HTML5 Canvas and runs an adaptive quality/dimension loop
 * until the resulting WebP payload is <= 42 KB (~35-42 KB).
 */
async function compressImageTo40KB(file) {
  const MAX_INPUT_BYTES = 50 * 1024 * 1024; // 50 MB max input
  const TARGET_MAX_BYTES = 42 * 1024; // ~40 KB target ceiling

  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('File exceeds 50 MB maximum upload size.');
  }

  const originalSizeKb = Math.round((file.size / 1024) * 10) / 10;

  // Decode image via createImageBitmap or HTMLImageElement fallback
  let imgSource = null;
  let rawWidth = 1280;
  let rawHeight = 720;

  if (typeof createImageBitmap === 'function') {
    imgSource = await createImageBitmap(file);
    rawWidth = imgSource.width;
    rawHeight = imgSource.height;
  } else {
    imgSource = await new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to decode image'));
      };
      img.src = url;
    });
    rawWidth = imgSource.naturalWidth || imgSource.width;
    rawHeight = imgSource.naturalHeight || imgSource.height;
  }

  let maxDim = 1280;
  let quality = 0.72;
  let bestBlob = null;

  const renderToWebpBlob = (w, h, q) =>
    new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(w));
      canvas.height = Math.max(1, Math.round(h));
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(imgSource, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/webp',
        q
      );
    });

  for (let pass = 0; pass < 10; pass++) {
    const scale = Math.min(1, maxDim / Math.max(rawWidth, rawHeight, 1));
    const targetW = rawWidth * scale;
    const targetH = rawHeight * scale;

    const blob = await renderToWebpBlob(targetW, targetH, quality);
    if (!blob) break;
    bestBlob = blob;

    if (blob.size <= TARGET_MAX_BYTES) {
      break;
    }

    if (quality > 0.36) {
      quality = Math.max(0.30, quality - 0.10);
    } else {
      maxDim = Math.max(480, Math.round(maxDim * 0.82));
      quality = 0.52;
    }
  }

  if (imgSource && typeof imgSource.close === 'function') {
    try { imgSource.close(); } catch (_) {}
  }

  if (!bestBlob) {
    throw new Error('Could not compress image to WebP');
  }

  const base64DataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(bestBlob);
  });

  const compressedSizeKb = Math.round((bestBlob.size / 1024) * 10) / 10;
  const savingsPct = file.size > 0
    ? Math.max(0, Math.min(99.9, Math.round((1 - bestBlob.size / file.size) * 1000) / 10))
    : 0;

  return {
    base64: base64DataUrl,
    originalSizeKb,
    compressedSizeKb,
    savingsPct
  };
}

function formatRelativeTime(dateInput) {
  if (!dateInput) return 'Just now';
  const diffSec = Math.max(1, Math.floor((Date.now() - new Date(dateInput).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  return new Date(dateInput).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function formatMembersCount(num) {
  const n = Number(num || 0);
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K members`;
  return `${n} members`;
}

export default function CommunityFeedView({ onOpenPaperTrading, onUpgradeClick }) {
  const { user, positions, setSelectedSymbol, openOrderModal, showToast } = useStore(
    useShallow(state => ({
      user: state.user,
      positions: state.positions,
      setSelectedSymbol: state.setSelectedSymbol,
      openOrderModal: state.openOrderModal,
      showToast: state.showToast
    }))
  );

  // Navigation Tabs: 'clubs' | 'hot' | 'new' | 'following' | 'saved'
  const [activeSubTab, setActiveSubTab] = useState('hot');
  const [clubs, setClubs] = useState([]);
  const [storagePolicy, setStoragePolicy] = useState({
    is_permanent: false,
    retention_tier: '30_DAYS',
    label: '⏱️ 30-Day Free Retention'
  });
  const [selectedClub, setSelectedClub] = useState(null);
  const [selectedTag, setSelectedTag] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Bookmarked / Saved Posts (persisted in localStorage)
  const [savedPostIds, setSavedPostIds] = useState(() => {
    try {
      const raw = localStorage.getItem('skandx_saved_community_posts');
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  });

  const toggleSavePost = (postId) => {
    setSavedPostIds(prev => {
      const exists = prev.includes(postId);
      const next = exists ? prev.filter(id => id !== postId) : [...prev, postId];
      try {
        localStorage.setItem('skandx_saved_community_posts', JSON.stringify(next));
      } catch (_) {}
      if (showToast) {
        showToast(exists ? 'Post removed from Saved' : '⭐ Post saved to Bookmarks!', 'info');
      }
      return next;
    });
  };

  // Feed State
  const [posts, setPosts] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Comments Drawer State (per post ID)
  const [openCommentsPostId, setOpenCommentsPostId] = useState(null);
  const [commentsByPost, setCommentsByPost] = useState({});
  const [commentInput, setCommentInput] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Fullscreen Image Lightbox
  const [lightboxImage, setLightboxImage] = useState(null);

  // Compose Modal State
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeClubId, setComposeClubId] = useState('');
  const [composeText, setComposeText] = useState('');
  const [compressingImage, setCompressingImage] = useState(false);
  const [uploadedImageInfo, setUploadedImageInfo] = useState(null);
  const [attachTradeSetup, setAttachTradeSetup] = useState(false);
  const [tradeSetupForm, setTradeSetupForm] = useState({
    symbol: 'NSE:NIFTY50-INDEX',
    strategy: 'INTRADAY OPTIONS SETUP',
    legs: [
      { side: 'BUY', lots: '1 LOT', type: 'CE', strike: '25000', price: '140.0' }
    ],
    maxProfit: '₹7,500',
    maxLoss: '₹3,000',
    lotSize: '75',
    margin: '₹10,500'
  });
  const [publishingPost, setPublishingPost] = useState(false);
  const fileInputRef = useRef(null);

  const authHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

  // Load Clubs & User Storage Policy
  const fetchClubs = async () => {
    try {
      const res = await fetch('/api/community/clubs', { headers: authHeaders() });
      const data = await res.json();
      if (data.success) {
        setClubs(data.clubs || []);
        if (data.storage_policy) setStoragePolicy(data.storage_policy);
        if (!composeClubId && data.clubs?.length > 0) {
          setComposeClubId(String(data.clubs[0].id));
        }
      }
    } catch (err) {
      console.warn('Error fetching clubs:', err);
    }
  };

  // Load Feed Posts
  const fetchFeed = async (resetPage = 1, tabOverride = activeSubTab, clubOverride = selectedClub, tagOverride = selectedTag, searchOverride = searchQuery) => {
    if (tabOverride === 'clubs') return;
    if (tabOverride === 'saved') {
      if (!savedPostIds || savedPostIds.length === 0) {
        setPosts([]);
        setLoadingFeed(false);
        setHasMore(false);
        return;
      }
    }
    setLoadingFeed(resetPage === 1);
    try {
      const params = new URLSearchParams({
        tab: tabOverride,
        page: String(resetPage),
        limit: '15'
      });
      if (tabOverride === 'saved' && savedPostIds.length > 0) {
        params.set('post_ids', savedPostIds.join(','));
      }
      if (clubOverride?.id) params.set('club_id', String(clubOverride.id));
      if (tagOverride) params.set('tag', tagOverride);
      if (searchOverride.trim()) params.set('search', searchOverride.trim());

      const res = await fetch(`/api/community/feed?${params.toString()}`, {
        headers: authHeaders()
      });
      const data = await res.json();
      if (data.success) {
        if (resetPage === 1) {
          setPosts(data.posts || []);
        } else {
          setPosts(prev => [...prev, ...(data.posts || [])]);
        }
        setPage(resetPage);
        setHasMore(Boolean(data.has_more));
      }
    } catch (err) {
      console.warn('Error fetching feed:', err);
    } finally {
      setLoadingFeed(false);
    }
  };

  useEffect(() => {
    fetchClubs();
  }, []);

  useEffect(() => {
    if (activeSubTab !== 'clubs') {
      fetchFeed(1, activeSubTab, selectedClub, selectedTag, searchQuery);
    }
  }, [activeSubTab, selectedClub, selectedTag]);

  // Handle Club Join / Leave
  const handleToggleJoinClub = async (club, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`/api/community/clubs/${club.id}/toggle-join`, {
        method: 'POST',
        headers: authHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setClubs(prev =>
          prev.map(c =>
            c.id === club.id
              ? { ...c, is_joined: data.is_joined, members_count: data.members_count }
              : c
          )
        );
        if (showToast) {
          showToast(
            data.is_joined ? `Joined ${club.name}` : `Left ${club.name}`,
            'success'
          );
        }
      }
    } catch (_) {}
  };

  // Handle Image Selection or Clipboard Paste -> Compress 50MB to ~40KB WebP -> Upload
  const handleProcessImageFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      if (showToast) showToast('Please select a valid image file (PNG, JPG, WebP)', 'error');
      return;
    }
    setCompressingImage(true);
    try {
      const compressed = await compressImageTo40KB(file);
      const res = await fetch('/api/community/upload-image', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          image_base64: compressed.base64,
          original_size_kb: compressed.originalSizeKb
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Upload failed');
      }
      setUploadedImageInfo({
        image_url: data.image_url,
        preview_url: compressed.base64,
        original_size_kb: compressed.originalSizeKb,
        size_kb: data.size_kb,
        savings_pct: compressed.savingsPct,
        is_permanent: data.is_permanent,
        policy_label: data.policy_label
      });
      if (showToast) {
        const origLabel = compressed.originalSizeKb >= 1024
          ? `${(compressed.originalSizeKb / 1024).toFixed(2)} MB`
          : `${compressed.originalSizeKb} KB`;
        showToast(
          `⚡ Compressed ${origLabel} → ${data.size_kb} KB WebP (${compressed.savingsPct}% saved!)`,
          'success'
        );
      }
    } catch (err) {
      if (showToast) showToast(err.message || 'Image compression failed', 'error');
    } finally {
      setCompressingImage(false);
    }
  };

  // Import active SkandX position into Trade Setup Card with 1 click
  const activePositions = useMemo(() => {
    return (positions || []).filter(p => Number(p.quantity) !== 0);
  }, [positions]);

  const handleImportPosition = (pos) => {
    const qty = Number(pos.quantity || 0);
    const side = qty >= 0 ? 'BUY' : 'SELL';
    const avgPrice = Number(pos.average_price || 0).toFixed(2);
    const cleanSym = String(pos.symbol || '');
    setAttachTradeSetup(true);
    setTradeSetupForm({
      symbol: cleanSym,
      strategy: `${pos.product_type === 'DEL' ? 'SWING / DELIVERY' : 'INTRADAY'} POSITION`,
      legs: [
        {
          side,
          lots: `${Math.abs(qty)} QTY`,
          type: cleanSym.includes('CE') ? 'CE' : cleanSym.includes('PE') ? 'PE' : 'EQ/FUT',
          strike: cleanSym.replace(/^(NSE:|BSE:|MCX:)/i, ''),
          price: avgPrice
        }
      ],
      maxProfit: 'OPEN',
      maxLoss: 'DEFINED SL',
      lotSize: String(Math.abs(qty)),
      margin: `₹${Math.round(Number(pos.margin || Math.abs(qty) * Number(pos.average_price || 0))).toLocaleString('en-IN')}`
    });
    if (!composeText.includes(`#${cleanSym.replace(/^(NSE:|BSE:|MCX:)/i, '').replace(/-(EQ|INDEX)$/i, '')}`)) {
      const tag = cleanSym.replace(/^(NSE:|BSE:|MCX:)/i, '').replace(/-(EQ|INDEX)$/i, '');
      setComposeText(prev => `${prev ? prev + ' ' : ''}#${tag} `);
    }
  };

  // Publish Community Post
  const handlePublishPost = async () => {
    if (!composeText.trim() && !uploadedImageInfo && !attachTradeSetup) {
      if (showToast) showToast('Write a message, attach a chart photo, or add a trade setup.', 'error');
      return;
    }
    setPublishingPost(true);
    try {
      const payload = {
        club_id: composeClubId ? Number(composeClubId) : (selectedClub?.id || null),
        content: composeText.trim(),
        image_url: uploadedImageInfo?.image_url || null,
        original_size_kb: uploadedImageInfo?.original_size_kb || null,
        image_size_kb: uploadedImageInfo?.size_kb || null,
        trade_setup: attachTradeSetup ? tradeSetupForm : null
      };

      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to publish post');
      }

      setPosts(prev => [data.post, ...prev]);
      setComposeText('');
      setUploadedImageInfo(null);
      setAttachTradeSetup(false);
      setShowComposeModal(false);
      if (activeSubTab === 'clubs') setActiveSubTab('new');
      if (showToast) showToast('🚀 Post published to Traders Community!', 'success');
    } catch (err) {
      if (showToast) showToast(err.message || 'Failed to publish post', 'error');
    } finally {
      setPublishingPost(false);
    }
  };

  // Upvote Post with Optimistic Feedback
  const handleToggleVote = async (postId) => {
    setPosts(prev =>
      prev.map(p => {
        if (p.id !== postId) return p;
        const nextVoted = !p.has_voted;
        const nextCount = nextVoted ? (p.upvotes_count || 0) + 1 : Math.max(0, (p.upvotes_count || 1) - 1);
        return { ...p, has_voted: nextVoted, upvotes_count: nextCount };
      })
    );
    try {
      const res = await fetch(`/api/community/posts/${postId}/vote`, {
        method: 'POST',
        headers: authHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setPosts(prev =>
          prev.map(p =>
            p.id === postId
              ? { ...p, has_voted: data.has_voted, upvotes_count: data.upvotes_count }
              : p
          )
        );
      }
    } catch (_) {}
  };

  // Follow / Unfollow Trader
  const handleToggleFollow = async (targetUserId) => {
    try {
      const res = await fetch(`/api/community/users/${targetUserId}/toggle-follow`, {
        method: 'POST',
        headers: authHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setPosts(prev =>
          prev.map(p =>
            p.user_id === targetUserId
              ? { ...p, is_following: data.is_following }
              : p
          )
        );
        if (showToast) {
          showToast(data.is_following ? 'Following trader!' : 'Unfollowed trader', 'info');
        }
      }
    } catch (_) {}
  };

  // Open & Load Comments for a Post
  const handleToggleComments = async (postId) => {
    if (openCommentsPostId === postId) {
      setOpenCommentsPostId(null);
      return;
    }
    setOpenCommentsPostId(postId);
    if (!commentsByPost[postId]) {
      try {
        const res = await fetch(`/api/community/posts/${postId}/comments`, {
          headers: authHeaders()
        });
        const data = await res.json();
        if (data.success) {
          setCommentsByPost(prev => ({ ...prev, [postId]: data.comments || [] }));
        }
      } catch (_) {}
    }
  };

  const handleSendComment = async (postId) => {
    const text = commentInput.trim();
    if (!text || submittingComment) return;
    setSubmittingComment(true);
    setCommentInput('');

    // Optimistic comment insert
    const tempComment = {
      id: Date.now(),
      post_id: postId,
      user_id: user?.id,
      content: text,
      created_at: new Date().toISOString(),
      username: user?.username || 'You',
      profile_picture_url: user?.profile_picture_url || null,
      subscription_tier: user?.subscription_tier || 'BASIC',
      is_admin: Boolean(user?.is_admin)
    };
    setCommentsByPost(prev => ({
      ...prev,
      [postId]: [...(prev[postId] || []), tempComment]
    }));
    setPosts(prev =>
      prev.map(p =>
        p.id === postId ? { ...p, comments_count: Number(p.comments_count || 0) + 1 } : p
      )
    );

    try {
      const res = await fetch(`/api/community/posts/${postId}/comments`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ content: text })
      });
      const data = await res.json();
      if (data.success && data.comment) {
        setCommentsByPost(prev => ({
          ...prev,
          [postId]: prev[postId].map(c => c.id === tempComment.id ? data.comment : c)
        }));
      }
    } catch (_) {
      if (showToast) showToast('Failed to post comment', 'error');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Delete or Pin Post
  const handleDeletePost = async (postId) => {
    if (!window.confirm('Delete this post permanently from the community?')) return;
    try {
      const res = await fetch(`/api/community/posts/${postId}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setPosts(prev => prev.filter(p => p.id !== postId));
        if (showToast) showToast('Post deleted', 'info');
      }
    } catch (_) {}
  };

  const handlePinPost = async (postId) => {
    try {
      const res = await fetch(`/api/community/posts/${postId}/pin`, {
        method: 'POST',
        headers: authHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setPosts(prev =>
          prev.map(p => (p.id === postId ? { ...p, is_pinned: data.is_pinned } : p))
        );
        if (showToast) showToast(data.is_pinned ? '📌 Post pinned to top' : 'Post unpinned', 'success');
      }
    } catch (_) {}
  };

  // Enhanced Native Mobile + Web Share
  const handleSharePost = async (post) => {
    const snippet = (post.content || '').slice(0, 160);
    const setupText = post.trade_setup ? `\n📊 Setup: ${post.trade_setup.symbol} (${post.trade_setup.strategy || ''})` : '';
    const shareUrl = `${window.location.origin}/community?post=${post.id}`;
    const shareTitle = `${post.username} on SkandX Community`;
    const fullText = `🔥 ${post.username} in ${post.club_name} on SkandX:\n"${snippet}"${setupText}\n\n👉 View setup on ${shareUrl}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: fullText,
          url: shareUrl
        });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      if (showToast) showToast('🔗 Post link copied to clipboard!', 'success');
    } catch (_) {}

    window.open(`https://wa.me/?text=${encodeURIComponent(fullText)}`, '_blank', 'noopener,noreferrer');
  };

  // Navigate to Symbol on SkandX Paper Trading Chart when clicking a #SYMBOL hashtag
  const handleSymbolClick = (rawSymbol) => {
    const clean = String(rawSymbol || '').replace(/^#/, '').toUpperCase().trim();
    if (!clean) return;
    const symbolMap = {
      NIFTY: 'NSE:NIFTY50-INDEX',
      NIFTY50: 'NSE:NIFTY50-INDEX',
      BANKNIFTY: 'NSE:NIFTYBANK-INDEX',
      NIFTYBANK: 'NSE:NIFTYBANK-INDEX',
      FINNIFTY: 'NSE:FINNIFTY-INDEX',
      SENSEX: 'BSE:SENSEX-INDEX',
      CRUDEOIL: 'MCX:CRUDEOIL26OCTFUT',
      GOLD: 'NSE:GOLD1-EQ'
    };
    const resolved = symbolMap[clean] || (clean.includes(':') ? clean : `NSE:${clean}-EQ`);
    if (typeof setSelectedSymbol === 'function') {
      setSelectedSymbol(resolved);
    }
    if (typeof onOpenPaperTrading === 'function') {
      onOpenPaperTrading();
    }
  };

  // Render post text with clickable #SYMBOL hashtags
  const renderFormattedContent = (text) => {
    if (!text) return null;
    const parts = text.split(/(#[A-Za-z0-9_:-]{2,30})/g);
    return parts.map((part, i) => {
      if (part.startsWith('#') && part.length > 2) {
        const sym = part.slice(1).toUpperCase();
        return (
          <span
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTag(sym);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              handleSymbolClick(sym);
            }}
            title={`Click to filter #${sym} posts • Double-click to open ${sym} Live Chart`}
            style={{
              color: '#38bdf8',
              fontWeight: '700',
              cursor: 'pointer',
              background: 'rgba(56, 189, 248, 0.1)',
              padding: '1px 6px',
              borderRadius: '4px',
              margin: '0 1px',
              display: 'inline-block'
            }}
          >
            {part}
          </span>
        );
      }
      return <React.Fragment key={i}>{part}</React.Fragment>;
    });
  };

  const renderTierBadge = (tierRaw, isAdmin) => {
    if (isAdmin) {
      return (
        <span style={{ fontSize: '10px', background: 'linear-gradient(135deg, #2563eb, #38bdf8)', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontWeight: '800' }}>
          🛡️ ADMIN
        </span>
      );
    }
    const t = String(tierRaw || 'BASIC').toUpperCase();
    if (t === 'LIFETIME') {
      return <span style={{ fontSize: '10px', background: 'linear-gradient(135deg, #e11d48, #f59e0b)', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontWeight: '800' }}>👑 LIFETIME</span>;
    }
    if (t === 'YEARLY') {
      return <span style={{ fontSize: '10px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000', padding: '1px 6px', borderRadius: '4px', fontWeight: '800' }}>⭐ YEARLY</span>;
    }
    if (['HIGHEST', 'FEATURE', 'VIP', 'MASTERCLASS'].includes(t)) {
      return <span style={{ fontSize: '10px', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontWeight: '800' }}>👑 {t}</span>;
    }
    if (['MONTHLY', 'PRO'].includes(t)) {
      return <span style={{ fontSize: '10px', background: 'rgba(56, 189, 248, 0.18)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)', padding: '1px 6px', borderRadius: '4px', fontWeight: '800' }}>⚡ PRO</span>;
    }
    return null;
  };

  const joinedClubs = useMemo(() => clubs.filter(c => c.is_joined), [clubs]);
  const clubsByCategory = useMemo(() => {
    const groups = {
      'EXPLORING TRADERS': [],
      'INVESTORS': [],
      'LANGUAGES': []
    };
    clubs.forEach(c => {
      const cat = c.category || 'EXPLORING TRADERS';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(c);
    });
    return groups;
  }, [clubs]);

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      minHeight: 0,
      overflowY: 'auto',
      background: '#0b101b',
      color: '#f8fafc',
      position: 'relative',
      fontFamily: "'Inter', system-ui, sans-serif"
    }}>
      {/* ─── Responsive Styles for Desktop & Mobile ─── */}
      <style>{`
        .spin-anim {
          animation: comm-spin 0.8s linear infinite;
        }
        @keyframes comm-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .comm-tab-btn:hover {
          color: #38bdf8 !important;
        }
        .comm-action-btn:hover {
          filter: brightness(1.2);
        }
        @media (max-width: 768px) {
          .comm-header-top {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
          }
          .comm-header-title-row {
            justify-content: space-between !important;
            width: 100% !important;
          }
          .comm-header-subtext {
            display: none !important;
          }
          .comm-header-actions {
            width: 100% !important;
            flex: 1 1 100% !important;
            justify-content: space-between !important;
          }
          .comm-search-box {
            max-width: 100% !important;
            flex: 1 1 auto !important;
          }
          .comm-tabs-bar {
            gap: 14px !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
            scrollbar-width: none !important;
          }
          .comm-tabs-bar::-webkit-scrollbar {
            display: none !important;
          }
          .comm-trade-payoff-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }
          .comm-floating-btn {
            bottom: 76px !important;
            right: 18px !important;
            width: 50px !important;
            height: 50px !important;
          }
          .comm-quick-compose-text {
            font-size: 12px !important;
          }
          .comm-card {
            padding: 12px !important;
          }
        }
      `}</style>

      {/* ─── Top Sticky FrontPage-Style Community Header & Tabs ─── */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        background: 'rgba(15, 23, 42, 0.96)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{
          maxWidth: '980px',
          margin: '0 auto',
          padding: '12px 16px 0 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          {/* Title Row + Search + Retention Vault Pill */}
          <div className="comm-header-top" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div className="comm-header-title-row" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '9px',
                background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 14px rgba(56, 189, 248, 0.35)',
                flexShrink: 0
              }}>
                <Users size={18} color="#fff" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '16px', fontWeight: '800', letterSpacing: '-0.3px', color: '#fff', whiteSpace: 'nowrap' }}>
                    Traders Community
                  </span>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '800',
                    padding: '2px 7px',
                    borderRadius: '999px',
                    background: storagePolicy.is_permanent
                      ? 'rgba(16, 185, 129, 0.15)'
                      : 'rgba(56, 189, 248, 0.12)',
                    color: storagePolicy.is_permanent ? '#34d399' : '#38bdf8',
                    border: `1px solid ${storagePolicy.is_permanent ? 'rgba(16, 185, 129, 0.35)' : 'rgba(56, 189, 248, 0.3)'}`,
                    whiteSpace: 'nowrap'
                  }}>
                    {storagePolicy.label}
                  </span>
                </div>
                <div className="comm-header-subtext" style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  Live NSE/BSE/MCX Charts, Option Strategies & Verified Setups • Ultra-Fast 40KB WebP Engine
                </div>
              </div>
            </div>

            {/* Search Bar + Compose Trigger */}
            <div className="comm-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 260px', justifyContent: 'flex-end' }}>
              <div className="comm-search-box" style={{
                position: 'relative',
                flex: '1 1 200px',
                maxWidth: '300px'
              }}>
                <Search size={14} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (activeSubTab === 'clubs') setActiveSubTab('hot');
                      fetchFeed(1, activeSubTab === 'clubs' ? 'hot' : activeSubTab, selectedClub, selectedTag, searchQuery);
                    }
                  }}
                  placeholder="Search #NIFTY50, traders, clubs..."
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '6px 28px 6px 30px',
                    color: '#f8fafc',
                    fontSize: '12px',
                    outline: 'none'
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      fetchFeed(1, activeSubTab, selectedClub, selectedTag, '');
                    }}
                    style={{
                      position: 'absolute',
                      right: '6px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer'
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowComposeModal(true)}
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '7px 13px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
                  flexShrink: 0
                }}
              >
                <Plus size={15} />
                <span>Post Setup</span>
              </button>
            </div>
          </div>

          {/* FrontPage Tab Bar: Clubs | Hot | New | Following | Saved + Refresh Button */}
          <div className="comm-tabs-bar" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            marginTop: '2px',
            borderBottom: '1px solid transparent'
          }}>
            {[
              { id: 'clubs', label: 'Clubs', icon: Users },
              { id: 'hot', label: 'Hot', icon: Flame },
              { id: 'new', label: 'New', icon: Clock },
              { id: 'following', label: 'Following', icon: UserCheck },
              { id: 'saved', label: savedPostIds.length > 0 ? `Saved (${savedPostIds.length})` : 'Saved', icon: Bookmark }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id)}
                  className="comm-tab-btn"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: isActive ? '2.5px solid #3b82f6' : '2.5px solid transparent',
                    color: isActive ? '#3b82f6' : '#94a3b8',
                    padding: '8px 4px 10px 4px',
                    fontSize: '13.5px',
                    fontWeight: isActive ? '800' : '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  <Icon size={15} />
                  <span>{tab.label}</span>
                </button>
              );
            })}

            {/* Quick Live Refresh Button */}
            <button
              onClick={async () => {
                setIsRefreshing(true);
                await fetchFeed(1, activeSubTab, selectedClub, selectedTag, searchQuery);
                setIsRefreshing(false);
                if (showToast) showToast('Feed updated', 'info');
              }}
              title="Refresh feed"
              style={{
                marginLeft: 'auto',
                background: 'transparent',
                border: 'none',
                color: isRefreshing ? '#38bdf8' : '#64748b',
                cursor: 'pointer',
                padding: '6px 8px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: '600',
                flexShrink: 0
              }}
            >
              <RefreshCw size={13} className={isRefreshing ? 'spin-anim' : ''} />
              <span style={{ display: 'none' }} className="comm-refresh-text">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Main Body Container ─── */}
      <div style={{
        maxWidth: '980px',
        width: '100%',
        margin: '0 auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        paddingBottom: '90px'
      }}>
        {/* Active Club / Hashtag Filter Banner */}
        {activeSubTab !== 'clubs' && (selectedClub || selectedTag) && (
          <div style={{
            background: 'rgba(30, 41, 59, 0.85)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '10px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {selectedClub && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: '700'
                }}>
                  <span>{selectedClub.icon}</span>
                  <span>{selectedClub.name}</span>
                  <button
                    onClick={() => setSelectedClub(null)}
                    style={{ background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', marginLeft: '4px' }}
                  >
                    ✕
                  </button>
                </span>
              )}
              {selectedTag && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: '700'
                }}>
                  <span>#{selectedTag}</span>
                  <button
                    onClick={() => handleSymbolClick(selectedTag)}
                    style={{
                      background: '#10b981',
                      color: '#000',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '1px 6px',
                      fontSize: '10.5px',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    Open Chart 📈
                  </button>
                  <button
                    onClick={() => setSelectedTag('')}
                    style={{ background: 'transparent', border: 'none', color: '#34d399', cursor: 'pointer', marginLeft: '2px' }}
                  >
                    ✕
                  </button>
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setSelectedClub(null);
                setSelectedTag('');
              }}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#cbd5e1',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '11.5px',
                cursor: 'pointer'
              }}
            >
              Show All Clubs
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 1: CLUBS VIEW ("Your Clubs" + "Discover Clubs")
           ═══════════════════════════════════════════════════════════════════════ */}
        {activeSubTab === 'clubs' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {/* Your Clubs Section */}
            <div style={{
              background: '#131b2e',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '12px',
              padding: '16px'
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '800',
                color: '#f8fafc',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span>Your Clubs ({joinedClubs.length})</span>
                <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '500' }}>
                  Click any club to view live chart setups
                </span>
              </div>

              {joinedClubs.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: '12.5px', padding: '12px 0' }}>
                  You haven’t joined any clubs yet. Join a club below to customize your feed!
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '10px'
                }}>
                  {joinedClubs.map(club => (
                    <div
                      key={club.id}
                      onClick={() => {
                        setSelectedClub(club);
                        setActiveSubTab('hot');
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '10px',
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: `${club.accent_color || '#38bdf8'}22`,
                          border: `1px solid ${club.accent_color || '#38bdf8'}55`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '20px',
                          flexShrink: 0
                        }}>
                          {club.icon}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {club.name}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                            {formatMembersCount(club.members_count)} • Active {formatRelativeTime(club.last_posted_at)}
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={16} color="#64748b" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Discover Clubs by Category */}
            {Object.entries(clubsByCategory).map(([categoryName, categoryClubs]) => (
              <div
                key={categoryName}
                style={{
                  background: '#131b2e',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '12px',
                  padding: '16px'
                }}
              >
                <div style={{
                  fontSize: '11.5px',
                  fontWeight: '800',
                  letterSpacing: '0.8px',
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  marginBottom: '12px'
                }}>
                  Discover Clubs — {categoryName}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {categoryClubs.map(club => (
                    <div
                      key={club.id}
                      onClick={() => {
                        setSelectedClub(club);
                        setActiveSubTab('hot');
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '10px',
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          background: `${club.accent_color || '#38bdf8'}20`,
                          border: `1px solid ${club.accent_color || '#38bdf8'}45`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '20px',
                          flexShrink: 0
                        }}>
                          {club.icon}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '14px', fontWeight: '700', color: '#f8fafc' }}>
                              {club.name}
                            </span>
                            <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '600' }}>
                              • {formatMembersCount(club.members_count)}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '3px', lineHeight: '1.4' }}>
                            {club.description}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleToggleJoinClub(club, e)}
                        style={{
                          background: club.is_joined ? 'rgba(59, 130, 246, 0.12)' : '#2563eb',
                          color: club.is_joined ? '#60a5fa' : '#ffffff',
                          border: club.is_joined ? '1px solid rgba(59, 130, 246, 0.35)' : 'none',
                          borderRadius: '8px',
                          padding: '6px 14px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          flexShrink: 0
                        }}
                      >
                        {club.is_joined ? 'Joined ✓' : '+ Join'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ═══════════════════════════════════════════════════════════════════════
              TAB 2 / 3 / 4: FEED VIEW (Hot | New | Following)
             ═══════════════════════════════════════════════════════════════════════ */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Quick Inline Compose Box */}
            <div
              onClick={() => setShowComposeModal(true)}
              style={{
                background: '#131b2e',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '800',
                  fontSize: '13px',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  overflow: 'hidden',
                  flexShrink: 0
                }}>
                  {user?.profile_picture_url ? (
                    <img src={user.profile_picture_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    (user?.username || 'T').charAt(0).toUpperCase()
                  )}
                </div>
                <span style={{ color: '#64748b', fontSize: '13px' }}>
                  Share your #NIFTY50 view, upload a 50MB chart photo (auto-compressed to 40KB WebP), or post a Trade Setup...
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <span style={{
                  background: 'rgba(56, 189, 248, 0.12)',
                  color: '#38bdf8',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <ImageIcon size={13} />
                  <span>Photo</span>
                </span>
                <span style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#34d399',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <TrendingUp size={13} />
                  <span>Setup</span>
                </span>
              </div>
            </div>

            {/* Trending Hashtag Quick Filter Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              overflowX: 'auto',
              paddingBottom: '2px'
            }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', whiteSpace: 'nowrap' }}>
                TRENDING:
              </span>
              {['NIFTY50', 'BANKNIFTY', 'FINNIFTY', 'RELIANCE', 'ICICIBANK', 'TCS', 'SENSEX', 'CRUDEOIL', 'OPTIONS'].map(tag => {
                const isSelected = selectedTag === tag;
                return (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(isSelected ? '' : tag)}
                    style={{
                      background: isSelected ? '#2563eb' : 'rgba(255, 255, 255, 0.04)',
                      color: isSelected ? '#fff' : '#94a3b8',
                      border: `1px solid ${isSelected ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)'}`,
                      borderRadius: '999px',
                      padding: '4px 10px',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>

            {/* Posts List */}
            {loadingFeed ? (
              <div style={{ padding: '48px 0', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                Loading live trader feed...
              </div>
            ) : posts.length === 0 ? (
              activeSubTab === 'saved' ? (
                <div style={{
                  background: '#131b2e',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '12px',
                  padding: '40px 20px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔖</div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#f8fafc', marginBottom: '6px' }}>
                    No Saved Posts Yet
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#94a3b8', maxWidth: '380px', margin: '0 auto 16px', lineHeight: '1.5' }}>
                    Bookmark any post, chart idea, or trade setup by clicking the bookmark icon to save it here for fast reference.
                  </div>
                  <button
                    onClick={() => setActiveSubTab('hot')}
                    style={{
                      background: '#2563eb',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 18px',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Explore Hot Feed
                  </button>
                </div>
              ) : (
                <div style={{
                  background: '#131b2e',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '12px',
                  padding: '36px 20px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#f8fafc', marginBottom: '6px' }}>
                    No posts match this filter yet
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '16px' }}>
                    Be the first trader to share your chart analysis or F&O strategy setup!
                  </div>
                  <button
                    onClick={() => setShowComposeModal(true)}
                    style={{
                      background: '#2563eb',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    + Create First Post
                  </button>
                </div>
              )
            ) : (
              posts.map((post, idx) => (
                <React.Fragment key={post.id}>
                  <div
                    style={{
                      background: '#131b2e',
                      border: post.is_pinned
                        ? '1px solid rgba(245, 158, 11, 0.4)'
                        : '1px solid rgba(255, 255, 255, 0.07)',
                      borderRadius: '12px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                  >
                    {/* Pinned Banner */}
                    {post.is_pinned && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11px',
                        fontWeight: '800',
                        color: '#f59e0b'
                      }}>
                        <Pin size={12} />
                        <span>PINNED BY MODERATOR</span>
                      </div>
                    )}

                    {/* Post Author Row */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #1e293b, #334155)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '800',
                          fontSize: '14px',
                          color: '#38bdf8',
                          overflow: 'hidden',
                          flexShrink: 0
                        }}>
                          {post.profile_picture_url ? (
                            <img src={post.profile_picture_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            (post.username || 'T').charAt(0).toUpperCase()
                          )}
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#f8fafc' }}>
                              {post.username}
                            </span>
                            {renderTierBadge(post.subscription_tier, post.is_admin)}
                            <span style={{
                              fontSize: '10px',
                              background: 'rgba(245, 158, 11, 0.14)',
                              color: '#fbbf24',
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontWeight: '700'
                            }}>
                              🏆 Top 10% Poster
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#94a3b8', marginTop: '2px', flexWrap: 'wrap' }}>
                            <span>in</span>
                            <span
                              onClick={() => {
                                const found = clubs.find(c => c.id === post.club_id);
                                if (found) setSelectedClub(found);
                              }}
                              style={{ color: '#cbd5e1', fontWeight: '600', cursor: 'pointer' }}
                            >
                              {post.club_icon} {post.club_name}
                            </span>
                            <span>•</span>
                            <span>{formatRelativeTime(post.created_at)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Actions: Follow / Pin / Delete */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        {post.user_id !== user?.id && (
                          <button
                            onClick={() => handleToggleFollow(post.user_id)}
                            style={{
                              background: post.is_following ? 'rgba(255,255,255,0.06)' : 'rgba(59, 130, 246, 0.15)',
                              color: post.is_following ? '#94a3b8' : '#60a5fa',
                              border: `1px solid ${post.is_following ? 'rgba(255,255,255,0.1)' : 'rgba(59, 130, 246, 0.35)'}`,
                              borderRadius: '6px',
                              padding: '4px 9px',
                              fontSize: '11px',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}
                          >
                            {post.is_following ? 'Following' : '+ Follow'}
                          </button>
                        )}
                        {user?.is_admin && (
                          <button
                            onClick={() => handlePinPost(post.id)}
                            title={post.is_pinned ? 'Unpin post' : 'Pin post'}
                            style={{
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              color: post.is_pinned ? '#f59e0b' : '#94a3b8',
                              borderRadius: '6px',
                              padding: '5px',
                              cursor: 'pointer'
                            }}
                          >
                            <Pin size={13} />
                          </button>
                        )}
                        {(post.user_id === user?.id || user?.is_admin) && (
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            title="Delete post"
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              color: '#f87171',
                              borderRadius: '6px',
                              padding: '5px',
                              cursor: 'pointer'
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Post Text Body with Clickable #SYMBOL Hashtags */}
                    {post.content && (
                      <div style={{
                        fontSize: '13.5px',
                        lineHeight: '1.55',
                        color: '#e2e8f0',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}>
                        {renderFormattedContent(post.content)}
                      </div>
                    )}

                    {/* ─── FrontPage-Style Zero-Storage JSON Trade Setup Card ─── */}
                    {post.trade_setup && (
                      <div style={{
                        background: '#0f172a',
                        border: '1px solid rgba(56, 189, 248, 0.22)',
                        borderRadius: '10px',
                        overflow: 'hidden'
                      }}>
                        {/* Setup Header */}
                        <div style={{
                          padding: '9px 14px',
                          background: 'rgba(30, 41, 59, 0.7)',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '8px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '800', color: '#f8fafc' }}>
                              {post.trade_setup.symbol}
                            </span>
                            {post.trade_setup.strategy && (
                              <span style={{
                                fontSize: '10.5px',
                                background: 'rgba(56, 189, 248, 0.14)',
                                color: '#38bdf8',
                                padding: '2px 7px',
                                borderRadius: '4px',
                                fontWeight: '700'
                              }}>
                                {post.trade_setup.strategy}
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => handleSymbolClick(post.trade_setup.symbol)}
                              style={{
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: '#34d399',
                                border: '1px solid rgba(16, 185, 129, 0.35)',
                                borderRadius: '6px',
                                padding: '4px 9px',
                                fontSize: '11px',
                                fontWeight: '800',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <span>Open Chart</span>
                              <ExternalLink size={11} />
                            </button>

                            <button
                              onClick={() => {
                                const cleanSym = post.trade_setup.symbol;
                                const firstLeg = Array.isArray(post.trade_setup.legs) && post.trade_setup.legs[0];
                                const side = firstLeg?.side ? String(firstLeg.side).toUpperCase() : 'BUY';
                                const lotSize = parseInt(post.trade_setup.lotSize || firstLeg?.lots || '1', 10) || 1;
                                if (typeof setSelectedSymbol === 'function') {
                                  setSelectedSymbol(cleanSym);
                                }
                                if (typeof openOrderModal === 'function') {
                                  openOrderModal(cleanSym, side, lotSize);
                                }
                                if (showToast) {
                                  showToast(`⚡ Order ticket opened for ${cleanSym}`, 'success');
                                }
                              }}
                              style={{
                                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: '800',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.4)'
                              }}
                              title="Trade or execute this setup directly in Paper Trading"
                            >
                              <Zap size={12} fill="#fff" />
                              <span>Trade Setup</span>
                            </button>
                          </div>
                        </div>

                        {/* Option / Equity Legs List */}
                        {Array.isArray(post.trade_setup.legs) && post.trade_setup.legs.length > 0 && (
                          <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {post.trade_setup.legs.map((leg, lIdx) => {
                              const isBuy = String(leg.side || 'BUY').toUpperCase() === 'BUY';
                              return (
                                <div
                                  key={lIdx}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontSize: '12.5px',
                                    padding: '4px 0',
                                    borderBottom: lIdx < post.trade_setup.legs.length - 1 ? '1px dashed rgba(255,255,255,0.06)' : 'none'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{
                                      background: isBuy ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                                      color: isBuy ? '#34d399' : '#f87171',
                                      border: `1px solid ${isBuy ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      fontSize: '10.5px',
                                      fontWeight: '800'
                                    }}>
                                      {leg.side}
                                    </span>
                                    <span style={{ color: '#cbd5e1', fontWeight: '600' }}>
                                      {leg.lots || '1 LOT'}
                                    </span>
                                    <span style={{ color: '#f8fafc', fontWeight: '800' }}>
                                      {leg.type} {leg.strike}
                                    </span>
                                  </div>
                                  <div style={{ color: '#94a3b8', fontWeight: '700' }}>
                                    @ ₹{leg.price}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* 4-Column Payoff / Margin Strip */}
                        <div
                          className="comm-trade-payoff-grid"
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            background: 'rgba(15, 23, 42, 0.9)',
                            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                            padding: '8px 14px',
                            gap: '8px',
                            fontSize: '11px'
                          }}
                        >
                          <div>
                            <div style={{ color: '#64748b', fontWeight: '700' }}>MAX PROFIT</div>
                            <div style={{ color: '#34d399', fontWeight: '800', marginTop: '2px' }}>
                              {post.trade_setup.maxProfit || '—'}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#64748b', fontWeight: '700' }}>MAX LOSS</div>
                            <div style={{ color: '#f87171', fontWeight: '800', marginTop: '2px' }}>
                              {post.trade_setup.maxLoss || '—'}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#64748b', fontWeight: '700' }}>LOT SIZE</div>
                            <div style={{ color: '#f8fafc', fontWeight: '800', marginTop: '2px' }}>
                              {post.trade_setup.lotSize || '—'}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#64748b', fontWeight: '700' }}>EST. MARGIN</div>
                            <div style={{ color: '#38bdf8', fontWeight: '800', marginTop: '2px' }}>
                              {post.trade_setup.margin || '—'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ─── Ultra-Compressed ~40KB WebP Chart Screenshot ─── */}
                    {post.image_url && (
                      <div
                        onClick={() => setLightboxImage(post.image_url)}
                        style={{
                          position: 'relative',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          background: '#090d16',
                          maxHeight: '420px',
                          cursor: 'zoom-in',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <img
                          src={post.image_url}
                          alt="Trader Chart Screenshot"
                          loading="lazy"
                          style={{
                            width: '100%',
                            maxHeight: '420px',
                            objectFit: 'contain',
                            display: 'block'
                          }}
                        />
                        <div style={{
                          position: 'absolute',
                          bottom: '8px',
                          right: '8px',
                          background: 'rgba(9, 13, 22, 0.85)',
                          backdropFilter: 'blur(6px)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          fontSize: '10px',
                          fontWeight: '700',
                          color: post.is_permanent ? '#34d399' : '#38bdf8',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}>
                          <span>⚡ {post.image_size_kb ? `${post.image_size_kb} KB WebP` : 'WebP'}</span>
                          {post.is_permanent && <span>• ♾️ Permanent Vault</span>}
                        </div>
                      </div>
                    )}

                    {/* ─── Post Action Footer: Vote | Comment | Bookmark | Share ─── */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '8px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => handleToggleVote(post.id)}
                          style={{
                            background: post.has_voted ? 'rgba(59, 130, 246, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                            color: post.has_voted ? '#60a5fa' : '#cbd5e1',
                            border: `1px solid ${post.has_voted ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                            borderRadius: '999px',
                            padding: '5px 12px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <span>▲</span>
                          <span>Vote</span>
                          {post.upvotes_count > 0 && <span>· {post.upvotes_count}</span>}
                        </button>

                        <button
                          onClick={() => handleToggleComments(post.id)}
                          style={{
                            background: openCommentsPostId === post.id ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                            color: openCommentsPostId === post.id ? '#38bdf8' : '#cbd5e1',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '999px',
                            padding: '5px 12px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <MessageSquare size={13} />
                          <span>{post.comments_count || 0}</span>
                        </button>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => toggleSavePost(post.id)}
                          title={savedPostIds.includes(post.id) ? 'Remove from Saved' : 'Save Setup to Bookmarks'}
                          style={{
                            background: savedPostIds.includes(post.id) ? 'rgba(245, 158, 11, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                            color: savedPostIds.includes(post.id) ? '#fbbf24' : '#94a3b8',
                            border: `1px solid ${savedPostIds.includes(post.id) ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                            borderRadius: '999px',
                            padding: '5px 10px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <Bookmark size={13} fill={savedPostIds.includes(post.id) ? '#fbbf24' : 'none'} />
                          <span style={{ fontSize: '11px' }}>{savedPostIds.includes(post.id) ? 'Saved' : 'Save'}</span>
                        </button>

                        <button
                          onClick={() => handleSharePost(post)}
                          style={{
                            background: 'rgba(16, 185, 129, 0.1)',
                            color: '#34d399',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            borderRadius: '999px',
                            padding: '5px 12px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Share2 size={13} />
                          <span>Share</span>
                        </button>
                      </div>
                    </div>

                    {/* ─── Expandable Comments Thread ─── */}
                    {openCommentsPostId === post.id && (
                      <div style={{
                        marginTop: '6px',
                        paddingTop: '10px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        {(commentsByPost[post.id] || []).length === 0 ? (
                          <div style={{ fontSize: '12px', color: '#64748b', padding: '4px 0' }}>
                            No comments yet. Start the discussion!
                          </div>
                        ) : (
                          (commentsByPost[post.id] || []).map(c => (
                            <div
                              key={c.id}
                              style={{
                                background: 'rgba(255, 255, 255, 0.025)',
                                borderRadius: '8px',
                                padding: '8px 10px',
                                fontSize: '12.5px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                                <span style={{ fontWeight: '700', color: '#f8fafc' }}>{c.username}</span>
                                {renderTierBadge(c.subscription_tier, c.is_admin)}
                                <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                                  • {formatRelativeTime(c.created_at)}
                                </span>
                              </div>
                              <div style={{ color: '#cbd5e1', lineHeight: '1.45' }}>{c.content}</div>
                            </div>
                          ))
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                          <input
                            type="text"
                            value={commentInput}
                            onChange={(e) => setCommentInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSendComment(post.id);
                            }}
                            placeholder="Write a comment or reply..."
                            style={{
                              flex: 1,
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 255, 255, 0.12)',
                              borderRadius: '8px',
                              padding: '7px 11px',
                              color: '#f8fafc',
                              fontSize: '12.5px',
                              outline: 'none'
                            }}
                          />
                          <button
                            onClick={() => handleSendComment(post.id)}
                            disabled={submittingComment}
                            style={{
                              background: '#2563eb',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '7px 12px',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Send size={13} />
                            <span>Reply</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Native In-Feed Ad every 5 posts */}
                  {(idx + 1) % 5 === 0 && (
                    <div style={{ borderRadius: '10px', overflow: 'hidden' }}>
                      <AdBannerWidget onUpgradeClick={onUpgradeClick} />
                    </div>
                  )}
                </React.Fragment>
              ))
            )}

            {/* Load More Button */}
            {hasMore && !loadingFeed && (
              <button
                onClick={() => fetchFeed(page + 1, activeSubTab, selectedClub, selectedTag, searchQuery)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#cbd5e1',
                  borderRadius: '10px',
                  padding: '10px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                Load More Posts
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── Floating FrontPage-Style Blue Compose Button ─── */}
      <button
        onClick={() => setShowComposeModal(true)}
        title="Create Community Post (50MB -> 40KB WebP)"
        style={{
          position: 'fixed',
          bottom: '28px',
          right: '28px',
          width: '54px',
          height: '54px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
          color: '#fff',
          border: 'none',
          boxShadow: '0 8px 24px rgba(37, 99, 235, 0.55)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 45
        }}
      >
        <Plus size={26} />
      </button>

      {/* ─── Fullscreen Image Lightbox ─── */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.92)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            cursor: 'zoom-out'
          }}
        >
          <img
            src={lightboxImage}
            alt="Full Chart"
            style={{ maxWidth: '96vw', maxHeight: '92vh', objectFit: 'contain', borderRadius: '8px' }}
          />
          <button
            onClick={() => setLightboxImage(null)}
            style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              background: 'rgba(255,255,255,0.12)',
              border: 'none',
              color: '#fff',
              borderRadius: '50%',
              width: '38px',
              height: '38px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════
          COMPOSE POST MODAL (With 50MB -> ~40KB WebP Adaptive Compressor)
         ═════════════════════════════════════════════════════════════════════════ */}
      {showComposeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 15, 0.82)',
            backdropFilter: 'blur(6px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            style={{
              background: '#131b2e',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '620px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.65)'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#f8fafc' }}>
                  Create Trader Community Post
                </div>
                <div style={{ fontSize: '11.5px', color: storagePolicy.is_permanent ? '#34d399' : '#38bdf8', fontWeight: '600', marginTop: '2px' }}>
                  {storagePolicy.label}
                </div>
              </div>
              <button
                onClick={() => setShowComposeModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Select Club */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: '700', color: '#94a3b8' }}>
                SELECT CLUB
              </label>
              <select
                value={composeClubId}
                onChange={(e) => setComposeClubId(e.target.value)}
                style={{
                  background: '#0f172a',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: '#f8fafc',
                  fontSize: '13px',
                  outline: 'none'
                }}
              >
                {clubs.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name} ({c.category})
                  </option>
                ))}
              </select>
            </div>

            {/* Post Textarea (Supports Ctrl+V Screenshot Paste!) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <textarea
                rows={4}
                value={composeText}
                onChange={(e) => setComposeText(e.target.value)}
                onPaste={(e) => {
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  for (const item of items) {
                    if (item.type.startsWith('image/')) {
                      const file = item.getAsFile();
                      if (file) handleProcessImageFile(file);
                      break;
                    }
                  }
                }}
                placeholder="Share your market view, levels, or option strategy... Use #NIFTY50, #BANKNIFTY, #RELIANCE (or press Ctrl+V to paste any chart screenshot!)"
                style={{
                  width: '100%',
                  background: '#0f172a',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  padding: '12px',
                  color: '#f8fafc',
                  fontSize: '13.5px',
                  lineHeight: '1.5',
                  resize: 'vertical',
                  outline: 'none'
                }}
              />

              {/* Quick #SYMBOL Tag Insertion Chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>Quick Tags:</span>
                {['#NIFTY50', '#BANKNIFTY', '#FINNIFTY', '#RELIANCE', '#ICICIBANK', '#SENSEX', '#CRUDEOIL'].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setComposeText(prev => `${prev}${prev.endsWith(' ') || !prev ? '' : ' '}${tag} `)}
                    style={{
                      background: 'rgba(56, 189, 248, 0.1)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      color: '#38bdf8',
                      borderRadius: '6px',
                      padding: '2px 8px',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* ─── 50MB -> ~40KB WebP Photo Uploader Box ─── */}
            <div style={{
              background: '#0f172a',
              border: '1px dashed rgba(56, 189, 248, 0.35)',
              borderRadius: '10px',
              padding: '12px'
            }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleProcessImageFile(file);
                  e.target.value = '';
                }}
              />

              {compressingImage ? (
                <div style={{ textAlign: 'center', padding: '12px', color: '#38bdf8', fontSize: '12.5px', fontWeight: '700' }}>
                  ⚡ Compressing photo to ~40 KB WebP in browser...
                </div>
              ) : uploadedImageInfo ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#34d399' }}>
                      ⚡ Compressed {uploadedImageInfo.original_size_kb >= 1024 ? `${(uploadedImageInfo.original_size_kb / 1024).toFixed(2)} MB` : `${uploadedImageInfo.original_size_kb} KB`} → {uploadedImageInfo.size_kb} KB WebP ({uploadedImageInfo.savings_pct}% smaller)
                    </span>
                    <button
                      onClick={() => setUploadedImageInfo(null)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#f87171',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      Remove Photo
                    </button>
                  </div>
                  <img
                    src={uploadedImageInfo.preview_url || uploadedImageInfo.image_url}
                    alt="Compressed Preview"
                    style={{ maxHeight: '220px', width: '100%', objectFit: 'contain', borderRadius: '8px', background: '#090d16' }}
                  />
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ImageIcon size={20} color="#38bdf8" />
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#f8fafc' }}>
                        Upload Chart Screenshot or Photo (Up to 50 MB)
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                        Auto-compresses 50 MB photos to ~40 KB crisp WebP before upload
                      </div>
                    </div>
                  </div>
                  <span style={{
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: '#38bdf8',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: '700'
                  }}>
                    Browse File
                  </span>
                </div>
              )}
            </div>

            {/* ─── Zero-Storage JSON Trade Setup Attachment ─── */}
            <div style={{
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px', fontWeight: '700', color: '#f8fafc' }}>
                  <input
                    type="checkbox"
                    checked={attachTradeSetup}
                    onChange={(e) => setAttachTradeSetup(e.target.checked)}
                  />
                  <span>📊 Attach Structured Trade Setup Card (0 KB JSON)</span>
                </label>

                {activePositions.length > 0 && (
                  <select
                    onChange={(e) => {
                      const idx = e.target.value;
                      if (idx !== '') handleImportPosition(activePositions[Number(idx)]);
                    }}
                    defaultValue=""
                    style={{
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      color: '#34d399',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: '700',
                      outline: 'none'
                    }}
                  >
                    <option value="" disabled>⚡ 1-Click Import Open Position ({activePositions.length})</option>
                    {activePositions.map((p, i) => (
                      <option key={i} value={i} style={{ background: '#0f172a', color: '#fff' }}>
                        {p.symbol} ({p.quantity > 0 ? 'LONG' : 'SHORT'} {Math.abs(p.quantity)} @ ₹{p.average_price})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {attachTradeSetup && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <input
                      type="text"
                      value={tradeSetupForm.symbol}
                      onChange={(e) => setTradeSetupForm(prev => ({ ...prev, symbol: e.target.value }))}
                      placeholder="Symbol (e.g. NSE:NIFTY50-INDEX)"
                      style={{ background: '#131b2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '12px' }}
                    />
                    <input
                      type="text"
                      value={tradeSetupForm.strategy}
                      onChange={(e) => setTradeSetupForm(prev => ({ ...prev, strategy: e.target.value }))}
                      placeholder="Strategy (e.g. BULL PUT SPREAD)"
                      style={{ background: '#131b2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '12px' }}
                    />
                  </div>

                  {/* Legs */}
                  {tradeSetupForm.legs.map((leg, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        padding: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: '85px 85px 1fr 30px', gap: '6px', alignItems: 'center' }}>
                        <select
                          value={leg.side}
                          onChange={(e) => {
                            const next = [...tradeSetupForm.legs];
                            next[idx] = { ...next[idx], side: e.target.value };
                            setTradeSetupForm(prev => ({ ...prev, legs: next }));
                          }}
                          style={{ background: '#131b2e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '6px', color: '#fff', fontSize: '11.5px', fontWeight: '700' }}
                        >
                          <option value="BUY">BUY</option>
                          <option value="SELL">SELL</option>
                        </select>
                        <select
                          value={leg.type}
                          onChange={(e) => {
                            const next = [...tradeSetupForm.legs];
                            next[idx] = { ...next[idx], type: e.target.value };
                            setTradeSetupForm(prev => ({ ...prev, legs: next }));
                          }}
                          style={{ background: '#131b2e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '6px', color: '#fff', fontSize: '11.5px', fontWeight: '700' }}
                        >
                          <option value="CE">CE</option>
                          <option value="PE">PE</option>
                          <option value="FUT">FUT</option>
                          <option value="EQ">EQ</option>
                        </select>
                        <input
                          type="text"
                          value={leg.strike}
                          onChange={(e) => {
                            const next = [...tradeSetupForm.legs];
                            next[idx] = { ...next[idx], strike: e.target.value };
                            setTradeSetupForm(prev => ({ ...prev, legs: next }));
                          }}
                          placeholder="Strike (e.g. 25000)"
                          style={{ background: '#131b2e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '11.5px' }}
                        />
                        {tradeSetupForm.legs.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => setTradeSetupForm(prev => ({ ...prev, legs: prev.legs.filter((_, i) => i !== idx) }))}
                            style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', color: '#f87171', padding: '4px', cursor: 'pointer' }}
                            title="Remove leg"
                          >
                            ✕
                          </button>
                        ) : <div />}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <input
                          type="text"
                          value={leg.lots}
                          onChange={(e) => {
                            const next = [...tradeSetupForm.legs];
                            next[idx] = { ...next[idx], lots: e.target.value };
                            setTradeSetupForm(prev => ({ ...prev, legs: next }));
                          }}
                          placeholder="Lots (e.g. 1 LOT)"
                          style={{ background: '#131b2e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '11.5px' }}
                        />
                        <input
                          type="text"
                          value={leg.price}
                          onChange={(e) => {
                            const next = [...tradeSetupForm.legs];
                            next[idx] = { ...next[idx], price: e.target.value };
                            setTradeSetupForm(prev => ({ ...prev, legs: next }));
                          }}
                          placeholder="Price @ ₹"
                          style={{ background: '#131b2e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '11.5px' }}
                        />
                      </div>
                    </div>
                  ))}

                  {tradeSetupForm.legs.length < 4 && (
                    <button
                      type="button"
                      onClick={() =>
                        setTradeSetupForm(prev => ({
                          ...prev,
                          legs: [...prev.legs, { side: 'SELL', lots: '1 LOT', type: 'CE', strike: '25200', price: '85.0' }]
                        }))
                      }
                      style={{
                        alignSelf: 'flex-start',
                        background: 'rgba(56, 189, 248, 0.12)',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        color: '#38bdf8',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      + Add Option Leg
                    </button>
                  )}

                  <div className="comm-trade-payoff-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '4px' }}>
                    <input
                      type="text"
                      value={tradeSetupForm.maxProfit}
                      onChange={(e) => setTradeSetupForm(prev => ({ ...prev, maxProfit: e.target.value }))}
                      placeholder="Max Profit"
                      style={{ background: '#131b2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px 8px', color: '#34d399', fontSize: '11.5px', fontWeight: '700' }}
                    />
                    <input
                      type="text"
                      value={tradeSetupForm.maxLoss}
                      onChange={(e) => setTradeSetupForm(prev => ({ ...prev, maxLoss: e.target.value }))}
                      placeholder="Max Loss"
                      style={{ background: '#131b2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px 8px', color: '#f87171', fontSize: '11.5px', fontWeight: '700' }}
                    />
                    <input
                      type="text"
                      value={tradeSetupForm.lotSize}
                      onChange={(e) => setTradeSetupForm(prev => ({ ...prev, lotSize: e.target.value }))}
                      placeholder="Lot Size"
                      style={{ background: '#131b2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px 8px', color: '#fff', fontSize: '11.5px' }}
                    />
                    <input
                      type="text"
                      value={tradeSetupForm.margin}
                      onChange={(e) => setTradeSetupForm(prev => ({ ...prev, margin: e.target.value }))}
                      placeholder="Est. Margin"
                      style={{ background: '#131b2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px 8px', color: '#38bdf8', fontSize: '11.5px' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Submit Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button
                onClick={() => setShowComposeModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: '#cbd5e1',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handlePublishPost}
                disabled={publishingPost || compressingImage}
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 20px',
                  fontSize: '12.5px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  opacity: publishingPost || compressingImage ? 0.6 : 1
                }}
              >
                {publishingPost ? 'Publishing...' : 'Publish to Community 🚀'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
