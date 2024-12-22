import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    // ...tseslint.configs.stylisticTypeChecked,
    {
        languageOptions: {
            parserOptions: {
                projectService: {
                    allowDefaultProject: ['*.js'],
                    defaultProject: 'tsconfig.json',
                },
            },
        },
        rules: {
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/restrict-template-expressions': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unused-vars': 'warn',
        },
    },
    {
        files: ['eslint.config.mjs'],
        extends: [tseslint.configs.disableTypeChecked],
    },
);
