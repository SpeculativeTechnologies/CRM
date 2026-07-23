import { type EmailPlaceholderValues } from '@/activities/emails/mass-email/utils/emailPlaceholders';

export type MassEmailRecipient = {
  personId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  placeholderValues: EmailPlaceholderValues;
};
