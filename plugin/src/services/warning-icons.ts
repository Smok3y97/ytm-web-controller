/**
 * Warning Icon SVG Generator
 *
 * Generates pixel-perfect, uniform in-memory SVG data URLs for keypad actions
 * during version mismatch with a crisp amber warning triangle overlay.
 */

const RAW_PATHS: Record<string, string> = {
	playpause: '<path d="M8 5v14l11-7z" fill="#FFFFFF"/>',
	pause: '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="#FFFFFF"/>',
	next: '<path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" fill="#FFFFFF"/>',
	prev: '<path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" fill="#FFFFFF"/>',
	volumeup:
		'<path d="M3 9v6h4l5 5V4L7 9H3zm11 3h6m-3-3v6" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>',
	volumedown:
		'<path d="M3 9v6h4l5 5V4L7 9H3zm11 3h6" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>',
	mute: '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="#FFFFFF"/>',
	like: '<path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" fill="#FFFFFF"/>',
	dislike:
		'<path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z" fill="#FFFFFF"/>',
	shuffle:
		'<path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" fill="#FFFFFF"/>',
	repeat: '<path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" fill="#FFFFFF"/>',
	copyurl:
		'<path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" fill="#FFFFFF"/>',
	seekforward:
		'<path d="M18 13c0 3.31-2.69 6-6 6s-6-2.69-6-6 2.69-6 6-6v4l5-5-5-5v4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8h-2z" fill="#FFFFFF"/><path d="M10.86 15.94H9.72V11.2h-.03l-1.39.95-.44-.8 2-1.35h.99v6zM14.65 10.96c.38.3.57.8.57 1.48v1.65c0 .68-.19 1.18-.57 1.48-.38.3-.92.45-1.61.45s-1.23-.15-1.61-.45c-.38-.3-.57-.8-.57-1.48v-1.65c0-.68.19-1.18.57-1.48.38-.3.92-.45 1.61-.45s1.23.15 1.61.45zm-.82 3.23v-1.85c0-.3-.06-.52-.18-.65-.12-.13-.3-.2-.55-.2s-.43.07-.55.2c-.12.13-.18.35-.18.65v1.85c0 .3.06.52.18.65.12.13.3.2.55.2s.43-.07.55-.2c.12-.13.18-.35.18-.65z" fill="#FFFFFF"/>',
	seekbackward:
		'<path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" fill="#FFFFFF"/><path d="M10.86 15.94H9.72V11.2h-.03l-1.39.95-.44-.8 2-1.35h.99v6zM14.65 10.96c.38.3.57.8.57 1.48v1.65c0 .68-.19 1.18-.57 1.48-.38.3-.92.45-1.61.45s-1.23-.15-1.61-.45c-.38-.3-.57-.8-.57-1.48v-1.65c0-.68.19-1.18.57-1.48.38-.3.92-.45 1.61-.45s1.23.15 1.61.45zm-.82 3.23v-1.85c0-.3-.06-.52-.18-.65-.12-.13-.3-.2-.55-.2s-.43.07-.55.2c-.12.13-.18.35-.18.65v1.85c0 .3.06.52.18.65.12.13.3.2.55.2s.43-.07.55-.2c.12-.13.18-.35.18-.65z" fill="#FFFFFF"/>',
};

/**
 * Returns a data URL SVG for a keypad action with an overlaid amber warning badge
 */
export function getActionWarningSvgDataUrl(actionKey: string): string {
	const iconPath = RAW_PATHS[actionKey.toLowerCase()] || RAW_PATHS.playpause;

	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" width="72" height="72">
  <!-- Base Action Icon (Centered, 48x48 inside 72x72) -->
  <g transform="translate(12, 12) scale(2)" opacity="0.8">
    ${iconPath}
  </g>
  <!-- Amber Warning Triangle Badge at Top-Right (Uniform across all keys) -->
  <g transform="translate(44, 4)">
    <polygon points="12,2 23,22 1,22" fill="#FFB300" stroke="#000000" stroke-width="1.8" stroke-linejoin="round"/>
    <rect x="11" y="8" width="2" height="7" fill="#000000" rx="1"/>
    <circle cx="12" cy="18.5" r="1.2" fill="#000000"/>
  </g>
</svg>`;

	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
