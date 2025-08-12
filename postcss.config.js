// postcss.config.js
module.exports = {
  plugins: {
    "@tailwindcss/postcss": {}, // ← was `tailwindcss`
    autoprefixer: {},
  },
};
