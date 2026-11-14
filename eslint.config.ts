import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import pluginImport from 'eslint-plugin-import';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import security from 'eslint-plugin-security';
import sonarjs from 'eslint-plugin-sonarjs';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const rootDirectory = dirname(fileURLToPath(import.meta.url));

/* ---------------------------------------------------------------------------------------------- */
/* Global ignores and lint configuration                                                          */
/* ---------------------------------------------------------------------------------------------- */

export default defineConfig([
  // A standalone ignores object excludes directories from every config block.
  { ignores: ['archive/**'] },
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.cache/**',
      '**/.turbo/**',
      '*.config.cjs',
      '*.config.js',
      'src/tests/**/*.cjs',
      '**/playground-*.mongodb.js',
      '**/playground-*.mongodb.cjs',
    ],
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
  },

  /* -------------------------------------------------------------------------------------------- */
  /* TypeScript configuration                                                                     */
  /* -------------------------------------------------------------------------------------------- */
  {
    files: ['**/*.{ts,mts,cts,tsx,js,mjs,cjs}'],

    plugins: { sonarjs },

    rules: {
      /* Prevent clever but difficult control flow */
      'no-nested-ternary': 'error',
      'no-unneeded-ternary': 'error',
      'no-confusing-arrow': 'error',
      'no-else-return': ['error', { allowElseIf: false }],
      'no-multi-assign': 'error',
      'no-sequences': 'error',
      'no-return-assign': ['error', 'always'],
      'consistent-return': 'error',
      'curly': ['error', 'all'],

      /* Keep functions understandable */
      'complexity': ['error', 30],
      'max-depth': ['error', 15],
      'max-nested-callbacks': ['error', 10],
      'max-params': ['error', 10],
      'max-statements-per-line': ['error', { max: 1 }],

      /* SonarJS starts as warnings for incremental adoption. */
      // Cognitive complexity accounts for nesting separately from the cyclomatic limit above.
      'sonarjs/cognitive-complexity': ['warn', 50],
      'sonarjs/no-all-duplicated-branches': 'warn',
      'sonarjs/no-identical-functions': 'warn',
      'sonarjs/no-element-overwrite': 'warn',
      'sonarjs/no-collection-size-mischeck': 'warn',

      /* Prevent hidden mutation */
      'no-param-reassign': [
        'error',
        {
          props: true,
          ignorePropertyModificationsFor: ['req', 'res', 'ctx', 'draft'],
        },
      ],

      /* Ban misleading array-programming patterns */
      'no-restricted-syntax': [
        'error',

        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name='map'][callee.object.type='CallExpression'][callee.object.callee.type='MemberExpression'][callee.object.callee.property.name='filter']",
          message:
            'Do not chain .filter().map(). Use an explicit loop with named conditions and state.',
        },

        {
          selector: "CallExpression[callee.type='MemberExpression'][callee.property.name='reduce']",
          message: 'Do not use .reduce(). Use an explicit loop with clearly named state.',
        },

        {
          selector:
            "ExpressionStatement > CallExpression[callee.type='MemberExpression'][callee.property.name='map']",
          message: '.map() must produce a used result. Use a loop when performing side effects.',
        },

        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name='forEach'] > ArrowFunctionExpression[async=true]",
          message: 'Async .forEach() does not await its callbacks. Use for...of or Promise.all().',
        },
      ],
    },
  },

  {
    files: ['**/*.{ts,mts,cts,tsx}'],

    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: rootDirectory,
      },
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },

    plugins: {
      'prettier': eslintPluginPrettier,
      '@typescript-eslint': tseslint.plugin,
      'import': pluginImport,
      'unused-imports': unusedImports,
      security,
    },

    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked, prettier],

    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.eslint.json',
        },
      },
    },

    rules: {
      /* ---------------------------------------------------------------------------------------- */
      /* Prettier                                                                                 */
      /* ---------------------------------------------------------------------------------------- */

      'prettier/prettier': ['warn', { endOfLine: 'lf', singleQuote: true }],

      /* ---------------------------------------------------------------------------------------- */
      /* Imports                                                                                  */
      /* ---------------------------------------------------------------------------------------- */

      'import/extensions': 'off',
      'import/no-unresolved': 'off',
      'import/no-duplicates': 'warn',
      'import/order': [
        'warn',
        {
          'groups': ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          'alphabetize': { order: 'asc', caseInsensitive: true },
        },
      ],

      /* ---------------------------------------------------------------------------------------- */
      /* Style and consistency                                                                    */
      /* ---------------------------------------------------------------------------------------- */

      'semi': ['warn', 'always'],
      'comma-dangle': ['warn', 'only-multiline'],
      'object-curly-spacing': ['warn', 'always'],
      'eqeqeq': ['warn', 'always'],
      'prefer-const': 'warn',
      'no-var': 'warn',

      /* ---------------------------------------------------------------------------------------- */
      /* TypeScript safety                                                                        */
      /* ---------------------------------------------------------------------------------------- */

      '@typescript-eslint/no-unused-vars': 'off',

      'unused-imports/no-unused-imports': 'error',

      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-empty-function': ['error', { allow: ['private-constructors'] }],
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
      '@typescript-eslint/only-throw-error': 'error',
      '@typescript-eslint/parameter-properties': ['error', { prefer: 'class-property' }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/await-thenable': 'error',

      /* ---------------------------------------------------------------------------------------- */
      /* Shadowing                                                                                */
      /* ---------------------------------------------------------------------------------------- */

      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'warn',

      /* ---------------------------------------------------------------------------------------- */
      /* Node.js and general safety                                                               */
      /* ---------------------------------------------------------------------------------------- */

      'no-console': 'off',
      'handle-callback-err': ['warn', '^err'],
      'no-path-concat': 'warn',
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-empty-function': 'off',
      'no-throw-literal': 'off',
      'prefer-promise-reject-errors': 'error',
      'security/detect-eval-with-expression': 'error',
    },
  },

  /* -------------------------------------------------------------------------------------------- */
  /* JavaScript configuration                                                                     */
  /* -------------------------------------------------------------------------------------------- */

  {
    files: ['**/*.{js,mjs,cjs}'],

    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: rootDirectory,
      },
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },

    plugins: {
      'prettier': eslintPluginPrettier,
      '@typescript-eslint': tseslint.plugin,
      'import': pluginImport,
      security,
      'unused-imports': unusedImports,
    },

    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked, prettier],

    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.eslint.json',
        },
      },
    },

    rules: {
      /* ---------------------------------------------------------------------------------------- */
      /* Prettier                                                                                 */
      /* ---------------------------------------------------------------------------------------- */

      'prettier/prettier': ['warn', { endOfLine: 'lf', singleQuote: true }],

      /* ---------------------------------------------------------------------------------------- */
      /* Imports                                                                                  */
      /* ---------------------------------------------------------------------------------------- */

      'import/extensions': 'off',
      'import/no-unresolved': 'off',
      'import/no-duplicates': 'warn',
      'import/order': [
        'warn',
        {
          'groups': ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          'alphabetize': { order: 'asc', caseInsensitive: true },
        },
      ],

      /* ---------------------------------------------------------------------------------------- */
      /* Style and consistency                                                                    */
      /* ---------------------------------------------------------------------------------------- */

      'semi': ['warn', 'always'],
      'comma-dangle': ['warn', 'only-multiline'],
      'object-curly-spacing': ['warn', 'always'],
      'eqeqeq': ['warn', 'always'],
      'prefer-const': 'warn',
      'no-var': 'warn',

      /* ---------------------------------------------------------------------------------------- */
      /* TypeScript-aware JavaScript safety                                                       */
      /* ---------------------------------------------------------------------------------------- */

      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          args: 'after-used',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',

      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'warn',
      'no-console': 'off',
      'handle-callback-err': ['warn', '^err'],
      'no-path-concat': 'warn',
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-empty-function': 'warn',
      'no-throw-literal': 'error',
      'prefer-promise-reject-errors': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
      '@typescript-eslint/await-thenable': 'error',
      'security/detect-eval-with-expression': 'error',
    },
  },

  /* -------------------------------------------------------------------------------------------- */
  /* JavaScript extension policy                                                                  */
  /* -------------------------------------------------------------------------------------------- */

  {
    files: ['**/*.{js,mjs,cjs}'],
    rules: {
      'import/extensions': [
        'warn',
        'ignorePackages',
        {
          js: 'always',
          mjs: 'always',
          cjs: 'always',
        },
      ],
    },
  },

  /* -------------------------------------------------------------------------------------------- */
  /* Application-source logging policy                                                            */
  /* -------------------------------------------------------------------------------------------- */

  {
    files: ['src/**/*.{js,mjs,cjs,ts,tsx,mts,cts}'],
    rules: {
      'no-console': 'error',
    },
  },

  /* -------------------------------------------------------------------------------------------- */
  /* Scripts, CLI, and tests console policy                                                        */
  /* -------------------------------------------------------------------------------------------- */

  {
    files: [
      'scripts/**/*.{js,mjs,cjs,ts,tsx,mts,cts}',
      'src/scripts/**/*.{js,mjs,cjs,ts,tsx,mts,cts}',
      'src/cli/**/*.{js,mjs,cjs,ts,tsx,mts,cts}',
      '**/*.{test,spec}.{js,mjs,cjs,ts,tsx,mts,cts}',
      '**/tests/**/*.{js,mjs,cjs,ts,tsx,mts,cts}',
      '**/smoke-tests/**/*.{js,mjs,cjs,ts,tsx,mts,cts}',
    ],
    rules: {
      'no-console': 'off',
    },
  },

  /* -------------------------------------------------------------------------------------------- */
  /* Vitest configuration                                                                         */
  /* -------------------------------------------------------------------------------------------- */

  {
    files: ['**/*.{test,spec}.ts', '**/tests/**/*.{ts,tsx,mts,cts}'],
    // Shared API support and seed modules retain the strict typed source rules.
    ignores: ['src/tests/**'],
    plugins: {
      vitest,
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...vitest.environments.env.globals,
      },
    },
    rules: {
      ...vitest.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
]);
