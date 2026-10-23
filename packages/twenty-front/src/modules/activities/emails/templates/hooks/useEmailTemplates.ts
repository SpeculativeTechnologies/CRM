import { useMutation, useQuery } from '@apollo/client/react';

import { EMAIL_TEMPLATES } from '@/activities/emails/graphql/metadata-queries/emailTemplates';
import {
  DELETE_EMAIL_TEMPLATE,
  SAVE_EMAIL_TEMPLATE,
} from '@/activities/emails/graphql/mutations/saveEmailTemplate';
import { type EmailTemplateContent } from '@/activities/emails/templates/types/EmailTemplate';
import {
  type EmailTemplatesQuery,
  type SaveEmailTemplateMutation,
  type SaveEmailTemplateMutationVariables,
  type DeleteEmailTemplateMutation,
  type DeleteEmailTemplateMutationVariables,
} from '~/generated-metadata/graphql';

export const useEmailTemplates = () => {
  const { data, loading, error, refetch } = useQuery<EmailTemplatesQuery>(
    EMAIL_TEMPLATES,
    { fetchPolicy: 'network-only' },
  );
  const [saveMutation, { loading: isSaving }] = useMutation<
    SaveEmailTemplateMutation,
    SaveEmailTemplateMutationVariables
  >(SAVE_EMAIL_TEMPLATE);
  const [deleteMutation, { loading: isDeleting }] = useMutation<
    DeleteEmailTemplateMutation,
    DeleteEmailTemplateMutationVariables
  >(DELETE_EMAIL_TEMPLATE);

  const saveTemplate = async (
    input: EmailTemplateContent & { id?: string; name: string },
  ) => {
    const result = await saveMutation({ variables: { input } });

    await refetch();

    return result.data?.saveEmailTemplate;
  };
  const deleteTemplate = async (id: string) => {
    await deleteMutation({ variables: { id } });
    await refetch();
  };

  return {
    templates: data?.emailTemplates ?? [],
    loading,
    error,
    isSaving,
    isDeleting,
    saveTemplate,
    deleteTemplate,
  };
};
