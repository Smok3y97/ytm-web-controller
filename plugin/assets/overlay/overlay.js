/**
 * YouTube Music OBS Browser Overlay Client Script
 * 
 * Subscribes to local WebSocket for real-time playback state updates.
 * Supports configurable templates, themes, custom colors (HEX/RGBA/transparent),
 * ping-pong marquee scrolling for long titles, progress bars, and time modes.
 */

(() => {
  'use strict';

  // 1. Parse URL Configuration Parameters
  const params = new URLSearchParams(window.location.search);
  const config = {
    template: params.get('template') || '{artist} - {title}',
    theme: (params.get('theme') || 'card').toLowerCase(),
    showCover: params.get('showCover') !== 'false' && params.get('showCover') !== '0',
    showProgress: params.get('showProgress') !== 'false' && params.get('showProgress') !== '0',
    timeMode: (params.get('timeMode') || 'remaining').toLowerCase(),
    hideOnPause: params.get('hideOnPause') === 'true' || params.get('hideOnPause') === '1',
    port: parseInt(params.get('port') || window.location.port || '39865', 10),
    marquee: params.get('marquee') !== 'false' && params.get('scroll') !== 'false' && params.get('marquee') !== '0',

    // Visual Customization Parameters
    accent: params.get('accent') || params.get('accentColor') || '',
    bg: params.get('bg') || params.get('bgColor') || params.get('background') || '',
    bgOpacity: params.get('bgOpacity') || params.get('opacity') || '',
    textColor: params.get('text') || params.get('textColor') || params.get('color') || '',
    subColor: params.get('subColor') || params.get('subTextColor') || '',
    radius: params.get('radius') || params.get('borderRadius') || '',
    width: params.get('width') || '',
    border: params.get('border') || params.get('borderColor') || '',
    shadow: params.get('shadow') || params.get('boxShadow') || '',
    blur: params.get('blur') || params.get('backdropBlur') || ''
  };

  // 2. DOM Elements
  const root = document.documentElement;
  const widget = document.getElementById('overlay-widget');
  const coverContainer = document.getElementById('cover-container');
  const coverArt = document.getElementById('cover-art');
  const coverFallback = document.getElementById('cover-fallback');
  const titleTrack = document.getElementById('title-track');
  const trackTitle = document.getElementById('track-title');
  const artistTrack = document.getElementById('artist-track');
  const trackArtist = document.getElementById('track-artist');
  const albumTrack = document.getElementById('album-track');
  const trackAlbum = document.getElementById('track-album');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  const timeDisplay = document.getElementById('time-display');

  // Track cache for marquee recalculation
  let lastTitleText = '';
  let lastArtistText = '';
  let lastAlbumText = '';

  // Image load / error handlers
  if (coverArt) {
    coverArt.addEventListener('load', () => {
      coverArt.style.display = 'block';
      if (coverFallback) coverFallback.style.display = 'none';
    });
    coverArt.addEventListener('error', () => {
      coverArt.style.display = 'none';
      if (coverFallback) coverFallback.style.display = 'flex';
    });
  }

  // 3. Color & Styling Utilities
  function normalizeHex(colorStr) {
    if (!colorStr) return '';
    let val = colorStr.trim();
    if (val.toLowerCase() === 'transparent' || val.toLowerCase() === 'none') {
      return 'transparent';
    }
    // Prepend '#' for 3, 4, 6, 8 digit hex values without leading hash
    if (/^[0-9a-fA-F]{3,8}$/.test(val)) {
      return `#${val}`;
    }
    return val;
  }

  function hexToRgba(hex, alpha = 1) {
    if (!hex || hex === 'transparent') return 'transparent';
    let c = hex.replace(/^#/, '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    if (c.length === 6) {
      const r = parseInt(c.substring(0, 2), 16);
      const g = parseInt(c.substring(2, 4), 16);
      const b = parseInt(c.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return hex;
  }

  // 4. Initialize Visual Customization & Layout
  function applyCustomization() {
    // 4.1 Theme Class
    widget.className = `overlay-container theme-${config.theme} is-hidden`;

    if (!config.showCover) {
      coverContainer.style.display = 'none';
    }

    if (!config.showProgress) {
      progressContainer.style.display = 'none';
    } else if (config.timeMode === 'none') {
      timeDisplay.style.display = 'none';
    }

    // 4.2 Accent Color (HEX / CSS color)
    if (config.accent) {
      const accent = normalizeHex(config.accent);
      root.style.setProperty('--accent-color', accent);
      root.style.setProperty('--accent-glow', hexToRgba(accent, 0.4));
    }

    // 4.3 Background Color & Opacity
    if (config.bg) {
      const bg = normalizeHex(config.bg);
      if (bg === 'transparent' || bg === 'none') {
        root.style.setProperty('--bg-card', 'transparent');
        root.style.setProperty('--backdrop-blur', 'none');
        root.style.setProperty('--box-shadow', 'none');
        root.style.setProperty('--border-style', 'none');
      } else {
        let alpha = 0.88;
        if (config.bgOpacity !== '') {
          let parsedAlpha = parseFloat(config.bgOpacity);
          if (parsedAlpha > 1) parsedAlpha = parsedAlpha / 100;
          if (!isNaN(parsedAlpha)) alpha = Math.min(1, Math.max(0, parsedAlpha));
        }
        root.style.setProperty('--bg-card', hexToRgba(bg, alpha));
      }
    } else if (config.bgOpacity !== '') {
      let parsedAlpha = parseFloat(config.bgOpacity);
      if (parsedAlpha > 1) parsedAlpha = parsedAlpha / 100;
      if (!isNaN(parsedAlpha)) {
        const alpha = Math.min(1, Math.max(0, parsedAlpha));
        root.style.setProperty('--bg-card', `rgba(18, 18, 20, ${alpha})`);
        if (alpha === 0) {
          root.style.setProperty('--backdrop-blur', 'none');
          root.style.setProperty('--box-shadow', 'none');
          root.style.setProperty('--border-style', 'none');
        }
      }
    }

    // 4.4 Text & Subtext Colors
    if (config.textColor) {
      root.style.setProperty('--text-main', normalizeHex(config.textColor));
    }
    if (config.subColor) {
      const sub = normalizeHex(config.subColor);
      root.style.setProperty('--text-sub', sub);
      root.style.setProperty('--text-muted', sub);
    }

    // 4.5 Border Radius
    if (config.radius !== '') {
      const r = isNaN(Number(config.radius)) ? config.radius : `${config.radius}px`;
      root.style.setProperty('--card-radius', r);
      root.style.setProperty('--compact-radius', r);
      root.style.setProperty('--pill-radius', r);
    }

    // 4.6 Custom Width
    if (config.width) {
      const w = isNaN(Number(config.width)) ? config.width : `${config.width}px`;
      root.style.setProperty('--card-width', w);
      root.style.setProperty('--compact-width', w);
      root.style.setProperty('--pill-width', w);
    }

    // 4.6 Border
    if (config.border) {
      const b = config.border.toLowerCase();
      if (b === 'none' || b === 'false' || b === '0') {
        root.style.setProperty('--border-style', 'none');
      } else {
        root.style.setProperty('--border-color', normalizeHex(config.border));
        root.style.setProperty('--border-style', `1px solid ${normalizeHex(config.border)}`);
      }
    }

    // 4.7 Shadow
    if (config.shadow) {
      const s = config.shadow.toLowerCase();
      if (s === 'none' || s === 'false' || s === '0') {
        root.style.setProperty('--box-shadow', 'none');
      }
    }

    // 4.8 Backdrop Blur
    if (config.blur) {
      const bl = config.blur.toLowerCase();
      if (bl === 'none' || bl === 'false' || bl === '0') {
        root.style.setProperty('--backdrop-blur', 'none');
      } else {
        const val = isNaN(Number(config.blur)) ? config.blur : `${config.blur}px`;
        root.style.setProperty('--backdrop-blur', `blur(${val})`);
      }
    }
  }

  // 5. Formatting Utilities
  function formatTime(totalSeconds) {
    if (isNaN(totalSeconds) || totalSeconds < 0 || !isFinite(totalSeconds)) totalSeconds = 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const pad = (n) => n.toString().padStart(2, '0');

    if (hours > 0) {
      return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${minutes}:${pad(seconds)}`;
  }

  function formatTitle(template, state) {
    if (!state.title && !state.artist) return 'No Media';
    const titleStr = (state.title || 'Unknown Title').trim();
    const artistStr = (state.artist || 'Unknown Artist').trim();
    const albumStr = (state.album || '').trim();
    const durationStr = formatTime(state.duration);
    const currentStr = formatTime(state.currentTime);

    let output = (template || '{artist} - {title}')
      .replace(/{(title|titel|song|track)}/gi, titleStr)
      .replace(/{(artist|kuenstler|künstler|interpret|author|channel)}/gi, artistStr)
      .replace(/{(album)}/gi, albumStr)
      .replace(/{(duration|length)}/gi, durationStr)
      .replace(/{(currentTime|current)}/gi, currentStr);

    output = output.replace(/\(\s*\)/g, '').replace(/\[\s*\]/g, '');
    output = output.replace(/\s+/g, ' ').trim();
    output = output.replace(/^[\s\-\–\—\•\|\:]+/, '').replace(/[\s\-\–\—\•\|\:]+$/, '').trim();

    return output || 'No Media';
  }

  function formatTimeReadout(mode, current, duration) {
    const curStr = formatTime(current);
    const durStr = formatTime(duration);

    switch (mode) {
      case 'none':
        return '';
      case 'current':
        return curStr;
      case 'duration':
        return durStr;
      case 'both':
        return `${curStr} / ${durStr}`;
      case 'remaining':
      default:
        if (duration > 0) {
          const rem = Math.max(0, duration - current);
          return `-${formatTime(rem)}`;
        }
        return curStr;
    }
  }

  // 6. Ping-Pong Marquee Auto-Scroll
  function updateMarquee(elem, track) {
    if (!config.marquee || !elem || !track) {
      elem.classList.remove('is-scrolling');
      track.classList.remove('has-overflow');
      elem.style.removeProperty('--scroll-dist');
      elem.style.removeProperty('--scroll-dur');
      return;
    }

    // Reset state before measuring
    elem.classList.remove('is-scrolling');
    track.classList.remove('has-overflow');
    elem.style.removeProperty('--scroll-dist');
    elem.style.removeProperty('--scroll-dur');

    // Measure after DOM paint
    requestAnimationFrame(() => {
      const scrollWidth = elem.scrollWidth;
      const clientWidth = track.clientWidth;
      const overflow = scrollWidth - clientWidth;

      if (overflow > 2) {
        const extraPad = 10;
        const scrollDistance = overflow + extraPad;
        // Comfortable reading speed: ~22px per second + 2.5s pause allowances
        const duration = Math.max(5, (scrollDistance / 22) + 2.5);

        elem.style.setProperty('--scroll-dist', `${scrollDistance}px`);
        elem.style.setProperty('--scroll-dur', `${duration.toFixed(2)}s`);
        elem.classList.add('is-scrolling');
        track.classList.add('has-overflow');
      }
    });
  }

  // 7. State Renderer
  function updateOverlay(state) {
    if (!state || (!state.title && !state.artist)) {
      widget.classList.add('is-hidden');
      return;
    }

    if (state.paused && config.hideOnPause) {
      widget.classList.add('is-hidden');
      return;
    }

    // Unhide widget
    widget.classList.remove('is-hidden');
    if (state.paused) {
      widget.classList.add('is-paused');
    } else {
      widget.classList.remove('is-paused');
    }

    // Title / Artist / Album
    let newTitleText = '';
    let newArtistText = '';
    let newAlbumText = '';

    if (config.template && config.template !== '{artist} - {title}') {
      newTitleText = formatTitle(config.template, state);
      newArtistText = state.artist || '';
    } else {
      newTitleText = state.title || 'Unknown Title';
      newArtistText = state.artist || 'YouTube Music';
    }
    newAlbumText = (state.album && state.album.trim()) ? state.album.trim() : '';

    // Update Title if changed
    if (newTitleText !== lastTitleText) {
      lastTitleText = newTitleText;
      trackTitle.textContent = newTitleText;
      updateMarquee(trackTitle, titleTrack);
    }

    // Update Artist if changed
    if (newArtistText !== lastArtistText) {
      lastArtistText = newArtistText;
      trackArtist.textContent = newArtistText;
      updateMarquee(trackArtist, artistTrack);
    }

    // Update Album if changed
    if (newAlbumText !== lastAlbumText) {
      lastAlbumText = newAlbumText;
      trackAlbum.textContent = newAlbumText;
      if (newAlbumText) {
        albumTrack.style.display = '';
        updateMarquee(trackAlbum, albumTrack);
      } else {
        albumTrack.style.display = 'none';
      }
    }

    // Cover Image
    if (config.showCover) {
      const coverSource = state.coverBase64 || state.coverUrl || '';
      if (coverSource) {
        if (coverArt.src !== coverSource) {
          coverArt.src = coverSource;
        }
        coverArt.style.display = 'block';
        if (coverFallback) coverFallback.style.display = 'none';
      } else {
        coverArt.removeAttribute('src');
        coverArt.style.display = 'none';
        if (coverFallback) coverFallback.style.display = 'flex';
      }
    }

    // Progress & Time
    if (config.showProgress) {
      const duration = typeof state.duration === 'number' ? state.duration : 0;
      const current = typeof state.currentTime === 'number' ? state.currentTime : 0;
      const percent = duration > 0 ? Math.min(100, Math.max(0, (current / duration) * 100)) : 0;

      progressBar.style.width = `${percent}%`;

      if (config.timeMode !== 'none') {
        timeDisplay.textContent = formatTimeReadout(config.timeMode, current, duration);
      }
    }
  }

  // 8. Resilient WebSocket Client Connection
  let ws = null;
  let reconnectTimer = null;

  function connect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    const host = window.location.hostname || '127.0.0.1';
    const wsUrl = `ws://${host}:${config.port}`;

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log(`[Overlay] Connected to Stream Deck server at ${wsUrl}`);
        // Register client & request immediate state
        ws.send(JSON.stringify({ type: 'REGISTER_CLIENT', client: 'obs-overlay' }));
        ws.send(JSON.stringify({ command: 'requestState' }));
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'STATE_UPDATE' && payload.data) {
            updateOverlay(payload.data);
          }
        } catch (e) {
          console.warn('[Overlay] Message parse error:', e);
        }
      };

      ws.onclose = () => {
        console.log('[Overlay] Disconnected from server. Reconnecting in 2.5s...');
        scheduleReconnect();
      };

      ws.onerror = (err) => {
        console.warn('[Overlay] Socket error:', err);
        ws.close();
      };
    } catch (e) {
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(connect, 2500);
    }
  }

  // 9. Start
  applyCustomization();
  connect();
})();
