# Fellowships configuration

This custom object turns the Folk Brains Fellows group into repeatable
fellowship records linked to canonical People. It stores program-specific
information without duplicating each fellow's core contact profile.

## Implementation status

The object and the fields in this brief are active in the live CRM. Fellowship
Tags was added through the metadata API on 2026-08-11. No Fellowship records
were created or migrated as part of this guidance update.

## Record grain

Create one Fellowship record per Person and Cohort. The same Person can
therefore participate in more than one fellowship cohort without creating
duplicate Person records.

## Object settings

| Setting        | Value                 |
| -------------- | --------------------- |
| Singular label | Fellowship            |
| Plural label   | Fellowships           |
| Internal name  | `fellowship`          |
| Record label   | `{Cohort} - {Fellow}` |

## Fields

| Field                    | Type                   | Required | Notes                                                                                                                                                             |
| ------------------------ | ---------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fellowship               | Text, primary          | Yes      | Human-readable record label, populated during import or creation.                                                                                                 |
| Fellow                   | Relation to Person     | Yes      | The canonical CRM contact.                                                                                                                                        |
| Cohort                   | Select                 | Yes      | Use the shared canonical cohort options listed below.                                                                                                             |
| Fellowship Status        | Select                 | No       | `Current`, `Alumni`, or `Dropped`.                                                                                                                                |
| Fellowship Tags          | Multi-select           | No       | Preserve tags from the Folk Brains Fellows group. Keep this option vocabulary separate from tags on People and other program objects.                             |
| Discussion Group         | Select                 | No       | `Group 1`, `Group 2`, or `Group 3`.                                                                                                                               |
| Output Target            | Multi-select           | No       | `FRO`, `Spectech`, `ARPA-E`, `SETA`, `ARPA-H`, or `DARPA`.                                                                                                        |
| Post-Fellowship Outcome  | Multi-select           | No       | Initially `Running FRO`, `Acquired Role`, or `Other`. Keep outcomes separate from participation status.                                                           |
| Fellow Bio               | Text                   | No       | The cohort-specific or publication-ready bio. Do not overwrite the Person's general description.                                                                  |
| Accommodations           | Text                   | No       | Fellowship-specific accessibility or participation needs. Treat as sensitive operational information.                                                             |
| Brief Sharing Permission | Select                 | No       | `Yes`, `No`, `Pending`, `Conditional`, `Not Applicable`, or `Needs Review`.                                                                                       |
| Brief Sharing Notes      | Text                   | No       | Preserves qualifications or context that cannot be represented by the normalized permission value.                                                                |
| Mentorships              | Relation to Mentorship | No       | Links the Fellowship to its mentor assignments without duplicating a direct Mentor field. One Fellowship may have more than one Mentorship if assignments change. |
| Folk Fellowship Key      | Text, unique           | No       | Hidden migration/upsert key: `folk:{personId}:{cohort}`.                                                                                                          |

Canonical Cohort options:

- Brains Cohort 1 (2023)
- Brains Cohort 2 (2024)
- Brains Cohort 3 (2026)
- Brains Cohort 4 (2027)
- AI Brains

Add future cohorts to this shared select rather than creating cohort-specific
fields.

## Tasks and activity

Use Twenty's automatically created Tasks relation; do not define a separate
Tasks field.

Tasks should represent concrete actions related to the fellowship, such as
collecting a bio, confirming brief-sharing permission, arranging
accommodations, or following up on an output target. Each task retains its own
title, description, due date, status, and assignee.

## Folk migration rules

- Use the Folk `Brains Fellows` group as the source. Its current group fields
  include `Cohort`, `Status`, `Discussion Group`, `Output Target`, `Bio`,
  `Accommodations`, `Permission to share brief`, `Mentor`, and
  `Mentor assignment cohort 1`, in addition to Person profile fields.
- Create one Fellowship for each Brains Fellows group member and cohort.
- Map Folk cohorts as follows:
  - `Cohort 1` -> `Brains Cohort 1 (2023)`
  - `Cohort 2` -> `Brains Cohort 2 (2024)`
  - `Cohort 3` -> `Brains Cohort 3 (2026)`
  - `AI Cohort` -> `AI Brains`
- Hold records with a blank or unrecognized cohort for manual review rather
  than inventing a cohort.
- Map Folk `Current` and `Dropped` into Fellowship Status.
- Move `Running FRO` and `Acquired Role` from Folk's overloaded Status field
  into Post-Fellowship Outcome.
- Do not automatically interpret blank historical statuses as `Alumni` until
  that rule is confirmed.
- Convert both Folk mentor fields into Mentorship records and link those
  records to the corresponding Fellowship.
- Normalize permission responses into Brief Sharing Permission while
  preserving the original qualified response in Brief Sharing Notes.
- Hold the malformed Folk Discussion Group value `Group 3, Group` for review
  rather than silently treating it as `Group 3`.
- Keep `First Name (full)`, Gmail, name pronunciation, preferred pronouns,
  city, and time zone on Person.
- Keep the program-specific Bio and Accommodations on Fellowship.
- Copy group-scoped Folk tags, when present in the migration export, into
  Fellowship Tags. Do not copy them to Person or reuse tag options from another
  Folk group.
- The live Fellowship Tags field is seeded with `Needs Review` because Twenty
  requires at least one multi-select option. Before migration, add the distinct
  Brains Fellows tag values to the field. Leave the field blank when the source
  has no tags; do not map every source tag to `Needs Review`.
- The Folk custom-field API did not expose a `Tags` definition for Brains
  Fellows when checked on 2026-08-11. Re-read the group schema and migration
  export immediately before import rather than assuming the tag vocabulary is
  empty or unchanged.

## Suggested views

- Current Fellows
- Fellows by Cohort
- Discussion Groups
- Brief Permission Follow-up
- Fellows Without a Mentorship
- Output Targets
- Post-Fellowship Outcomes
- Past Fellowships

## Explicit exclusions

- No direct Mentor field; Mentorship is the source of truth.
- No duplicate email, city, pronouns, pronunciation, or time-zone fields.
- No cohort-specific fields.
- No raw Folk Status field.
- No custom Tasks field.
