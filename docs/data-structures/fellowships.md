# Fellowships configuration

This custom object turns the Folk Brains Fellows group into repeatable
fellowship records linked to canonical People. It stores program-specific
information without duplicating each fellow's core contact profile.

## Record grain

Create one Fellowship record per Person and Cohort. The same Person can
therefore participate in more than one fellowship cohort without creating
duplicate Person records.

## Object settings

| Setting | Value |
| --- | --- |
| Singular label | Fellowship |
| Plural label | Fellowships |
| Internal name | `fellowship` |
| Record label | `{Cohort} - {Fellow}` |

## Fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| Fellowship | Text, primary | Yes | Human-readable record label, populated during import or creation. |
| Fellow | Relation to Person | Yes | The canonical CRM contact. |
| Cohort | Select | Yes | Use the shared canonical cohort options listed below. |
| Fellowship Status | Select | No | `Current`, `Alumni`, or `Dropped`. |
| Discussion Group | Select | No | `Group 1`, `Group 2`, or `Group 3`. |
| Output Target | Multi-select | No | `FRO`, `Spectech`, `ARPA-E`, `SETA`, `ARPA-H`, or `DARPA`. |
| Post-Fellowship Outcome | Multi-select | No | Initially `Running FRO`, `Acquired Role`, or `Other`. Keep outcomes separate from participation status. |
| Fellow Bio | Text | No | The cohort-specific or publication-ready bio. Do not overwrite the Person's general description. |
| Accommodations | Text | No | Fellowship-specific accessibility or participation needs. Treat as sensitive operational information. |
| Brief Sharing Permission | Select | No | `Yes`, `No`, `Pending`, `Conditional`, `Not Applicable`, or `Needs Review`. |
| Brief Sharing Notes | Text | No | Preserves qualifications or context that cannot be represented by the normalized permission value. |
| Mentorships | Relation to Mentorship | No | Links the Fellowship to its mentor assignments without duplicating a direct Mentor field. One Fellowship may have more than one Mentorship if assignments change. |
| Folk Fellowship Key | Text, unique | No | Hidden migration/upsert key: `folk:{personId}:{cohort}`. |

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
- Keep `First Name (full)`, Gmail, name pronunciation, preferred pronouns,
  city, and time zone on Person.
- Keep the program-specific Bio and Accommodations on Fellowship.
- Do not migrate generic tags or group membership into Fellowship fields.

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
