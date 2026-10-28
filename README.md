# My Accurivo

Simple accounting for small businesses — invoices, quotes, purchase bills,
CMR consignment notes, customers, stock, scanned originals, backups and
restore. Two languages: English and Latviešu (Latvian).

- **No installation** if you use `accurivo.exe` (Windows) — just double-click it.
- All data lives in **one file**: `accurivo.db` (created next to the program).
- Each company (workspace) sees only its own data.

## Run (Windows, simplest)

1. Double-click `accurivo.exe`.
2. Your browser opens at `http://localhost:3000`.
3. Click "New company? Create one" and register.

## Run (any system with Node.js 22+)

```
node server.js
```

Then open `http://localhost:3000`. To change the port or database location:

```
PORT=8080 DB_PATH=/path/to/accurivo.db node server.js
```

## Daily use

- **Dashboard** — who owes you, what you owe, this month's documents.
- **Documents** — invoices (INV-…), quotes (QUO-…), purchase bills (PUR-…)
  and CMR consignment notes (CMR-…). Record payments; status becomes
  Partial / Paid automatically.
- **CMR (international road consignment note)** — open any invoice and press
  **Generate CMR**: a CMR waybill is created with the customer, goods and
  quantities from the invoice, and opens ready to print. You can also create
  a blank one with **New CMR** and fill in carrier, dispatch and delivery
  places, packages and gross weight.
- **Customers & suppliers** — two separate lists (customers and suppliers), all details
  in one inline form (name, registration no., VAT no., email, phone, address),
  edit any time, import from Excel/CSV, export CSV.
- **My stock** — items you received minus items you invoiced.
- **Scanned originals** — attach PDFs, photos, Excel or CSV files to documents.
- **Settings** — company details, bank accounts (shown on printed invoices),
  logo, people (up to 10 per company), two-step verification (TOTP),
  language, demo data.

Backups and restore live in **Settings → Backups**.

## Backups

1. Enter a **backup folder** on your computer and press Save.
2. Press **Back up now** — a full copy of your data is saved as
   `accurivo-backup-…db`. The newest 30 copies are kept, older ones are removed.
3. Optional: **Auto-backup daily** saves one copy per day automatically.
4. **Download backup** saves a copy to your Downloads folder.

## Restore (before / after a software update)

Before updating the software, always make a backup first.

1. Go to **Settings → Restore everything from a backup file**.
2. Press **Choose a backup file** and select your `.db` backup.
3. Press **Restore and restart** and confirm.
4. Everything (companies, documents, contacts, scans, settings) is put back
   exactly as it was, and the program restarts by itself.

A safety copy of your current data is always written to
`accurivo.db.before-restore` first — if the restore was a mistake, rename that
file back to `accurivo.db`.

Works the same in `accurivo.exe`: the exe closes and reopens by itself.

## Printing

Open a document → **Print** → a clean printable invoice (or CMR waybill) opens
with your company details and the chosen bank account.

## Notes for EU businesses

Accurivo stores the VAT rate you set per document and prints VAT lines. The CMR
printout follows the layout of the international road consignment note
(sender, carrier, consignee, places of dispatch/delivery, goods, packages,
gross weight, signature lines). It is not a certified fiscal or e-invoicing
system — check the requirements of your country for mandatory e-invoicing and
VAT reporting.

## License

All rights reserved — see the LICENSE file. Not for redistribution without a
written commercial license.
