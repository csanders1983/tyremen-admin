# Simplified Sales & Invoices

This is an Admin-only update on `codex/marketing-centre`. No backend, database rules or public website deployment is needed.

## Install

From Windows CMD, check `git status` first. Save any local changes before pulling; do not reset/discard them.

```bat
cd /d C:\Users\chris\tyremen-admin
git pull --ff-only
node --test scripts/test-sale-flow.mjs
npm run build
firebase deploy --only hosting:admin --project tyremen-system
```

If you are on a different branch, switch to `codex/marketing-centre` before pulling. This update adds no dependencies. Hard-refresh Admin with Ctrl+F5 after hosting reports Deploy complete.

For a local preview before deployment, run `firebase emulators:start --only hosting --project tyremen-system` after building, and open the local address it prints. Sign in using your normal active Admin account. This is a local preview of the real Admin connected to the live backend: completing a sale, recording payment or sending email is a real action. Merely viewing screens does not create a sale. Press Ctrl+C to stop the local hosting emulator before deploying.

## The shorter sale flow

1. **Vehicle & customer:** find a registration or use the saved vehicle, then choose an existing customer or enter their name/contact details. Additional vehicle information, history, addresses and account fields expand when needed. Document type, adviser, channel, purchase order and private notes are under Sale options. Invoice/Workshop/logged-in adviser remain the defaults.
2. **Items & technician:** search Tyremen stock, partner tyres and services, or add a manual line. Quantity, unit price and line total stay visible. Expand Line options for stock number, type, discount and VAT. Tyre extras are grouped under the tyre for easy review/edit/removal. Existing price-level and tyre-extra rules are preserved. Choose wheel positions and up to four technicians. Work grouping and advisory notes remain available.
3. **Review & payment:** check the complete item list, record payment/deposit where applicable, then create the document. Quotes have no payment entry. Print/PDF and email actions become available on the created document.

The current-sale total stays visible on desktop and is below the form on smaller screens. Moving between steps keeps the in-memory draft; refreshing/closing the page still loses an unsaved draft, as before.

## Finding and using invoices

A searchable table has document-type and status filters. Search covers number, customer name/email/phones/account/postcode, registration, date and status. Initially 100 matching rows are rendered, with Show 100 more; searching still considers all loaded documents. Selecting a document opens its items, print/PDF/email, payment and conversion controls together. Payment history expands when needed. Quotes/orders still convert through the existing secure backend; issued invoices and history are not deleted or unlocked.

The vehicle lookup now handles both flat and wrapped successful responses. Changing the registration clears the previous vehicle's specification so it must be verified or entered again. Optional customer fields remain optional; registration/make/model/customer name/items/technicians and applicable wheel positions remain required.

## Validation

- Clean production build.
- Three focused sale-step checks: required details, fractional labour quantities, valid pricing, technician selection and distinct wheel positions.
- Twelve responsive screen checks across 1440/1024/390px.
- Browser flows with mocked delivery/backend: flat VRM lookup, saved customer, tyre quantities and extras, Xtra price level, mandatory positions, paid invoice payload, existing invoice payment, and quote with no payment.
- Existing invoice functions, template snapshots, VAT calculations and user permissions remain in place. No real sale/payment/email was made during development.
