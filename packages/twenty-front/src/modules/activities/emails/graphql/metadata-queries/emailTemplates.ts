import gql from 'graphql-tag';

export const EMAIL_TEMPLATES = gql`
  query EmailTemplates {
    emailTemplates {
      id
      name
      subject
      body
      updatedAt
    }
  }
`;
