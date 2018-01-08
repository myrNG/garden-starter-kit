module.exports = {
  "source": "./src/css",
  "homepage": "styleguide.md",
  "destination": "./build/doc/styleguide",
  "builder": "./node_modules/@cleverage/gsk/kss",
  "custom": [
    "Colors",
    "Icons",
  ],
  "css": [
    "../../css/doc.css",
    "../../css/styles.css",
  ],
};
