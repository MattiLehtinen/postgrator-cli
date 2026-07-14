import js from "@eslint/js";
import node from "eslint-plugin-n";
import imprt from "eslint-plugin-import";
import unicorn from "eslint-plugin-unicorn";
import comments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import prettier from "eslint-plugin-prettier/recommended";
import { configs as yml } from "eslint-plugin-yml";

export default [
    js.configs.recommended,
    node.configs["flat/recommended-script"],
    comments.recommended,
    unicorn.configs.recommended,
    imprt.flatConfigs.recommended,
    ...yml.recommended,
    prettier,
    {
        languageOptions: {
            sourceType: "module",
            ecmaVersion: "latest",
        },
        rules: {
            "unicorn/prevent-abbreviations": "off",
            "unicorn/no-anonymous-default-export": "off",
            "unicorn/no-null": "off",
            "unicorn/no-useless-promise-resolve-reject": "off",
            "unicorn/catch-error-name": ["error", { name: "e" }],
            "@eslint-community/eslint-comments/no-unused-disable": "error",
            // GitHub Actions workflows rely on empty mapping values, e.g. `pull_request:`
            "yml/no-empty-mapping-value": "off",
        },
    },
    {
        ignores: ["coverage/", "node_modules/"],
    },
];
