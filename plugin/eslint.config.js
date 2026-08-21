import { config } from "@elgato/eslint-config";
import { defineConfig } from "eslint/config";
import globals from "globals";

export default defineConfig([
	...config.recommended,
	{
		rules: {
			"no-empty": ["error", { allowEmptyCatch: true }],
			"jsdoc/require-jsdoc": "off",
			"jsdoc/require-param": "off",
			"jsdoc/require-returns": "off",
			"jsdoc/tag-lines": "off",
		},
	},
	{
		files: ["**/*.{ts,mts,cts,tsx}"],
		rules: {
			"@typescript-eslint/explicit-member-accessibility": "off",
			"@typescript-eslint/member-ordering": "off",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
		},
	},
	{
		files: ["ui/**/*.js"],
		languageOptions: {
			globals: {
				...globals.browser,
				StreamDeckClient: "readonly",
				GlobalSettingsComponent: "readonly",
				I18n: "readonly",
				connectElgatoStreamDeckSocket: "writable",
			},
		},
		rules: {
			"no-unused-vars": [
				"warn",
				{
					varsIgnorePattern: "^(connectElgatoStreamDeckSocket|GlobalSettingsComponent|I18n)$",
					argsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
		},
	},
	{
		ignores: ["bin/", "node_modules/", "assets/"],
	},
]);
