# Mentorships configuration

This custom object represents a mentor-mentee engagement without duplicating
either person's canonical CRM record. It follows the
[Twenty data structure proposal](https://app.notion.com/p/Twenty-Data-Structure-Proposal-3b3ec84047a980be90c9f52170791767).

## Record grain

Create one Mentorship record for each mentor, mentee, and cohort combination.
The same two people can therefore have another Mentorship in a later cohort.

## Object settings

| Setting | Value |
| --- | --- |
| Singular label | Mentorship |
| Plural label | Mentorships |
| Internal name | `mentorship` |
| Record label | `{Cohort} - {Mentor} <-> {Mentee}` |

## Fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| Mentorship | Text, primary | Yes | Human-readable record label, populated during import or creation. |
| Mentor | Relation to Person | Yes | Many Mentorships may reference one Person as mentor. |
| Mentee | Relation to Person | Yes | Many Mentorships may reference one Person as mentee. |
| Cohort | Select | Yes | Use the shared canonical cohort options listed below. |

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

## Explicit exclusions

- No Status field.
- No Focus field.
- No Mentee feedback field.
- Do not rename, modify, or delete the existing Mentors object.
