/**
 * Image Renderer Service
 * 
 * 100% In-Memory Graphics Generator (Zero Disk Footprint).
 * Generates SVG/Base64 Data-URLs for Stream Deck keys and Stream Deck + LCD Touchstrips.
 */

import streamDeck from '@elgato/streamdeck';
import { YTMPlaybackState } from '../types/index.js';

export class ImageRenderer {
  private static instance: ImageRenderer;
  private coverCache: Map<string, string> = new Map();
  private maxCacheSize = 20;

  private constructor() {}

  public static getInstance(): ImageRenderer {
    if (!ImageRenderer.instance) {
      ImageRenderer.instance = new ImageRenderer();
    }
    return ImageRenderer.instance;
  }

  /**
   * Fetch remote cover URL into a Base64 data URL purely in RAM
   */
  public async getCoverAsBase64(url: string): Promise<string | null> {
    if (!url || !url.startsWith('http')) return null;

    if (this.coverCache.has(url)) {
      return this.coverCache.get(url)!;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) return null;

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = `data:${contentType};base64,${buffer.toString('base64')}`;

      // Manage cache size
      if (this.coverCache.size >= this.maxCacheSize) {
        const firstKey = this.coverCache.keys().next().value;
        if (firstKey) this.coverCache.delete(firstKey);
      }

      this.coverCache.set(url, base64);
      return base64;
    } catch (err) {
      streamDeck.logger.warn(`[ImageRenderer] Failed to fetch cover art in RAM: ${err}`);
      return null;
    }
  }

  /**
   * Official Google Repeat SVG (Off / All / One)
   */
  public getRepeatSvgBase64(mode: 'OFF' | 'ALL' | 'ONE'): string {
    let svg = '';
    if (mode === 'ONE') {
      svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="#FF0033">
        <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2h-1v-4h-1v-1h2v5z"/>
      </svg>`;
    } else if (mode === 'ALL') {
      svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="#FF0033">
        <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
      </svg>`;
    } else {
      svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="#C5C8D4">
        <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
      </svg>`;
    }
    return `data:image/svg+xml;base64,${Buffer.from(svg.trim()).toString('base64')}`;
  }

  /**
   * Official Google Shuffle SVG (Inactive vs Active)
   */
  public getShuffleSvgBase64(active: boolean): string {
    const color = active ? '#FF0033' : '#C5C8D4';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="${color}">
      <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
    </svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg.trim()).toString('base64')}`;
  }

  /**
   * Official Google Like SVG (Inactive vs Active)
   */
  public getLikeSvgBase64(active: boolean): string {
    let svg = '';
    if (active) {
      svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="#FF0033">
        <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/>
      </svg>`;
    } else {
      svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="#C5C8D4">
        <path d="M9 21h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2zM9 9l4.34-4.34L12 10h9v2l-3 7H9V9zM1 9h4v12H1z"/>
      </svg>`;
    }
    return `data:image/svg+xml;base64,${Buffer.from(svg.trim()).toString('base64')}`;
  }

  /**
   * Official Google Dislike SVG (Inactive vs Active)
   */
  public getDislikeSvgBase64(active: boolean): string {
    let svg = '';
    if (active) {
      svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="#FF0033">
        <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/>
      </svg>`;
    } else {
      svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="#C5C8D4">
        <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm0 12l-4.34 4.34L12 14H3v-2l3-7h9v10zm4-12h4v12h-4z"/>
      </svg>`;
    }
    return `data:image/svg+xml;base64,${Buffer.from(svg.trim()).toString('base64')}`;
  }
}
