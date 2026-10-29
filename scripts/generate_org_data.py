#!/usr/bin/env python3
"""Generate org-chart.xlsx (source of truth) and org-chart.json (for the web app)."""

from __future__ import annotations

import json
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"

# Placeholder ESS Claims Continuous Improvement hierarchy.
# Edit names/roles/manager_id in the Excel file; the chart updates on deploy.
PEOPLE = [
    {
        "id": "1",
        "name": "Alex Morgan",
        "role": "Head of ESS Claims",
        "manager_id": "",
        "team": "ESS Claims",
        "photo": "",
    },
    {
        "id": "2",
        "name": "Jordan Lee",
        "role": "Continuous Improvement Lead",
        "manager_id": "1",
        "team": "Continuous Improvement",
        "photo": "",
    },
    {
        "id": "3",
        "name": "Sam Rivera",
        "role": "Operations Excellence Manager",
        "manager_id": "1",
        "team": "Operations",
        "photo": "",
    },
    {
        "id": "4",
        "name": "Casey Nguyen",
        "role": "Process Analyst",
        "manager_id": "2",
        "team": "Continuous Improvement",
        "photo": "",
    },
    {
        "id": "5",
        "name": "Riley Patel",
        "role": "Process Analyst",
        "manager_id": "2",
        "team": "Continuous Improvement",
        "photo": "",
    },
    {
        "id": "6",
        "name": "Taylor Brooks",
        "role": "Change Manager",
        "manager_id": "2",
        "team": "Continuous Improvement",
        "photo": "",
    },
    {
        "id": "7",
        "name": "Morgan Ellis",
        "role": "Quality Lead",
        "manager_id": "3",
        "team": "Operations",
        "photo": "",
    },
    {
        "id": "8",
        "name": "Jamie Chen",
        "role": "Reporting Analyst",
        "manager_id": "3",
        "team": "Operations",
        "photo": "",
    },
]

COLUMNS = ["id", "name", "role", "manager_id", "team", "photo"]


def write_excel(people: list[dict]) -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / "org-chart.xlsx"
    wb = Workbook()
    ws = wb.active
    ws.title = "Org Chart"

    header_fill = PatternFill("solid", fgColor="00008F")
    header_font = Font(color="FFFFFF", bold=True, name="Calibri", size=11)
    note_font = Font(color="666666", italic=True, name="Calibri", size=10)

    for col, key in enumerate(COLUMNS, start=1):
        cell = ws.cell(1, col, key)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")

    for row, person in enumerate(people, start=2):
        for col, key in enumerate(COLUMNS, start=1):
            ws.cell(row, col, person.get(key, ""))

    # Instructions sheet
    info = wb.create_sheet("How to edit", 1)
    lines = [
        "How to update the organisation chart",
        "",
        "1. Edit names, roles, or teams on the 'Org Chart' sheet.",
        "2. To add a person: add a new row with a unique id.",
        "3. Set manager_id to the id of the person they report to.",
        "4. Leave manager_id blank for the top of the chart (only one root).",
        "5. Commit and push this file to GitHub. Pages rebuilds the chart.",
        "",
        "Columns:",
        "id          Unique identifier (text or number).",
        "name        Display name on the chart card.",
        "role        Job title / role line under the name.",
        "manager_id  id of the manager; blank for the root.",
        "team        Optional team / department label.",
        "photo       Optional profile image URL (leave blank for placeholder).",
    ]
    for i, line in enumerate(lines, start=1):
        cell = info.cell(i, 1, line)
        if i == 1:
            cell.font = Font(bold=True, color="00008F", size=14)
        else:
            cell.font = note_font
    info.column_dimensions["A"].width = 90

    widths = {
        "id": 10,
        "name": 22,
        "role": 32,
        "manager_id": 14,
        "team": 24,
        "photo": 36,
    }
    for col, key in enumerate(COLUMNS, start=1):
        ws.column_dimensions[get_column_letter(col)].width = widths[key]

    wb.save(path)
    return path


def write_json(people: list[dict]) -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / "org-chart.json"
    payload = {
        "title": "ESS Claims — Continuous Improvement",
        "subtitle": "Organisation Chart",
        "people": people,
    }
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return path


def people_from_excel(path: Path) -> list[dict]:
    from openpyxl import load_workbook

    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb["Org Chart"] if "Org Chart" in wb.sheetnames else wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []
    headers = [str(h).strip() if h is not None else "" for h in rows[0]]
    people = []
    for row in rows[1:]:
        if row is None or all(v is None or str(v).strip() == "" for v in row):
            continue
        person = {}
        for i, key in enumerate(headers):
            if not key:
                continue
            value = row[i] if i < len(row) else ""
            person[key] = "" if value is None else str(value).strip()
        if person.get("id") and person.get("name"):
            people.append(person)
    return people


def main() -> None:
    excel_path = DATA_DIR / "org-chart.xlsx"
    if excel_path.exists():
        people = people_from_excel(excel_path)
        if not people:
            people = PEOPLE
    else:
        people = PEOPLE

    for person in people:
        for key in COLUMNS:
            person.setdefault(key, "")

    write_excel(people)
    write_json(people)
    print(f"Wrote {len(people)} people to data/org-chart.xlsx and data/org-chart.json")


if __name__ == "__main__":
    main()
