import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReactConfig from "eslint-plugin-react/configs/recommended.js";

export default [
  {
    ignores: ["dist", "node_modules"],
  },
  { languageOptions: { globals: globals.browser } },
  ...tseslint.configs.recommended,
  {
    ...pluginReactConfig,
    settings: {
      react: {
        version: "detect"
      }
    }
  },
];
