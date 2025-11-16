module.exports = {
  // Formatting
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  
  // JSX
  jsxSingleQuote: false,
  jsxBracketSameLine: false,
  
  // Arrows
  arrowParens: 'always',
  
  // Special cases
  endOfLine: 'lf',
  bracketSpacing: true,
  quoteProps: 'as-needed',
  
  // File-specific overrides
  overrides: [
    {
      files: '*.json',
      options: {
        printWidth: 80,
      },
    },
    {
      files: '*.md',
      options: {
        proseWrap: 'always',
      },
    },
  ],
};
