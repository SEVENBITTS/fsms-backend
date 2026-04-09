# Timeline Service

A small Node/Express/TypeScript/Postgres service for reading a timeline/event ledger with:

- composable filtering
- normalized response types
- cursor pagination
- date-range filtering
- explicit classified / legacy markers

## Requirements

- Node.js 20+
- PostgreSQL

## Setup

1. Copy env file:

```bash
cp .env.example .env