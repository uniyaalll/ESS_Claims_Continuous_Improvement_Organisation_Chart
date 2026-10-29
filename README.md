# ESS Claims — Continuous Improvement Organisation Chart

AXA XL org chart (TRAF-style blocks) hosted on GitHub Pages. Roster and photos are driven by Excel in this repo.

## Live chart

**https://uniyaalll.github.io/ESS_Claims_Continuous_Improvement_Organisation_Chart/?v=20261029f**

## Modes

- **Light** — white / black TRAF blocks  
- **Color** — pillar gradients (green / purple / orange) like the official chart  
- **Dark** — pure black with AXA blue accents  

Also: Download + Copy as **1920×1080** PowerPoint slide PNG.

## Update names / structure

Edit [`data/org-chart.xlsx`](data/org-chart.xlsx):

| Column | Meaning |
|--------|---------|
| `id` | Unique id |
| `name` | Display name |
| `role` | Job title |
| `manager_id` | Manager’s `id` (blank = root) |
| `team` | Team label |
| `pillar` | `leadership` \| `system` \| `process` \| `automation` |
| `photo` | Filename in `assets/photos/` **or** image URL |

## Add profile photos

1. Put files in [`assets/photos/`](assets/photos/) (e.g. `rebecca-newcastle.jpg`)
2. In Excel **photo** column, enter that filename (or a full `https://…` URL)
3. Commit + push — Pages redeploys with photos in the square placeholders

Leave `photo` blank to keep the square placeholder.

```bash
pip install openpyxl
python scripts/generate_org_data.py
```

## Local preview

```bash
python3 -m http.server 8080
```

Open http://localhost:8080
