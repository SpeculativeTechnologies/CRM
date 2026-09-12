# SpecTech interaction metrics sync

This tool owns two custom Person fields without changing Twenty's Last Contact
application:

- **Interaction count**: unique synced emails plus completed, non-canceled meetings.
- **Strongest connection**: the workspace member involved in the most of those
  interactions. Ties go to the most recent interaction, then a stable member ID.

It reads only IDs, timestamps, cancellation state and participant relationships
through Twenty's GraphQL API. It never reads message bodies, subjects, contact
names or notes.

The default is a dry run over people whose participant records changed in the
last 26 hours:

```powershell
python deploy/interaction-metrics/sync_interaction_metrics.py
```

Provision the fields and perform the first complete historical sync:

```powershell
python deploy/interaction-metrics/sync_interaction_metrics.py --provision --all --apply
```

Required environment variables:

- `TWENTY_API_URL` (the `/graphql` endpoint)
- `TWENTY_API_KEY`
- `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` when Cloudflare Access is
  in front of the API

The GitHub workflow supports manual staging/production runs. Scheduled runs are
off until the repository variable `INTERACTION_METRICS_SYNC_ENABLED` is set to
`true`; daily runs use a 26-hour overlap and a weekly run reconciles every Person.
Store credentials in the corresponding protected GitHub environment and validate
the complete sync on staging before enabling production scheduling.
