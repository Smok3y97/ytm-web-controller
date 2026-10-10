/**
 * YouTube Music Web Controller - Centralized DOM Selectors
 * 
 * Single Source of Truth for all YouTube Music DOM element selectors.
 * If YouTube alters class names, IDs, or element hierarchies, updates are made exclusively here.
 */

'use strict';

window.YTM = window.YTM || {};

window.YTM.selectors = {
  // Player Container & Core Media Elements
  player: {
    moviePlayer: '#movie_player, #player, .html5-video-player',
    playerBar: 'ytmusic-player-bar',
    ytPlayer: 'ytmusic-player',
    video: '.html5-main-video, #movie_player video, ytmusic-player video, ytmusic-player-bar video, video',
    volumeSlider: 'ytmusic-player-bar #volume-slider, tp-yt-paper-slider#volume-slider, #volume-slider, .volume-slider',
    volumeMuteButton: 'ytmusic-player-bar #volume-slider-volume-button, ytmusic-player-bar .volume, ytmusic-player-bar tp-yt-paper-icon-button.volume, #volume-slider-volume-button',
    timeInfo: 'ytmusic-player-bar .time-info, .time-info'
  },

  // Interactive Control Buttons
  controls: {
    likeRenderer: 'ytmusic-like-button-renderer, #like-button-renderer, .middle-controls ytmusic-like-button-renderer',
    likeButton: '#button-shape-like button, #button-shape-like, tp-yt-paper-icon-button#like-button, tp-yt-paper-icon-button.like, #like-button, [aria-label*="mag ich" i]:not([aria-label*="nicht" i]), [aria-label*="like" i]:not([aria-label*="dislike" i])',
    dislikeButton: '#button-shape-dislike button, #button-shape-dislike, tp-yt-paper-icon-button#dislike-button, tp-yt-paper-icon-button.dislike, #dislike-button, [aria-label*="mag ich nicht" i], [aria-label*="dislike" i]',
    shuffleButton: 'ytmusic-player-bar tp-yt-paper-icon-button.shuffle, ytmusic-player-bar .shuffle, ytmusic-player-bar #shuffle-button, ytmusic-player-bar [aria-label*="zufall" i], ytmusic-player-bar [aria-label*="shuffle" i]',
    repeatButton: 'ytmusic-player-bar tp-yt-paper-icon-button.repeat, ytmusic-player-bar .repeat, ytmusic-player-bar #repeat-button, ytmusic-player-bar [aria-label*="wiederhol" i], ytmusic-player-bar [aria-label*="repeat" i]',
    repeatOne: '#repeat-one, #repeat_one, [icon*="repeat_one" i], [icon*="repeat-one" i], [icon*="repeat1" i]',
    ironIcon: 'tp-yt-iron-icon, iron-icon, yt-icon, #icon, [icon]'
  },

  // Metadata Fallback Elements (used only when MediaSession metadata is missing)
  metadata: {
    title: 'ytmusic-player-bar .title, ytmusic-player-bar yt-formatted-string.title, .title.ytmusic-player-bar, .middle-controls .title',
    titleLink: 'ytmusic-player-bar .title a, ytmusic-player-bar yt-formatted-string.title a, ytmusic-player-bar a.yt-simple-endpoint[href*="watch"]',
    byline: 'ytmusic-player-bar .byline, ytmusic-player-bar .subtitle, ytmusic-player-bar yt-formatted-string.byline, ytmusic-player-bar yt-formatted-string.subtitle, .middle-controls .byline, .middle-controls .subtitle, ytmusic-player-bar .content-info-wrapper .subtitle',
    artwork: 'ytmusic-player-bar .image, ytmusic-player-bar img#img, .thumbnail img',
    artworkImgs: 'ytmusic-player-bar img',
    watchLinks: 'ytmusic-player-bar a[href*="watch"], ytmusic-player-page a[href*="watch"], .middle-controls a[href*="watch"]'
  }
};
