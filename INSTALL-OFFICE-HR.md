# Tyremen templates, test sends and HR

This update adds a separate `officefunctions` codebase and a private named Firestore database, `tyremen-hr`. It uses the working Gmail and Webex secrets. Existing website lookup, pricing and booking endpoints stay in their existing codebases. Do not deploy all functions or change the public website hosting for this installation.

## 1. Get the update and check it

On the PC with your working Tyremen repositories, first check `git status` in each folder. If there are local changes, save/commit them before pulling. Do not reset or discard them.

System (Windows CMD):

```bat
cd /d C:\Users\chris\tyremen-system
git switch codex/restore-pre-tuesday-website
git pull --ff-only
cd officefunctions
npm ci
npm test
cd ..\adminfunctions
npm ci
node --test test/*.test.js
cd ..\marketingfunctions
npm ci
npm test
cd ..
```

The office tests never send real email or texts. Normal HR messages and website confirmations start disabled.

## 2. Create the private HR database once

```bat
firebase login --reauth
firebase firestore:databases:create tyremen-hr --location=eur3 --project tyremen-system
firebase deploy --config officefunctions/firebase.hr.json --only firestore --project tyremen-system
```

If `tyremen-hr` already exists, do not recreate it: run only the rules deploy. The supplied rules deny every browser read and write to this named database. Authenticated office functions provide access. This config targets **only `tyremen-hr`**, not the default live database. Do not copy this deny-all rules file over the default database's rules.

The function runtime service account needs Firestore data access on this database (normally inherited project-level `roles/datastore.user`, as on the existing functions). If access is denied, check IAM rather than opening browser rules. Named databases and scheduled functions incur Google Cloud usage charges.

## 3. Add the office owner IDs

Find Chris's Firebase Authentication user UID in Firebase Console → Authentication → Users. This is a user ID, not an email/password. Add Sarah's UID only if she should have full Owner access; otherwise grant holiday approver access inside HR later.

```bat
firebase functions:secrets:set TYREMEN_OFFICE_CONFIG --project tyremen-system
```

At the hidden prompt enter this JSON, replacing the example value:

```json
{"ownerUids":["CHRIS_FIREBASE_AUTH_UID"]}
```

The existing `GMAIL_USER`, `GMAIL_APP_PASSWORD` and `WEBEX_INTERACT_TOKEN` are reused. Do not put passwords or API tokens in React source or commit them to Git. Changing a secret later requires redeploying the office codebase.

## 4. Deploy the backend

```bat
set FUNCTIONS_DISCOVERY_TIMEOUT=60
firebase deploy --only functions:officefunctions --project tyremen-system
firebase deploy --only functions:adminfunctions:createAdminInvoice,functions:adminfunctions:convertAdminDocument,functions:adminfunctions:emailAdminInvoice,functions:adminfunctions:createTyreForemanInvoice,functions:adminfunctions:emailTyreForemanInvoice --project tyremen-system
firebase deploy --only functions:marketingfunctions:marketingAdmin,functions:marketingfunctions:runMarketingAutomation --project tyremen-system
```

The invoice functions freeze a template snapshot when a new document is created. Converting an order/quote creates its invoice with the current invoice template. Reprints of documents with a snapshot use that saved design; older documents without one retain their existing print/PDF renderer. No invoice amount, VAT or tyre pricing formula is changed by this update.

Marketing's scheduled worker also needs deploying because archived queued messages must wait until restored and offers now have channel selections. Existing secret configuration remains unchanged.

## 5. Build and deploy Admin

```bat
cd /d C:\Users\chris\tyremen-admin
git switch codex/marketing-centre
git pull --ff-only
npm ci
node --test scripts/test-office.mjs scripts/test-marketing.mjs
npm run build
firebase deploy --only hosting:admin --project tyremen-system
```

Open Admin and hard-refresh. New sections: **People & HR**, **Document templates**, and **My staff portal**. `https://tyremen-admin.web.app/staff` is the staff portal. Staff can add it to their phone's home screen; it uses a dedicated web-app manifest. Confidential data is not cached for offline use.

## 6. Configure before using live data

1. **Document templates:** preview each type, upload logo if required, check company/VAT details, save. Test print/PDF and send a test email to your own address. One previous edit can be reverted. All prior template versions remain searchable under Include archived and can be loaded into the editor and republished. Website confirmations are off until explicitly enabled and published. They apply to new Website-source workshop bookings; they do not replay existing bookings.
2. **Marketing:** use Test send on a reminder contact, the test buttons beside templates, the campaign composer or offer editor. Enter your own mobile/email. SMS/email tests are real sends and may cost provider credits. Letter tests create a PDF and do not post a letter. They do not consume the customer's reminder cycle.
3. **HR people:** enter each employee's DOB, start date, working pattern, Saturday cycle, pay details and emergency contacts. Review imported work patterns. Blank working-day start/end means off. CSV imports require ISO dates `YYYY-MM-DD`; a review shows skipped/invalid rows. Link staff logins using their unique email; staff set their password using Forgot password on the login screen.
4. **HR access:** Sarah needs an existing Firebase login. In HR settings grant her **Holiday approver only**, then select her in Leave approver logins and save policy. HR administrator access also exposes confidential employee/pay records. Workshop/foreman roles alone never grant private HR API access.
5. **Holidays:** Jan 1–Dec 31; 28 days includes bank holidays for five-day regular workers, prorated in hours for part-time patterns/joiners/leavers. Review bank-holiday closures and department limits. Extra entitlement, carry-over and TOIL are explicit adjustments with reasons. Irregular hours accrue 12.07% from approved timesheets, rounded to a whole hour per period. Do not also add the same accrual manually. Statutory sickness/family-leave carry-over exceptions require HR review and explicit adjustments; they are not guessed.
6. **Staff notices:** select HR-authorised employee records as HR notification recipients. Their logins must be linked and have HR/approver authority. Both a valid mobile and email are needed for automatic dual-channel notices. Enable messages only after those details and individual working hours are checked. Leave request/decision notifications and wage-review notices are queued. Each employee's local working hours, bank holidays and approved absence are rechecked at send time. Out-of-hours immediate sending requires Owner password reauthentication and lasts only for that explicit request. Expired overrides are not reused by the scheduler.
7. **Payroll preparation:** enter actual hours, correct period dates, tax code, NI category, pension method and YTD values. The calculator is an estimate for the accountant, not payroll approval, HMRC RTI submission or a statutory payslip. Supported rates are 2026/27 for England, Wales and Northern Ireland. Scottish PAYE codes and unsupported categories require accountant calculation. Directors' NI is flagged for accountant review. Normal holiday pay may require regular overtime/commission or a paid-week average; enter the accountant-confirmed holiday rate. Saved packs are retained and exported as CSV for the accountant. Confirm statutory leave/pay, refunds, pension eligibility, rounding and all deductions before payment.

## Search, archive and restore

Every new HR list, document version history and Marketing library has search. Include archived shows retained records and Restore makes them active again. There is no automatic purge/TTL. Audits and issued financial snapshots are retained. Archiving approved leave, a timesheet, TOIL/accrual or payroll pack **does not reverse it**; cancel leave or add a reasoned balance correction explicitly. Archiving a queued HR/Marketing message pauses its delivery; restoration lets normal eligibility checks run again. Restored offers/campaigns remain paused until deliberately enabled. Employee archiving prevents new staff access and messages; restore re-enables an otherwise valid linked login.

HR has no hard-delete endpoint. Existing explicit Marketing contact erasure remains a separate owner-only action; archived contacts must be restored before choosing it, and no-contact tombstones are retained. Archive is never treated as erasure.

Private HR files up to 5 MB are stored in chunks within the named database, with hash/version metadata and immutable acknowledgements for that version. Upload a new handbook version; do not replace an acknowledged file. HR record history and all exports contain personal information: share only with authorised staff/accountant.

## Validation for this release

- Backend tests cover access separation, employee archive/restore, holiday balance retention, part-time/bank-holiday calculations, concurrent capacity decisions, timesheet accrual, working-hours messages, recent-password overrides, ambiguous provider outcomes, template versions, email idempotence and invoice snapshot freezing.
- Admin production build; responsive browser checks cover HR, staff portal and document templates plus existing Marketing tabs.
- PDF samples checked for normal and multi-page invoices.
- No real customer/employee messages sent during development. This installation does not deploy public Tyremen hosting or Very Cheap Tyres.

Official reference points: [holiday entitlement](https://www.gov.uk/holiday-entitlement-rights), [2026/27 employer rates](https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027), [minimum wage rates](https://www.gov.uk/national-minimum-wage-rates), [bank holidays](https://www.gov.uk/bank-holidays), [Firebase named database rules](https://firebase.google.com/docs/firestore/security/get-started).

Initial list bounds: HR loads up to 5,000 records per collection, template history/deliveries up to 1,001, Marketing up to 5,000 contacts and 10,000 messages. Records beyond a list bound are retained; indexed server pagination is needed before operating beyond those bounds. Files are capped at 5 MB per HR upload. There is no automatic deletion.
