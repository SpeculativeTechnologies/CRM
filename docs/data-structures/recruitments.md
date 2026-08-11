# Recruitments configuration

This custom object turns the
[Folk Brain Prospects group](https://app.folk.app/apps/contacts/network/24d60e04-e2a1-46a0-8f18-6b8f7711ab01/groups/73f72ed0-d7dc-4a47-a1fb-13eb503d0854/view/77dcccea-d728-4439-8ee6-ffd4622271c9)
into repeatable recruitment records linked to canonical People.

## Implementation status

The object and the fields in this brief are active in the live CRM. Recruitment
Tags was added through the metadata API on 2026-08-11. No Recruitment records
were created or migrated as part of this guidance update.

## Record grain

Create one Recruitment record per Person, Cohort, and Role. This allows the
same Person to participate in multiple cohorts and, when necessary, to be both
a Prospect and a Connector in one cohort.

## Object settings

| Setting        | Value                          |
| -------------- | ------------------------------ |
| Singular label | Recruitment                    |
| Plural label   | Recruitments                   |
| Internal name  | `recruitment`                  |
| Record label   | `{Cohort} - {Role} - {Person}` |

## Fields

| Field                | Type                         | Required | Notes                                                                                                                                                 |
| -------------------- | ---------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recruitment          | Text, primary                | Yes      | Human-readable record label, populated during import or creation.                                                                                     |
| Person               | Relation to Person           | Yes      | The canonical CRM contact.                                                                                                                            |
| Cohort               | Select                       | Yes      | Use the same canonical options as Mentorships.                                                                                                        |
| Role                 | Select                       | Yes      | `Prospect` or `Connector`.                                                                                                                            |
| Recruiting Stage     | Select                       | No       | `Possibility`, `Remind to apply`, `Applied`, `Pass`, or `Not now`.                                                                                    |
| Recruitment Tags     | Multi-select                 | No       | Preserve tags from the Folk Brains Prospects group. Do not use Tags to infer cohort or Role.                                                          |
| Application Status   | Select                       | No       | `To be reviewed`, `First interview`, `Second interview`, `Finalist`, `Waitlist`, `Selected`, `Confirmed`, `Rejected`, `Not qualified`, or `Withdrew`. |
| Recruiting Meetings  | Number                       | No       | Count of recruiting meetings for this Recruitment.                                                                                                    |
| Owner                | Relation to Workspace Member | No       | Person accountable for the Recruitment record.                                                                                                        |
| Recommended By       | Relation to Person           | No       | Canonical Person who made the recommendation.                                                                                                         |
| Folk Recruitment Key | Text, unique                 | No       | Hidden migration/upsert key: `folk:{personId}:{cohort}:{role}`.                                                                                       |

## Tasks

Use Twenty's automatically created Tasks relation; do not define a custom Tasks
field. Tasks represent concrete next actions and carry their own due date,
status, assignee, and notes. The Recruitment Owner remains accountable for the
record even when an individual task has another assignee.

During migration from Folk:

- Convert `Next Step` into the task title.
- Convert `Next Step Details` into the task description.
- Convert `Assign` into the task assignee where possible.
- Target the task to the relevant Recruitment record.

## Folk migration rules

- Use the Folk `Brains Prospects` group as the source. Its current schema has
  separate cohort pipeline and application columns, including:
  - `Brains Pipeline 2023`
  - `Brains Pipeline 2024`
  - `2026 Brains Cohort 3 Pipeline`
  - `2027 Brains Cohort 4 Pipeline`
  - `AI Brains Pipeline`
  - cohort application-status fields, recruiting-meeting counts, and `Tags`
- Treat a nonblank value in `2027 Brains Cohort 4 Pipeline` as evidence that the
  person is affiliated with Brains Cohort 4. Do not use membership in the
  broader Brains Prospects group by itself to assign a cohort.
- For `2027 Brains Cohort 4 Pipeline`, map `Connector` to Role = `Connector`
  and leave Recruiting Stage blank unless another authoritative source gives a
  stage. Map `Possibility`, `Remind to apply`, `Pass`, `Not Now`, and `Applied`
  to Role = `Prospect` and the corresponding normalized Recruiting Stage.
- Do not use a `Connector` value in Folk Tags to override the cohort pipeline.
  The cohort pipeline is the authoritative source for distinguishing Connector
  from Prospect.
- Apply the same nonblank cohort-column principle to older cohort pipelines and
  application columns. Convert each historical cohort into a separate
  Recruitment rather than creating cohort-specific fields in Twenty.
- Historical pipeline vocabularies contain values that do not map one-to-one to
  the current five Recruiting Stages. Preserve the source value for review and
  use an explicit mapping; do not guess from a similarly worded value.
- Hold unexpected Cohort 4 pipeline values for review. The live Folk option list
  contained a stray URL-like value when checked on 2026-08-11; it is not a
  cohort, Role, or Recruiting Stage.
- Keep profile information such as email, citizenship, gender, education,
  description, and companies on Person.
- Copy the source entry's group-scoped `Tags` values to Recruitment Tags. Keep
  that vocabulary separate from tags on every other CRM object.
- The live Recruitment Tags field is seeded with `Needs Review` because Twenty
  requires at least one multi-select option. Before migration, add the distinct
  Brains Prospects tag values to the field. Leave it blank when the source has
  no tags; do not collapse all tags into `Needs Review`.
- Do not migrate group membership, scheduling status, or temporary outreach
  columns into Recruitment fields.

## Suggested views

- Current Cohort Prospects
- Current Cohort Connectors
- Applicants
- Needs Follow-up, based on open Tasks
- Past Recruitments
