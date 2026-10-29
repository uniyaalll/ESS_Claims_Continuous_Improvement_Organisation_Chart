# ESS Claims — Continuous Improvement Organisation Chart

AXA XL–branded organisation chart hosted on GitHub Pages. Names and reporting lines are driven by an Excel workbook in this repository.

## Live chart

**https://uniyal.github.io/ESS_Claims_Continuous_Improvement_Organisation_Chart/**

> After the first merge to `main`, enable **Settings → Pages → Source: GitHub Actions** if Pages is not already active. The workflow then publishes the site automatically.

## Features

- Clean, minimal AXA XL look (Torch Red / Navy / Porcelain)
- Light / dark mode toggle
- Download chart as PNG
- Copy chart as an image to the clipboard
- Fixed on-screen frame — the tree scales to fit (no page scroll)
- Data sourced from Excel; chart updates when the workbook is changed and pushed

## Update the chart

1. Open [`data/org-chart.xlsx`](data/org-chart.xlsx)
2. Edit the **Org Chart** sheet:

   | Column       | Meaning                                      |
   |-------------|-----------------------------------------------|
   | `id`        | Unique id for this person                     |
   | `name`      | Name shown on the card                        |
   | `role`      | Job title                                     |
   | `manager_id`| `id` of their manager (blank = top of chart)  |
   | `team`      | Optional team / department label              |

3. Save, commit, and push to `main`
4. GitHub Actions regenerates `data/org-chart.json` and redeploys Pages

Locally you can regenerate JSON without pushing:

```bash
pip install openpyxl
python scripts/generate_org_data.py
```

## Local preview

Serve the repo root over HTTP (required for `fetch` of the JSON):

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080

## Project layout

```
index.html              # Chart page
css/styles.css          # AXA XL theme + light/dark
js/app.js               # Tree render, fit-to-frame, copy/download
data/org-chart.xlsx     # Source of truth (edit this)
data/org-chart.json     # Generated for the web app
scripts/generate_org_data.py
.github/workflows/pages.yml
```

## Brand notes

Colours follow AXA XL: Torch Red `#FF1721`, Navy `#00008F`, Porcelain `#FBFCFC`. Typography uses Source Sans 3.
