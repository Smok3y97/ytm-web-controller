/**
 * YouTube Music Web Controller - Interactive Controls Extractor
 * 
 * Extracts interactive control button states (Like, Dislike, Shuffle, Repeat)
 * using a resilient hierarchy: Polymer internal properties -> DOM button states ->
 * aria labels and multilingual keyword matching.
 */

'use strict';

window.YTM = window.YTM || {};

/**
 * Extract interactive control button states (Like, Dislike, Shuffle, Repeat)
 * Scoped strictly to the active player bar.
 */
function extractControlStates(playerBar) {
  const $ = window.YTM.utils?.$ || ((sel, parent = document) => {
    try { return parent.querySelector(sel); } catch { return null; }
  });
  const isButtonActive = window.YTM.utils?.isButtonActive || (() => false);

  // 1. Like & Dislike Status (Strictly scoped to bottom player bar)
  let isLiked = false;
  let isDisliked = false;

  const playerBarElem = playerBar || $(window.YTM.selectors?.player?.playerBar || 'ytmusic-player-bar');
  const likeRenderer = playerBarElem
    ? $(window.YTM.selectors?.controls?.likeRenderer || 'ytmusic-like-button-renderer, #like-button-renderer, .like-button-renderer', playerBarElem)
    : null;
  const likeStatusAttr = likeRenderer?.getAttribute('like-status')?.toUpperCase();

  if (likeStatusAttr === 'LIKE') {
    isLiked = true;
    isDisliked = false;
  } else if (likeStatusAttr === 'DISLIKE') {
    isLiked = false;
    isDisliked = true;
  } else if (likeStatusAttr === 'INDIFFERENT') {
    isLiked = false;
    isDisliked = false;
  } else if (playerBarElem && typeof playerBarElem.likeStatus_ === 'string' && playerBarElem.likeStatus_) {
    const ls = playerBarElem.likeStatus_.toUpperCase();
    isLiked = ls === 'LIKE';
    isDisliked = ls === 'DISLIKE';
  } else if (playerBarElem) {
    const likeButton = $(window.YTM.selectors?.controls?.likeButton, playerBarElem);
    const dislikeButton = $(window.YTM.selectors?.controls?.dislikeButton, playerBarElem);

    isLiked = isButtonActive(likeButton);
    isDisliked = isButtonActive(dislikeButton);
  }

  // 2. Shuffle Status
  let shuffleActive = false;
  const rawShuffle = playerBar?.shuffleOn_ ?? 
    playerBar?.shuffleActive_ ?? 
    playerBar?.__data?.shuffleOn ?? 
    playerBar?.__data?.shuffleActive;

  if (typeof rawShuffle === 'boolean') {
    shuffleActive = rawShuffle;
  } else {
    const shuffleButton = $(window.YTM.selectors?.controls?.shuffleButton, playerBar) ||
      $(window.YTM.selectors?.controls?.shuffleButton);

    if (shuffleButton) {
      shuffleActive = isButtonActive(shuffleButton, ['deaktivieren', 'ausschalten', 'turn off', 'is on']);
    }
  }

  // 3. Repeat Status
  let repeatMode = 'OFF';
  const rawRepeat = playerBar?.repeatMode_ ?? 
    playerBar?.__data?.repeatMode ?? 
    playerBar?.__data?.repeatMode_ ?? 
    playerBar?.repeatMode;

  if (typeof rawRepeat === 'number') {
    if (rawRepeat === 2) repeatMode = 'ONE';
    else if (rawRepeat === 1) repeatMode = 'ALL';
    else repeatMode = 'OFF';
  } else if (typeof rawRepeat === 'string') {
    const rm = rawRepeat.toUpperCase().trim();
    if (rm === 'NONE' || rm === 'OFF' || rm === '0' || rm === 'REPEAT_OFF' || rm === 'REPEAT_NONE') {
      repeatMode = 'OFF';
    } else if (rm === 'ONE' || rm === '2' || rm === 'FEATURED' || rm === 'REPEAT_ONE' || rm === 'REPEAT_SINGLE' || rm === 'TRACK') {
      repeatMode = 'ONE';
    } else if (rm === 'ALL' || rm === '1' || rm === 'REPEAT_ALL') {
      repeatMode = 'ALL';
    } else {
      repeatMode = 'OFF';
    }
  } else if (typeof rawRepeat === 'boolean') {
    repeatMode = rawRepeat ? 'ALL' : 'OFF';
  } else {
    const repeatBtnSel = window.YTM.selectors?.controls?.repeatButton || 'ytmusic-player-bar tp-yt-paper-icon-button.repeat, ytmusic-player-bar .repeat, ytmusic-player-bar #repeat-button';
    const repeatButton = $(repeatBtnSel, playerBar) ||
      $(repeatBtnSel);

    if (repeatButton) {
      const ironIconSel = window.YTM.selectors?.controls?.ironIcon || 'tp-yt-iron-icon, iron-icon, yt-icon, #icon, [icon]';
      const ironIcon = repeatButton.querySelector(ironIconSel);
      const iconAttr = (
        ironIcon?.getAttribute('icon') ||
        repeatButton.getAttribute('icon') ||
        ironIcon?.getAttribute('src') ||
        ''
      ).toLowerCase();
      const iconId = (ironIcon?.id || '').toLowerCase();
      const repeatOneSel = window.YTM.selectors?.controls?.repeatOne || '#repeat-one, #repeat_one, [icon*="repeat_one" i], [icon*="repeat-one" i], [icon*="repeat1" i]';
      const hasRepeatOneElem = Boolean(repeatButton.querySelector(repeatOneSel));

      const innerBtn = repeatButton.querySelector('button');
      const label = (
        repeatButton.getAttribute('aria-label') ||
        innerBtn?.getAttribute('aria-label') ||
        repeatButton.getAttribute('title') ||
        innerBtn?.getAttribute('title') ||
        ''
      ).toLowerCase();

      const isCurrentlyActive = isButtonActive(repeatButton, ['deaktivieren', 'ausschalten', 'turn off', 'desactivar', 'désactiver', 'is on']);

      const isOne = (
        iconAttr.includes('repeat_one') ||
        iconAttr.includes('repeat-one') ||
        iconAttr.includes('repeat1') ||
        iconId.includes('repeat-one') ||
        iconId.includes('repeat_one') ||
        hasRepeatOneElem ||
        label.includes('1 titel') ||
        label.includes('diesen titel') ||
        label.includes('aktuellen titel') ||
        label.includes('einzelnen titel') ||
        label.includes('wiederholen (1)') ||
        label.includes('wiederholung: 1') ||
        label.includes('repeat one') ||
        label.includes('repeat 1') ||
        label.includes('repeat: 1') ||
        label.includes('repeat: one') ||
        label.includes('repeat single') ||
        label.includes('repetir una') ||
        label.includes('repetir 1') ||
        label.includes('répéter le titre actuel') ||
        label.includes('répéter 1 titre') ||
        label.includes('répéter ce titre')
      ) && !label.includes('alle') && !label.includes('all') && !label.includes('tout') && !label.includes('todo') && !label.includes('aus') && !label.includes('off');

      if (isCurrentlyActive) {
        repeatMode = isOne ? 'ONE' : 'ALL';
      } else if (isOne && (iconAttr.includes('repeat_one') || iconAttr.includes('repeat-one') || label.includes('aktuellen') || label.includes('diesen') || label.includes('1 titel') || label.includes('repeat one'))) {
        repeatMode = 'ONE';
      } else {
        repeatMode = 'OFF';
      }
    }
  }

  return {
    isLiked,
    isDisliked,
    shuffleActive,
    repeatMode
  };
}

// Export interactive control extractor to YTM namespace
window.YTM.controls = {
  extractControlStates
};
