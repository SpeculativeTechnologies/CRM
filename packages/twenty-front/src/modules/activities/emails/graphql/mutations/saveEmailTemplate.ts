import gql from 'graphql-tag';

export const SAVE_EMAIL_TEMPLATE = gql`
  mutation SaveEmailTemplate($input: SaveEmailTemplateInput!) {
    saveEmailTemplate(input: $input) {
      id
      name
      subject
      body
      updatedAt
    }
  }
`;

export const DELETE_EMAIL_TEMPLATE = gql`
  mutation DeleteEmailTemplate($id: String!) {
    deleteEmailTemplate(id: $id)
  }
`;
