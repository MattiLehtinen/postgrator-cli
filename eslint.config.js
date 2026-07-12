import js from "@eslint/js";
import node from "eslint-plugin-n";
import imprt from "eslint-plugin-import";
import unicorn from "eslint-plugin-unicorn";
import comments from "@eslint-community/eslint-plugin-eslint-comments/configs";

export default [
    js.configs.recommended,
    node.configs["flat/recommended-script"],
    comments.recommended,
    unicorn.configs.recommended,
    imprt.flatConfigs.recommended,
    {
        languageOptions: {
            sourceType: "module",
            ecmaVersion: "latest",
        },
        rules: {
            "arrow-body-style": "off",
            "comma-dangle": ["error", "always-multiline"],
            "global-require": "off",
            "indent": ["warn", 4],
            "linebreak-style": "off",
            "no-console": "off",
            "import/no-dynamic-require": "off",
            "max-len": ["error", { "code": 140 }],
            "no-param-reassign": "off",
            "no-use-before-define": "off",
            "unicorn/prevent-abbreviations": "off",
            "unicorn/no-nested-ternary": "off",
            "unicorn/no-array-push-push": "off",
            "unicorn/no-anonymous-default-export": "off",
            "unicorn/no-null": "off",
            "unicorn/no-useless-promise-resolve-reject": "off",
            "unicorn/catch-error-name": ["error", { "name": "e" }],
            "@eslint-community/eslint-comments/no-unused-disable": "error",
        },
    },
    {
        ignores: ["coverage/", "node_modules/"],
    },
];
