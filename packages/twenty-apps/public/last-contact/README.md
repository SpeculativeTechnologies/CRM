# Last Contact

**Always know where every relationship stands — live on your People list, from synced email and calendar plus manually logged contact.**

## ✨ What you get

- **Live columns on People, Companies and Opportunities** — last contact, who reached out (you or them), the owning teammate, and the email, meeting, or contact log behind it
- **Automatic sync** — updates in real time from every synced email and meeting, with your full history backfilled the moment you install
- **Follow-ups made obvious** — sort by recency to catch cold relationships and see who owes whom a reply

## 📊 The columns

On **People** you get:
- **Last contact** — the most recent touch, either direction
- **Last outbound** / **Last inbound** — when you last reached out vs. when they last did
- **Last contact by** — the teammate connected to this person
- **Last contact item** / **Last email** / **Last meeting** — one click to the actual record
- **Contact logs** — dated LinkedIn messages, texts, phone calls, WhatsApp, Signal, in-person conversations, and other contact

On **Companies** and **Opportunities** you also get **Last contact** and **Last contact item** columns.

## Logging contact

Open a person and choose the **Log contact** tab beside **Home**, **Timeline**, and
**Tasks**. Select the channel, the date and time the contact happened, and whether you reached out, they reached out, or it was a
conversation. Add optional notes and choose **Save contact**. Dates use your local
timezone; the form rejects future contact dates. Saving clears the form and keeps
you on the person, ready to log another contact. **Clear** resets an unsaved entry.
The action is also available from the person's Actions menu.

The saved entry appears in **Contact logs** and in the person's **Contact logs**
relation. Open an entry there to edit its date, direction, notes, or person, or to
delete it. Last-contact fields update after the event is processed. An older entry
never replaces a newer interaction. Correcting, deleting, restoring, or moving an
entry recalculates both affected people's dates and their company/opportunity
rollups. Future-dated entries made through the generic editor/API are excluded
from the calculation; use contact logs for contact that has already happened.

Manual contact needs no synced inbox or calendar. Adding a LinkedIn URL or phone
number to a person does not count as contact. The app records interactions you log;
it does not sync LinkedIn or text messages. **Last contact by** uses the creator's
teammate identity when available; an app or API key does not identify a human
teammate. **I reached out** updates Last outbound, **They reached
out** updates Last inbound, and **Conversation** updates both.

## Logging contact through the API

After installing this version of the app, software can create the same records
through Twenty's REST API. Use a workspace API key whose role can create Contact
logs (and read People if the software needs to look up a person's ID):

```bash
curl "$TWENTY_API_URL/rest/contactLogs" \
  -H "Authorization: Bearer $TWENTY_API_KEY" \
  -H 'Content-Type: application/json' \
  --data '{
    "name": "LinkedIn message",
    "personId": "PERSON_UUID",
    "channel": "LINKEDIN",
    "direction": "OUTBOUND",
    "occurredAt": "2026-09-09T14:00:00Z",
    "notes": "Discussed next steps"
  }'
```

Use an actual Person ID and the time the contact happened, in ISO 8601 format with
a timezone. `notes` is optional. Channels are `LINKEDIN`, `TEXT`, `PHONE`,
`WHATSAPP`, `SIGNAL`, `IN_PERSON`, and `OTHER`. Directions are `OUTBOUND`, `INBOUND`,
and `BOTH` (a conversation).

The response includes the new record at `data.createContactLog`. Save its `id` to
correct or remove it later using `PATCH` or `DELETE` on `/rest/contactLogs/ID`.
Creation and corrections automatically queue last-contact recalculation, including
company and opportunity rollups; software does not need to update the Person's
Last contact field. Processing is asynchronous, and the most recent eligible
interaction wins. Retain the returned ID to avoid logging the same interaction
again when your software retries.

## 💳 Billing

**Free** — no credits, no metering.

## 📌 Heads up

Automatic email/calendar tracking needs a synced inbox or calendar (Google, Outlook, or CalDAV). Email direction is inferred from the sender; a meeting counts as both directions.

## Releasing this app

This is an independently installed Twenty app. Merging the source or deploying the
CRM image does not update an installed marketplace copy. Build version 1.3.0 with
`yarn twenty dev:build --tarball`, then have the release owner publish the reviewed
app to the intended server and upgrade the workspace's existing Last contact app.
Do not uninstall/reinstall the app to upgrade it: that can remove app-owned data.

After installing or upgrading the app, configure the Person tab once per workspace.
From this app's source directory, set `TWENTY_API_URL` and `TWENTY_API_KEY` for the
target workspace, using a key with layout editing permissions, then run:

```bash
yarn configure:person-tab          # Preview; does not change the workspace
yarn configure:person-tab --apply  # Add the tab and its contact form
```

This source-only setup command adds a workspace-custom tab through the layout API
and preserves the existing Person layout, including older layouts with different
identifiers. The form itself belongs to the Last contact app. Repeating setup
leaves an existing form tab unchanged and resumes an interrupted setup if its tab
is still empty. It stops without changes if the Person layout is ambiguous or an
unrelated populated tab already uses the same name. It does not change shared CRM
migration behavior. Removing the tab in the layout editor does not delete logs.

The app manifest adds the Contact log object, its fields/view/action, and a new
Last contact item relation on People, Companies, and Opportunities. These schema
changes are applied by the app upgrade; no core entity or instance command changes
are needed. Verify both upgrading 1.2.4 with existing contact values and a clean
install, including saving from the form with the restricted app role. The form
uses the app's token, so this role grants read/write access to Contact logs while
keeping synced email and calendar source records read-only. Test against
a development mirror before promotion; capture UI evidence only with fixture data.

To roll back after contact logs have been entered, retain the new schema and logs
and publish a higher-version corrective build that hides the action or repairs the
handlers. A CRM image rollback does not roll back this app, and downgrading or
uninstalling it risks losing the logs. Back up before any destructive app removal.
