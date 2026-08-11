# Recruitments configuration

This custom object turns the
[Folk Brain Prospects group](https://app.folk.app/apps/contacts/network/24d60e04-e2a1-46a0-8f18-6b8f7711ab01/groups/73f72ed0-d7dc-4a47-a1fb-13eb503d0854/view/77dcccea-d728-4439-8ee6-ffd4622271c9)
into repeatable recruitment records linked to canonical People.

## Record grain

Create one Recruitment record per Person, Cohort, and Role. This allows the
same Person to participate in multiple cohorts and, when necessary, to be both
a Prospect and a Connector in one cohort.

## Object settings

| Setting | Value |
| --- | --- |
| Singular label | Recruitment |
| Plural label | Recruitments |
| Internal name | `recruitment` |
| Record label | `{Cohort} - {Role} - {Person}` |

## Fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| Recruitment | Text, primary | Yes | Human-readable record label, populated during import or creation. |
| Person | Relation to Person | Yes | The canonical CRM contact. |
| Cohort | Select | Yes | Use the same canonical options as Mentorships. |
| Role | Select | Yes | `Prospect` or `Connector`. |
| Recruiting Stage | Select | No | `Possibility`, `Remind to apply`, `Applied`, `Pass`, or `Not now`. |
| Application Status | Select | No | `To be reviewed`, `First interview`, `Second interview`, `Finalist`, `Waitlist`, `Selected`, `Confirmed`, `Rejected`, `Not qualified`, or `Withdrew`. |
| Recruiting Meetings | Number | No | Count of recruiting meetings for this Recruitment. |
| Owner | Relation to Workspace Member | No | Person accountable for the Recruitment record. |
| Recommended By | Relation to Person | No | Canonical Person who made the recommendation. |
| Folk Recruitment Key | Text, unique | No | Hidden migration/upsert key: `folk:{personId}:{cohort}:{role}`. |

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

- Map the Folk pipeline value `Connector` to Role = `Connector`, leaving
  Recruiting Stage empty unless another stage is known.
- Map all other pipeline values to Role = `Prospect` and the corresponding
  Recruiting Stage.
- Convert historical cohort-specific pipeline and application columns into
  separate Recruitment records rather than separate fields.
- Keep profile information such as email, citizenship, gender, education,
  description, and companies on Person.
- Do not migrate generic tags, groups, scheduling status, or temporary outreach
  columns into Recruitment fields.

## Suggested views

- Current Cohort Prospects
- Current Cohort Connectors
- Applicants
- Needs Follow-up, based on open Tasks
- Past Recruitments
