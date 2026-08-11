# Fundraising Opportunities configuration

This custom object tracks potential sources of capital without
repurposing or changing Twenty's existing Opportunities object. It uses the
existing object as a design reference for a compact pipeline: an accountable
owner, a funder and contact, stage, amount, timing, and task-based follow-up.

## Implementation status

The object and the fields in this brief are active in the live CRM. Fundraising
Opportunity Tags was added through the metadata API on 2026-08-11. No
Fundraising Opportunity records were created or migrated as part of this
guidance update.

## Record grain

Create one Fundraising Opportunity for each funder, funding initiative, and
application or deal cycle. A funder can therefore have separate records for
different rounds, grant programs, or later attempts.

A record may involve an organization, an individual funder, or both. At least
one of Funder Organization and Funder Contact must be populated. Twenty cannot
express that either/or rule as a field-level requirement, so it should be
enforced through operating guidance or a future workflow.

## Object settings

| Setting        | Value                                                            |
| -------------- | ---------------------------------------------------------------- |
| Singular label | Fundraising Opportunity                                          |
| Plural label   | Fundraising Opportunities                                        |
| Internal name  | `fundraisingOpportunity`                                         |
| Record label   | `{Funding Initiative} - {Funder Organization or Funder Contact}` |

## Fields

| Field                        | Type                         | Required | Notes                                                                                                                              |
| ---------------------------- | ---------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Fundraising Opportunity      | Text, primary                | Yes      | Human-readable record label, populated during import or creation.                                                                  |
| Funding Initiative           | Select                       | Yes      | The round, campaign, grant program, or other fundraising effort this record belongs to. Use the canonical options described below. |
| Funder Organization          | Relation to Company          | No       | Canonical organization supplying or administering the potential funding.                                                           |
| Funder Contact               | Relation to Person           | No       | Primary canonical contact, or the funder when the source is an individual.                                                         |
| Funding Type                 | Select                       | Yes      | `Equity Investment`, `Grant`, `Debt`, `Sponsorship`, `Prize`, or `Other`.                                                          |
| Fundraising Stage            | Select                       | Yes      | Use the canonical pipeline options listed below.                                                                                   |
| Fundraising Opportunity Tags | Multi-select                 | No       | Preserve group-scoped tags from the Folk fundraising source. Keep them separate from Person, Company, and other pipeline tags.     |
| Amount Sought                | Currency                     | No       | Amount requested from this funder, not the target for the entire initiative.                                                       |
| Amount Committed             | Currency                     | No       | Amount the funder has formally committed. Leave empty until a commitment exists.                                                   |
| Deadline                     | Date                         | No       | Application deadline or date by which materials must be submitted.                                                                 |
| Expected Close Date          | Date                         | No       | Expected decision, award, or transaction close date.                                                                               |
| Owner                        | Relation to Workspace Member | No       | Team member accountable for the Fundraising Opportunity.                                                                           |
| Introduced By                | Relation to Person           | No       | Canonical Person who made or can make the introduction.                                                                            |
| Source URL                   | Link                         | No       | Canonical page for the grant, program, fund, or application portal.                                                                |

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

Canonical Funding Initiative options active in the live CRM:

- VN
- Brains
- 21st Century Fund

Each option identifies one team-wide fundraising effort. Add future initiatives
to this select rather than creating initiative-specific fields or allowing
free-text variations.

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

## Folk migration rules

- Use the Folk `Brains Fundraising` group as a known source for the `Brains`
  Funding Initiative. Do not assume that it is also the source for `VN` or
  `21st Century Fund`; identify those source groups before migration.
- A Folk group membership is source context, not by itself proof of a distinct
  funding cycle. Create a Fundraising Opportunity only after identifying the
  funder, initiative, and application or deal cycle described by the row.
- Copy the source entry's group-scoped tags to Fundraising Opportunity Tags.
  Do not copy them to Person or Company and do not reuse tag options from other
  Folk groups.
- The live Fundraising Opportunity Tags field is seeded with `Needs Review`
  because Twenty requires at least one multi-select option. Before migration,
  add the distinct tags from each confirmed fundraising source group. Namespace
  options by Funding Initiative or source group when more than one group feeds
  this object, so an identical label does not lose its group-specific meaning.
  Leave the field blank when the source has no tags; do not collapse all tags
  into `Needs Review`.
- The current Folk API token and signed-in browser account could see the
  `Brains Fundraising` group name but were not authorized to read its fields on
  2026-08-11. An authorized migration operator must inspect the current group
  schema before defining any other field mapping.

## Open follow-ups

- Identify the Folk sources for VN and 21st Century Fund.
- Recheck the Brains Fundraising field and tag vocabularies with an account that
  has access before migration.
- Decide whether the either/or funder rule needs workflow validation.

## Relationship to existing Opportunities

Fundraising Opportunities intentionally reuse the compact pipeline shape of
Twenty's existing Opportunities object, but they represent a different process
and must remain a separate object.

| Concept             | Existing Opportunities            | Fundraising Opportunities                                                 |
| ------------------- | --------------------------------- | ------------------------------------------------------------------------- |
| Purpose             | Commercial or customer pipeline   | Capital, grants, sponsorships, prizes, and other funding                  |
| Record grain        | One commercial deal               | One funder, Funding Initiative, and application or deal cycle             |
| Pipeline            | Generic stages ending in Customer | Fundraising stages distinguishing Committed, Funded, Passed, and Declined |
| Money               | One Amount                        | Amount Sought and Amount Committed                                        |
| Initiative grouping | None                              | Required canonical Funding Initiative select                              |

Both objects need an owner, stage, amount, timing, organization or contact, and
task-based follow-up because both are pipelines. The separate object prevents
fundraising records from distorting the existing sales board, pipeline totals,
and reporting. It also avoids forcing fundraising concepts into sales fields:
`Customer` is not a fundraising outcome, committed funding may not yet be
received, and the amount requested may differ from the amount committed.
