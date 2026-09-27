/**
 * Property Inspector Internationalization (i18n) Helper
 *
 * Dynamically loads translation dictionaries from root language files (../de.json, ../en.json)
 * using the official Elgato Stream Deck "Localization" specification.
 */

const I18n = (() => {
	let currentLang = "en";
	const listeners = new Set();
	const loadedDictionaries = {};

	function loadJsonSync(lang) {
		const normalized = lang.toLowerCase().startsWith("de") ? "de" : "en";
		if (loadedDictionaries[normalized] && Object.keys(loadedDictionaries[normalized]).length > 0) {
			return loadedDictionaries[normalized];
		}

		try {
			const xhr = new XMLHttpRequest();
			xhr.open("GET", `../${normalized}.json`, false);
			xhr.send(null);
			if (xhr.status === 200 || xhr.status === 0) {
				const data = JSON.parse(xhr.responseText);
				loadedDictionaries[normalized] = data.Localization || {};
				return loadedDictionaries[normalized];
			}
		} catch (e) {
			console.warn(`[I18n] Could not load ../${normalized}.json:`, e);
		}

		loadedDictionaries[normalized] = loadedDictionaries[normalized] || {};
		return loadedDictionaries[normalized];
	}

	async function loadJsonAsync(lang) {
		const normalized = lang.toLowerCase().startsWith("de") ? "de" : "en";
		if (loadedDictionaries[normalized] && Object.keys(loadedDictionaries[normalized]).length > 0) {
			return loadedDictionaries[normalized];
		}

		try {
			const res = await fetch(`../${normalized}.json`);
			if (res.ok) {
				const data = await res.json();
				loadedDictionaries[normalized] = data.Localization || {};
				return loadedDictionaries[normalized];
			}
		} catch (_err) {
			return loadJsonSync(normalized);
		}

		return loadJsonSync(normalized);
	}

	// Pre-load default English dictionary synchronously on script evaluation
	loadJsonSync("en");

	function t(key, fallback = "") {
		if (!key) return fallback || "";

		// 1. Check active language dictionary
		const activeDict = loadedDictionaries[currentLang];
		if (activeDict && activeDict[key] !== undefined && activeDict[key] !== null && activeDict[key] !== "") {
			return activeDict[key];
		}

		// 2. Fallback to English dictionary
		const enDict = loadedDictionaries.en;
		if (enDict && enDict[key] !== undefined && enDict[key] !== null && enDict[key] !== "") {
			return enDict[key];
		}

		// 3. Fallback to default
		return fallback || key;
	}

	function setLanguage(lang) {
		if (!lang) return;
		const normalized = lang.toLowerCase().startsWith("de") ? "de" : "en";
		currentLang = normalized;
		loadJsonSync(normalized);
		if (normalized !== "en") {
			loadJsonSync("en");
		}
		translateDOM();
		listeners.forEach((cb) => {
			try {
				cb(currentLang);
			} catch (e) {
				console.error(e);
			}
		});
	}

	function onLanguageChange(cb) {
		if (typeof cb === "function") {
			listeners.add(cb);
		}
	}

	function translateDOM(root = document) {
		root.querySelectorAll("[data-i18n]").forEach((elem) => {
			const key = elem.getAttribute("data-i18n");
			if (!key) return;
			const translated = t(key);
			if (translated) {
				elem.textContent = translated;
			}
		});

		root.querySelectorAll("[data-i18n-placeholder]").forEach((elem) => {
			const key = elem.getAttribute("data-i18n-placeholder");
			if (key) {
				elem.setAttribute("placeholder", t(key, elem.getAttribute("placeholder")));
			}
		});

		root.querySelectorAll("[data-i18n-title]").forEach((elem) => {
			const key = elem.getAttribute("data-i18n-title");
			if (key) {
				elem.setAttribute("title", t(key, elem.getAttribute("title")));
			}
		});
	}

	// Initial DOM translation when ready
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", () => translateDOM());
	} else {
		translateDOM();
	}

	return {
		t,
		setLanguage,
		getLanguage: () => currentLang,
		onLanguageChange,
		translateDOM,
		loadLanguage: loadJsonAsync,
	};
})();
