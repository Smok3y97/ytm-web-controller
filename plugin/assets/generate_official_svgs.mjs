/**
 * Official Google YouTube Music SVG Icon Generator
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseDir = __dirname;

const icons = {
  // Plugin Main Icon (Color for detail / marketplace pane)
  'plugin-icon': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144">
  <circle cx="12" cy="12" r="11" fill="#FF0033"/>
  <circle cx="12" cy="12" r="7" fill="none" stroke="#FFFFFF" stroke-width="1.5"/>
  <polygon points="10,8.5 16,12 10,15.5" fill="#FFFFFF"/>
</svg>`,

  // Category Icon (White monochrome for sidebar / action list)
  'category-icon': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="none">
  <circle cx="12" cy="12" r="10" stroke="#FFFFFF" stroke-width="2"/>
  <circle cx="12" cy="12" r="6" stroke="#FFFFFF" stroke-width="1.5"/>
  <polygon points="10,8.5 15.5,12 10,15.5" fill="#FFFFFF"/>
</svg>`,

  // Play / Pause
  'actions/playpause/icon': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="#FFFFFF">
  <path d="M8 5v14l11-7z"/>
</svg>`,

  'actions/playpause/play': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="#FFFFFF">
  <path d="M8 5v14l11-7z"/>
</svg>`,

  'actions/playpause/pause': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="#FFFFFF">
  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
</svg>`,

  // Dial (Monochromatic white)
  'actions/dial/icon': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144">
  <circle cx="12" cy="12" r="10" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-dasharray="45 10"/>
  <polygon points="10,8.5 15.5,12 10,15.5" fill="#FFFFFF"/>
</svg>`,

  // Next / Previous
  'actions/next/icon': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="#FFFFFF">
  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
</svg>`,

  'actions/prev/icon': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="#FFFFFF">
  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
</svg>`,

  // Copy URL
  'actions/copyurl/icon': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="#FFFFFF">
  <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
</svg>`,

  'actions/copyurl/copied': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="#00E676">
  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
</svg>`,

  // Like
  'actions/like/icon': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="#FFFFFF">
  <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/>
</svg>`,

  'actions/like/like-inactive': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="#C5C8D4">
  <path d="M9 21h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2zM9 9l4.34-4.34L12 10h9v2l-3 7H9V9zM1 9h4v12H1z"/>
</svg>`,

  'actions/like/like-active': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="#FF0033">
  <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/>
</svg>`,

  // Dislike
  'actions/dislike/icon': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="#FFFFFF">
  <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/>
</svg>`,

  'actions/dislike/dislike-inactive': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="#C5C8D4">
  <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm0 12l-4.34 4.34L12 14H3v-2l3-7h9v10zm4-12h4v12h-4z"/>
</svg>`,

  'actions/dislike/dislike-active': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="#FF0033">
  <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/>
</svg>`,

  // Shuffle
  'actions/shuffle/icon': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="#FFFFFF">
  <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
</svg>`,

  'actions/shuffle/shuffle-inactive': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="#C5C8D4">
  <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
</svg>`,

  'actions/shuffle/shuffle-active': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="#FF0033">
  <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
</svg>`,

  // Repeat
  'actions/repeat/icon': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="#FFFFFF">
  <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
</svg>`,

  'actions/repeat/repeat-off': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="#C5C8D4">
  <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
</svg>`,

  'actions/repeat/repeat-all': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="#FF0033">
  <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
</svg>`,

  'actions/repeat/repeat-one': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="144" height="144" fill="#FF0033">
  <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2h-1v-4h-1v-1h2v5z"/>
</svg>`
};

for (const [relPath, svg] of Object.entries(icons)) {
  const fullPath = path.join(baseDir, `${relPath}.svg`);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, svg, 'utf8');
}

console.log('Successfully wrote all official SVG vectors!');
