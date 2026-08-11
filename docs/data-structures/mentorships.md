# Mentorships configuration

This custom object represents a mentor-mentee engagement without duplicating
either person's canonical CRM record. It follows the
[Twenty data structure proposal](https://app.notion.com/p/Twenty-Data-Structure-Proposal-3b3ec84047a980be90c9f52170791767).

## Implementation status

The object and the fields in this brief are active in the live CRM. Mentorship
Tags was added through the metadata API on 2026-08-11. No Mentorship records
were created or migrated as part of this guidance update.

## Record grain

Create one Mentorship record for each mentor, mentee, and cohort combination.
The same two people can therefore have another Mentorship in a later cohort.

## Object settings

| Setting        | Value                              |
| -------------- | ---------------------------------- |
| Singular label | Mentorship                         |
| Plural label   | Mentorships                        |
| Internal name  | `mentorship`                       |
| Record label   | `{Cohort} - {Mentor} <-> {Mentee}` |

## Fields

| Field           | Type               | Required | Notes                                                                                           |
| --------------- | ------------------ | -------- | ----------------------------------------------------------------------------------------------- |
| Mentorship      | Text, primary      | Yes      | Human-readable record label, populated during import or creation.                               |
| Mentor          | Relation to Person | Yes      | Many Mentorships may reference one Person as mentor.                                            |
| Mentee          | Relation to Person | Yes      | Many Mentorships may reference one Person as mentee.                                            |
| Cohort          | Select             | Yes      | Use the shared canonical cohort options listed below.                                           |
| Mentorship Tags | Multi-select       | No       | Preserve tags from the Folk Brains Mentors group. These are source-group tags, not Person tags. |

Canonical Cohort options:

- Brains Cohort 1 (2023)
- Brains Cohort 2 (2024)
- Brains Cohort 3 (2026)
- Brains Cohort 4 (2027)
- AI Brains

Add future cohorts to this select rather than creating new cohort-specific
fields.

## Tasks and activity

Twenty automatically creates the Tasks relation, along with Notes,
Attachments, and Timeline activity, when a custom object is created. Do not add
a separate Tasks field to the metadata request. A task can target a Mentorship
record and retain its own title, description, due date, status, and assignee.

## Folk migration rules

- Use the Folk `Brains Mentors` group as the source, but do not create a
  Mentorship for every person in that group. It also contains connectors,
  speakers, advisors, and other people who are not assigned mentors.
- Create Mentorships only from an actual mentor-to-mentee assignment. Inspect
  `Cohorts` and all mentee columns, including source columns named `mentees`,
  `3 mentees`, `1 mentees`, and `AI cohort mentees`. The current Folk API also
  exposes the labels `Cohort 1 mentees`, `Cohort 2 mentees`, and
  `AI Cohort mentees`; account for these naming variants when reading an export.
- A cohort-specific mentee column determines the Cohort. When only a generic
  `mentees` column is populated, pair it with `Cohorts`. Hold the row for manual
  review if the cohort remains ambiguous.
- Create one Mentorship for each mentor, linked mentee, and cohort. Multiple
  mentees in one source cell produce multiple Mentorship records, not one
  multi-mentee record.
- Do not infer a mentorship from `Brains mentor role`, `Status`, or Tags alone.
  In particular, Connector, Speaker, and Advisor values do not establish a
  mentor-mentee relationship.
- Copy the Brains Mentors entry's group-scoped tags to Mentorship Tags on each
  Mentorship produced from that entry. Do not copy them to Person or merge them
  with Recruitment, Fellowship, Job Candidacy, or Fundraising Opportunity tag
  options.
- The live Mentorship Tags field is seeded with `Needs Review` because Twenty
  requires at least one multi-select option. Before migration, add the distinct
  Brains Mentors `Tags` values to the field. Leave it blank when the source has
  no tags; do not collapse all tags into `Needs Review`.

## Explicit exclusions

- No Status field.
- No Focus field.
- No Mentee feedback field.
- Do not rename, modify, or delete the existing Mentors object.
