# Job Candidacies configuration

This custom object represents a Person's candidacy for a specific
role at Spectech. It tracks the hiring process and outcome without duplicating
the Person's canonical CRM profile.

## Implementation status

Implemented in the live CRM through the metadata API on 2026-08-11. The object,
specified fields, reciprocal relations, and Twenty's default table and record
page views are active. The Source Candidacy Key is active for API imports but
hidden in both default views.

No Job Candidacy records were created or migrated. The existing Candidates
object was not renamed, modified, deleted, or migrated.

## Record grain

Create one Job Candidacy for each Candidate, Role, and hiring cycle. The same
Person can therefore be considered for more than one role, or for the same role
in a later hiring cycle, without creating duplicate Person records.

All Job Candidacies represent roles at Spectech, so the object does not need a
Hiring Organization relation.

## Object settings

| Setting | Value |
| --- | --- |
| Singular label | Job Candidacy |
| Plural label | Job Candidacies |
| Internal name | `jobCandidacy` |
| Record label | `{Candidate} - {Role Title}` |

## Fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| Job Candidacy | Text, primary | Yes | Human-readable record label, populated during import or creation. |
| Candidate | Relation to Person | Yes | The canonical CRM contact pursuing or being considered for the role. |
| Role Title | Text | Yes | Title of the specific Spectech position. |
| Candidacy Stage | Select | Yes | Use the canonical pipeline options listed below. |
| Owner | Relation to Workspace Member | No | Team member accountable for the Job Candidacy record. |
| Job Posting URL | Link | No | Canonical posting or application page for the role. |
| Referred By | Relation to Person | No | Canonical Person who referred the Candidate. |
| Application Date | Date | No | Date the Candidate formally applied. |
| Source | Select | No | `Direct`, `Referral`, `Recruiter`, `Job Board`, `Internal`, or `Other`. |
| Source Candidacy Key | Text, unique | No | Hidden migration/upsert key. Define its format after the source system is identified. |

Canonical Candidacy Stage options:

- Sourced
- Contacted
- Applied
- Screening
- Interviewing
- Finalist
- Offer
- Accepted
- Rejected
- Withdrawn
- On Hold

Use `Accepted` when the Candidate has accepted an offer. Creating an Employment
History record should remain a separate action performed when employment
begins or reaches an agreed confirmation threshold.

## Tasks and activity

Use Twenty's automatically created Tasks relation; do not define a custom Next
Step or Tasks field. Tasks should represent concrete actions such as contacting
the Candidate, reviewing an application, scheduling an interview, collecting
feedback, following up, or preparing an offer. Each task retains its own due
date, status, assignee, and description while the Job Candidacy Owner remains
accountable for the overall record.

Use Notes, Attachments, and Timeline activity for application materials,
interview feedback, and other qualitative context.

## Suggested views

- Active Pipeline, as a Kanban grouped by Candidacy Stage
- Applications
- Screening
- Interviewing
- Offers
- Accepted
- Closed, covering Rejected and Withdrawn records
- On Hold

## Explicit exclusions

- No Hiring Organization field; every Job Candidacy is for a role at Spectech.
- No Fellowship relation.
- No Closed Date field.
- No duplicate email, location, education, biography, or other Person profile
  fields.
- No separate fields for individual interview rounds; use Tasks, Notes, and
  Timeline activity.
- No custom Next Step or Tasks field.
- Do not automatically create Employment History from an accepted offer.
- Do not rename, modify, delete, or migrate the existing Candidates object
  until its purpose and fields have been compared with this configuration.

## Open follow-ups

- Decide when an accepted candidacy should produce an Employment History
  record: offer acceptance, confirmed start, or actual start.
- Review the existing Candidates object before deciding whether to migrate any
  records. Job Candidacies currently coexist with it.
- Identify any source system before defining migration rules or the Source
  Candidacy Key format.
- Create the suggested pipeline views when the team is ready to use the object
  operationally; only Twenty's default views exist today.
