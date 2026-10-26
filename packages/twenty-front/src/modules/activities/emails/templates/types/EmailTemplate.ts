export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  updatedAt: string;
};

export type EmailTemplateContent = Pick<EmailTemplate, 'subject' | 'body'>;
