# Sterix Operations — Setup Guide

This is a new, standalone app (separate from your existing Inventory & Orders app)
covering the full flow from your flow chart: Purchase Requisition → PO → GRN →
Incoming QC → Material Issue → Production → WIP → Sterilization → Final QC →
Packing → Finished Goods → Dispatch, plus Batch Traceability, Scrap Register,
and configurable per-user permissions.

## 1. Create a new Supabase project

1. Go to supabase.com → New Project.
2. Name it something like `sterix-operations`.
3. Wait for it to provision, then go to **Project Settings → API** and copy:
   - Project URL
   - `anon` public key
   - `service_role` key (keep this secret — only used server-side)

## 2. Run the database schema

1. In the Supabase dashboard, go to **SQL Editor**.
2. Open `supabase/schema.sql` from this project, copy the whole file, paste it in, and click **Run**.
3. This creates every table, the permission system, row-level security policies, and seeds the 21 modules.

## 3. Deploy the Edge Function (for creating users safely)

The "Add User" button in the app calls a small server-side function so that
creating a teammate's login doesn't switch the admin's own browser session
(which is what happens if you create users directly from the client).

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy create-user
```

No extra secrets needed — Supabase automatically provides `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` to edge functions.

## 4. Create your own first Admin account

Since the app itself requires an existing admin to create new users, bootstrap
your own account directly in Supabase:

1. Go to **Authentication → Users → Add User** in the Supabase dashboard.
2. Enter your email and a password. Confirm the email automatically.
3. Copy the generated User UID.
4. Go to **SQL Editor** and run:
   ```sql
   insert into app_users (id, full_name, email, is_admin)
   values ('PASTE-THE-USER-UID-HERE', 'Hasan', 'your@email.com', true);
   ```
5. You can now log into the app with that email/password as a full admin.

## 5. Configure environment variables

Create a `.env` file in the project root (already gitignored) with:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## 6. Run locally to test

```bash
npm install
npm run dev
```

## 7. Deploy to Vercel

1. Push this project to a new GitHub repo.
2. Go to vercel.com → New Project → import the repo.
3. In **Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same values as your `.env`).
4. Deploy. Vercel will give you a live URL.

## 8. Add your team

Once logged in as admin:
1. Go to **User & Permission Management** in the sidebar (under Admin).
2. Click **Add User** for each of Shikhar, Aditya, A.K. Singh, Murli — set a temporary password they can change later (note: a "change my password" self-service flow isn't built yet; for now you'd reset it manually via the Supabase dashboard if needed).
3. Click the settings icon next to each user to set their per-module access (None / View / Edit) — e.g. Store sees Material Requisition + Stock Register, Production sees Production Planning + WIP + Sterilization, etc.
4. You (and any other admins you promote) always see and can edit everything, regardless of these settings.

## How the data flows (so you know what feeds what)

- **Material Master** is the foundation — every other module references items from here.
- **PR → PO → GRN**: a requisition can be approved and converted into a PO; receiving against
  that PO in GRN creates a traceable **Raw Material Batch** per line item, initially `pending` QC.
- **Incoming QC** approves/rejects those batches. Approval posts the accepted quantity into the
  **Stock Register** ledger and makes that batch available for issue.
- **Material Issue** consumes from a specific approved raw material batch into a **Production Order**,
  recording exactly which batch fed which production run (this is the traceability link).
- **Production Planning** creates the Production Order/batch; **WIP Inventory** logs each operation's
  input/output/loss within it.
- **Sterilization** batches can combine multiple completed Production Orders into one EO cycle.
- **Final QC** reviews a completed sterilization cycle and either creates a **Finished Goods Batch**
  (approved) or logs to **Scrap Register** (rejected).
- **Packing** records packing of approved FG batches; **Finished Goods Inventory** shows live
  available/reserved/dispatched stock per batch.
- **Dispatch** ships from one or more FG batches against a customer invoice, decrementing stock.
- **Batch Traceability** lets you pick any FG batch and walk backward to the exact raw material
  lots and suppliers involved, or pick any raw material lot and walk forward to every dispatch
  it could have affected — this is what you'd use in an actual recall scenario.

## What's intentionally left for you to extend later

- Self-service password reset/change for non-admin users.
- Excel/PDF export buttons on the registers (your other apps already have a working pattern for
  this via SheetJS — happy to wire the same approach in here once the core is live and tested).
- Email/SMS notifications for reorder alerts, pending QC, near-expiry stock.
- A formal "current period vs previous period" comparison on the dashboards.

Let me know once you've got the Supabase project created and I can help with the next step,
or we can tackle any of the above extensions.
