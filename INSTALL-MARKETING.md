# Marketing workspace

This adds one navigation item and the `/marketing` page. It preserves existing sales, workshop, pricing and booking screens. Only three existing integration files change: `src/App.js`, `src/components/AdminLayout.js` and `src/auth/AuthContext.js`.

Deploy the companion `marketingfunctions` codebase in `csanders1983/tyremen-system` first. Its README covers indexes, existing Gmail/Webex secrets, the new `TYREMEN_MARKETING_CONNECTIONS` secret, privacy rules and Buffer connection. Automation is paused by default. No public website deployment is required.

From the Admin checkout containing `package.json` and `firebase.json`:

```bat
cd /d C:\Users\chris\tyremen-admin
node --test scripts/test-marketing.mjs
npm run build
firebase deploy --only hosting:admin --project tyremen-system
```

If your actual checkout is `C:\Users\chris\tyremen-admin\tyremen-admin`, use that folder. Do not run the Admin deployment from `tyremen-system`.

Open Marketing as owner. Owners/managers have access; other active logins require the owner’s Marketing access grant. Configure staff responsibility, templates, sender and sending limits. Validate using your own contact before enabling automation. Imported records require a separately recorded digital permission source; reimport preserves opt-outs.

Nine tabs: Overview, MOT reminders, Letters, Campaigns, Business insights, Social studio, Offers, Archives & opt-outs, Settings. Templates can be downloaded in the import dialog. SMS segment counts and example emails can be previewed before sending.

Social drafts and artwork do not require a provider connection. Publishing/scheduling needs a connected Buffer account/API key and the relevant Facebook/TikTok/X channel. No social account or paid subscription has been created. Video planning and public media URLs are supported; this is not a full video editing/hosting application. Letter PDFs/mail-house CSVs are created locally through the backend; physical posting requires your mailing provider.

Validation: clean production build; four CSV helper tests; 27 responsive browser tab checks (desktop/tablet/phone) and contact/import/preview/letter/campaign/offer/report flows against a local backend double. External sends and publishing were not performed. The companion backend has 31 passing tests.
