# dachshund website

Static product site for dachshund. It has no server, database, analytics, or runtime dependencies.

## Preview locally

```sh
python3 -m http.server 4173 --directory site
```

Open `http://127.0.0.1:4173/` for English or `http://127.0.0.1:4173/zh/` for Chinese.

## Publish

Pushing changes under `site/` to `main` triggers `.github/workflows/pages.yml`.
GitHub Pages must use **GitHub Actions** as its source. Once deployed, the default
URL is `https://ewen2015.github.io/dachshund/`.
