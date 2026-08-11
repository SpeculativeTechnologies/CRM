# Fundraising Opportunities configuration

This proposed custom object tracks potential sources of capital without
repurposing or changing Twenty's existing Opportunities object. It uses the
existing object as a design reference for a compact pipeline: an accountable
owner, a funder and contact, stage, amount, timing, and task-based follow-up.

This document is a configuration brief only. Do not create the object, fields,
views, or records, and do not migrate any data as part of this proposal.

## Record grain

Create one Fundraising Opportunity for each funder, funding initiative, and
application or deal cycle. A funder can therefore have separate records for
different rounds, grant programs, or later attempts.

A record may involve an organization, an individual funder, or both. At least
one of Funder Organization and Funder Contact must be populated. Twenty cannot
express that either/or rule as a field-level requirement, so it should be
enforced through operating guidance or a future workflow.

## Object settings

| Setting | Value |
| --- | --- |
| Singular label | Fundraising Opportunity |
| Plural label | Fundraising Opportunities |
| Internal name | `fundraisingOpportunity` |
| Record label | `{Funding Initiative} - {Funder Organization or Funder Contact}` |

## Fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| Fundraising Opportunity | Text, primary | Yes | Human-readable record label, populated during import or creation. |
| Funding Initiative | Select | Yes | The round, campaign, grant program, or other fundraising effort this record belongs to. Use the canonical options described below. |
| Funder Organization | Relation to Company | No | Canonical organization supplying or administering the potential funding. |
| Funder Contact | Relation to Person | No | Primary canonical contact, or the funder when the source is an individual. |
| Funding Type | Select | Yes | `Equity Investment`, `Grant`, `Debt`, `Sponsorship`, `Prize`, or `Other`. |
| Fundraising Stage | Select | Yes | Use the canonical pipeline options listed below. |
| Amount Sought | Currency | No | Amount requested from this funder, not the target for the entire initiative. |
| Amount Committed | Currency | No | Amount the funder has formally committed. Leave empty until a commitment exists. |
| Deadline | Date | No | Application deadline or date by which materials must be submitted. |
| Expected Close Date | Date | No | Expected decision, award, or transaction close date. |
| Owner | Relation to Workspace Member | No | Team member accountable for the Fundraising Opportunity. |
| Introduced By | Relation to Person | No | Canonical Person who made or can make the introduction. |
| Source URL | Link | No | Canonical page for the grant, program, fund, or application portal. |

Canonical Fundraising Stage options:

- Researching
- Intro Needed
- Contacted
- Meeting
- Application / Diligence
- Decision Pending
- Committed
- Funded
- Passed
- Declined

Canonical Funding Initiative options must be agreed before implementation.
Each option should identify one team-wide fundraising effort, such as a
specific round or grant campaign. Add future initiatives to this select rather
than creating initiative-specific fields or allowing free-text variations.

Use `Committed` when funding has been promised but not received and `Funded`
when the transaction or award is complete. Use `Passed` when the team chooses
not to proceed and `Declined` when the funder declines.

## Tasks and activity

Use Twenty's automatically created Tasks relation; do not define a custom Next
Step or Tasks field. Tasks should represent concrete actions such as requesting
an introduction, preparing an application, sending diligence materials, or
following up after a meeting. Each task retains its own due date, status,
assignee, and notes while the Fundraising Opportunity Owner remains accountable
for the overall record.

Use Notes, Attachments, and Timeline activity for qualitative context and
supporting materials rather than creating long-form status fields.

## Suggested views

- Active Pipeline, as a Kanban grouped by Fundraising Stage with Amount Sought
  summed by column
- Intro Needed
- Upcoming Deadlines
- Decision Pending
- Committed and Funded
- Closed, covering Passed and Declined records

## Explicit exclusions

- Do not rename, modify, delete, or migrate records from the existing
  Opportunities object.
- Do not add a relation between Fundraising Opportunities and Opportunities in
  this proposal.
- Do not store a generic Next Step field; use Tasks.
- Do not add a Probability field. Stage and actual committed amount are the
  source of pipeline status.
- Keep personal profile details on Person and organization details on Company.
- Do not create initiative-specific fields. Different rounds, programs, or
  attempts should produce separate Fundraising Opportunity records.
- Do not create the object, fields, views, workflows, or records until this
  configuration brief is approved.

## Decisions before implementation

- Confirm that the Funding Type and Fundraising Stage option sets match the
  team's working vocabulary.
- Define the initial canonical Funding Initiative select options.
- Identify any source system and mapping rules before designing a migration.
- Decide whether the either/or funder rule needs a workflow validation after
  the object is created.

## Relationship to existing Opportunities

Fundraising Opportunities intentionally reuse the compact pipeline shape of
Twenty's existing Opportunities object, but they represent a different process
and must remain a separate object.

| Concept | Existing Opportunities | Fundraising Opportunities |
| --- | --- | --- |
| Purpose | Commercial or customer pipeline | Capital, grants, sponsorships, prizes, and other funding |
| Record grain | One commercial deal | One funder, Funding Initiative, and application or deal cycle |
| Pipeline | Generic stages ending in Customer | Fundraising stages distinguishing Committed, Funded, Passed, and Declined |
| Money | One Amount | Amount Sought and Amount Committed |
| Initiative grouping | None | Required canonical Funding Initiative select |

Both objects need an owner, stage, amount, timing, organization or contact, and
task-based follow-up because both are pipelines. The separate object prevents
fundraising records from distorting the existing sales board, pipeline totals,
and reporting. It also avoids forcing fundraising concepts into sales fields:
`Customer` is not a fundraising outcome, committed funding may not yet be
received, and the amount requested may differ from the amount committed.
