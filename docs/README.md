# My Accurivo — myaccurivo.net

Official website of **My Accurivo** — simple accounting software for small businesses (Windows).

## Pages site
- Repo: https://github.com/circuitsorceryapp-ui/myaccurivo
- Site: https://myaccurivo.net (after GitHub Pages + DNS are set up)

## Files
- `index.html` — landing page (English + Latviešu, toggle in top right)
- `style.css`, `script.js` — design and translations
- `CNAME` — custom domain: myaccurivo.net
- `404.html` — not-found page

## Program download
The Download buttons point to the latest GitHub Release:
`https://github.com/circuitsorceryapp-ui/myaccurivo/releases/latest/download/accurivo.exe`
Upload `accurivo.exe` as a release asset named exactly `accurivo.exe` (Releases → Create a new release → attach file → Publish).

## Enable the site (one time)
GitHub repo → **Settings → Pages → Branch: main, folder /(root) → Save**.
Then in your domain's DNS add A records for `@`:
185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
and CNAME `www` → `circuitsorceryapp-ui.github.io`.
