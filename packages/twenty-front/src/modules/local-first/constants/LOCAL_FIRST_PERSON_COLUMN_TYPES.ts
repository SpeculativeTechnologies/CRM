import { type LOCAL_FIRST_PERSON_COLUMNS } from '@/local-first/constants/LOCAL_FIRST_PERSON_COLUMNS';

// Postgres types for the local mirror of the person table. They match the
// workspace schema's own types so that ordering and null handling behave the
// same locally as they do on the server (position is a float, not an int).
export const LOCAL_FIRST_PERSON_COLUMN_TYPES: Record<
  (typeof LOCAL_FIRST_PERSON_COLUMNS)[number],
  string
> = {
  id: 'uuid primary key',
  nameFirstName: 'text',
  nameLastName: 'text',
  jobTitle: 'text',
  emailsPrimaryEmail: 'text',
  position: 'double precision',
  createdAt: 'timestamptz',
  updatedAt: 'timestamptz',
  deletedAt: 'timestamptz',
};
