# Job Candidacies configuration

This custom object represents a Person's candidacy for a specific
role at Spectech. It tracks the hiring process and outcome without duplicating
the Person's canonical CRM profile.

## Implementation status

Implemented in the live CRM through the metadata API on 2026-08-11. The object,
specified fields, reciprocal relations, and Twenty's default table and record
page views are active. Job Candidacy Tags was added later the same day. The
Source Candidacy Key is active for API imports but hidden in both default
views.

No Job Candidacy records were created or migrated. The existing Candidates
object was not renamed, modified, deleted, or migrated.

## Record grain

Create one Job Candidacy for each Candidate, Role, and hiring cycle. The same
Person can therefore be considered for more than one role, or for the same role
in a later hiring cycle, without creating duplicate Person records.

All Job Candidacies represent roles at Spectech, so the object does not need a
Hiring Organization relation.

## Object settings

| Setting        | Value                        |
| -------------- | ---------------------------- |
| Singular label | Job Candidacy                |
| Plural label   | Job Candidacies              |
| Internal name  | `jobCandidacy`               |
| Record label   | `{Candidate} - {Role Title}` |

## Fields

| Field                | Type                         | Required | Notes                                                                                                                             |
| -------------------- | ---------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Job Candidacy        | Text, primary                | Yes      | Human-readable record label, populated during import or creation.                                                                 |
| Candidate            | Relation to Person           | Yes      | The canonical CRM contact pursuing or being considered for the role.                                                              |
| Role Title           | Text                         | Yes      | Title of the specific Spectech position.                                                                                          |
| Candidacy Stage      | Select                       | Yes      | Use the canonical pipeline options listed below.                                                                                  |
| Job Candidacy Tags   | Multi-select                 | No       | Preserve tags from the specific Folk hiring group that produced the candidacy. Never merge tag vocabularies across hiring groups. |
| Owner                | Relation to Workspace Member | No       | Team member accountable for the Job Candidacy record.                                                                             |
| Job Posting URL      | Link                         | No       | Canonical posting or application page for the role.                                                                               |
| Referred By          | Relation to Person           | No       | Canonical Person who referred the Candidate.                                                                                      |
| Application Date     | Date                         | No       | Date the Candidate formally applied.                                                                                              |
| Source               | Select                       | No       | `Direct`, `Referral`, `Recruiter`, `Job Board`, `Internal`, or `Other`.                                                           |
| Source Candidacy Key | Text, unique                 | No       | Hidden migration/upsert key for current Folk sources: `folk:{groupId}:{personId}`.                                                |

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

## Folk migration rules

- Job Candidacies currently draw from at least two Folk groups:
  `Brains Project Coordinator 2026 Candidates` and
  `Program Associate candidates`. Read both; neither group is a complete source
  by itself.
- Set Role Title from the source group: `Brains Project Coordinator` for the
  2026 coordinator group and `Program Associate` for the program-associate
  group. Confirm whether the Program Associate group spans more than one hiring
  cycle before creating records.
- Use `folk:{groupId}:{personId}` as Source Candidacy Key so one person in both
  groups produces two candidacies and repeated runs upsert rather than
  duplicate.

Normalize current Folk `Status` values as follows:

| Folk Status        | Candidacy Stage |
| ------------------ | --------------- |
| `To be screened`   | `Screening`     |
| `First interview`  | `Interviewing`  |
| `Take Home`        | `Interviewing`  |
| `Email test`       | `Interviewing`  |
| `Final interviews` | `Finalist`      |
| `Offered`          | `Offer`         |
| `Rejected`         | `Rejected`      |

- Preserve take-home and email-test details in Tasks, Notes, Attachments, or
  Timeline activity rather than adding one-off Candidacy Stage options.
- Copy source-group tags, when present in the migration export, to Job
  Candidacy Tags. A tag from one hiring group must not become an option on a
  candidacy sourced from the other group unless that group independently uses
  the same value.
- The live Job Candidacy Tags field is seeded with `Needs Review` because
  Twenty requires at least one multi-select option. Before migration, add the
  distinct tag values from both hiring groups. Namespace each option with its
  source, such as `Project Coordinator - <tag>` or `Program Associate - <tag>`,
  so identical labels from different groups do not lose their group-specific
  meaning. Leave the field blank when a source row has no tags; do not map every
  tag to `Needs Review`.
- The Folk custom-field API exposed only `Status` for both hiring groups when
  checked on 2026-08-11. Re-read the group schemas and migration exports before
  import rather than assuming Tags or other source fields are absent forever.

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
- Confirm the hiring cycle represented by `Program Associate candidates` and
  whether one Folk row can represent candidacies from multiple cycles.
- Create the suggested pipeline views when the team is ready to use the object
  operationally; only Twenty's default views exist today.
