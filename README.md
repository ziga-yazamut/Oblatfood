# Oblath Product Finder

A one-page app to search the supplier price list, filter products and build the order Excel.

- `site/index.html` is the published app (Netlify serves the `site` folder).
- `src/` holds the source: `template.html` (the app), `parser.js` (reads PDF and Excel lists) and `data.json` (the built-in list).
- Run `python3 build.py` to rebuild `site/index.html` from `src/`.
