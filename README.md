# Accounting Schedule

A desktop application for managing lease schedules and fixed asset registers, built with Electron, React, and TypeScript.

## Overview

Accounting Schedule is an internal tool designed to handle AASB 16 / IFRS 16 lease accounting and fixed asset management across multiple entities. It generates detailed Excel reports with present value calculations, depreciation schedules, and financial summaries.

## Features

### Lease Management
- **Property Leases** — Track property leases with commencement/expiry dates, annual rent, fixed increment rates, and CPI adjustments
- **Mobile Equipment Leases** — Manage vehicle and equipment leases with VIN, rego, and engine number tracking
- **PV Calculations** — Automatic present value calculations using the incremental borrowing rate
- **Opening Balances** — Support for mid-period lease adoption with configurable opening balance entries
- **Excel Export** — Generate multi-sheet workbooks with payment schedules, PV calculation worksheets, and summary/detail reports

### Fixed Assets
- **Assets Register** — Track fixed assets by category, branch, cost, vendor, and useful life with straight-line depreciation
- **CIP Schedule** — Construction In Progress tracking with invoice-level detail and completion workflows
- **Bulk Upload** — Import assets from Excel files
- **Excel Reports** — Export asset registers and depreciation schedules

### Entity Management
- Multi-entity support with isolated data per entity
- Company code management
- Configurable data storage path

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 19 + TypeScript |
| Component Library | MUI (Material UI) v7 |
| Desktop Shell | Electron |
| Excel Generation | SheetJS (xlsx) |
| Build Tool | Create React App |
| Packaging | electron-builder |

## Getting Started

### Prerequisites
- Node.js
- npm

### Install dependencies

```bash
npm install
```

### Run in development (browser only)

```bash
npm start
```

### Run in development (Electron)

```bash
npm run electron:dev
```

### Build desktop app (Windows)

```bash
npm run electron:build:win
```

The installer will be output to the `dist/` directory.

## Data Storage

- **Electron (production):** Data is stored as JSON files on disk. The storage path is configurable via Settings.
- **Browser (development):** Falls back to `localStorage`.

Each entity's leases, assets, and CIP assets are stored independently.

## Project Structure

```
src/
├── components/
│   ├── FixedAssets/     # Asset register, CIP, depreciation, disposal
│   ├── Homepage/        # Entity management, home screen
│   ├── Layout/          # App layout, sidebar navigation
│   ├── Leases/          # Lease forms, dashboards, reports
│   │   └── excel/       # Excel generation logic (PV, payments, reports)
│   ├── Settings/        # App settings page
│   └── shared/          # Shared UI components (Toast, etc.)
├── types/               # TypeScript interfaces (Lease, Asset, Entity)
└── utils/               # Data storage abstraction, helpers
electron/
├── main.js              # Electron main process
└── preload.js           # IPC bridge (electronAPI)
```
