import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLingui } from '@lingui/react/macro';
import { LINKED_FIELD_SUPPORTED_TYPES } from 'twenty-shared/constants';
import { SettingsPath } from 'twenty-shared/types';
import {
  getLinkedFieldReference,
  getSettingsPath,
  isDefined,
} from 'twenty-shared/utils';
import { computeMetadataNameFromLabel } from '~/pages/settings/data-model/utils/computeMetadataNameFromLabel';
import { Button } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { H2Title } from 'twenty-ui/typography';
import { IconLink } from 'twenty-ui/icon';
import { FieldMetadataType, RelationType } from '~/generated-metadata/graphql';
import { useNavigateSettings } from '~/hooks/useNavigateSettings';
import { useFieldMetadataItem } from '@/object-metadata/hooks/useFieldMetadataItem';
import { useFilteredObjectMetadataItems } from '@/object-metadata/hooks/useFilteredObjectMetadataItems';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsWizardStepBar } from '@/settings/components/layout/SettingsWizardStepBar';
import { Select } from '@/ui/input/components/Select';
import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';
import { isDDLLockedState } from '@/client-config/states/isDDLLockedState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { FIELD_NAME_MAXIMUM_LENGTH } from '@/settings/data-model/constants/FieldNameMaximumLength';

export const SettingsObjectNewLinkedFieldConfigure = () => {
  const { t } = useLingui();
  const { objectNamePlural = '' } = useParams();
  const navigate = useNavigateSettings();
  const { findObjectMetadataItemByNamePlural, objectMetadataItems } =
    useFilteredObjectMetadataItems();
  const destination = findObjectMetadataItemByNamePlural(objectNamePlural);
  const person = objectMetadataItems.find(
    (object) => object.nameSingular === 'person',
  );
  const relations =
    destination?.readableFields.filter(
      (field) =>
        destination.nameSingular !== 'person' &&
        field.isActive &&
        !isDefined(getLinkedFieldReference(field.settings)) &&
        field.type === FieldMetadataType.RELATION &&
        field.relation?.type === RelationType.MANY_TO_ONE &&
        field.relation.targetObjectMetadata.id === person?.id,
    ) ?? [];
  const sources =
    person?.readableFields.filter(
      (field) =>
        field.isActive &&
        LINKED_FIELD_SUPPORTED_TYPES.includes(field.type) &&
        !isDefined(getLinkedFieldReference(field.settings)),
    ) ?? [];
  const [relationId, setRelationId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [label, setLabel] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const isDDLLocked = useAtomStateValue(isDDLLockedState);
  const { createMetadataField } = useFieldMetadataItem();
  const relation =
    relations.find((field) => field.id === relationId) ??
    (relations.length === 1 ? relations[0] : undefined);
  const source = sources.find((field) => field.id === sourceId);
  const name = computeMetadataNameFromLabel(label.trim());
  const nameAlreadyExists = destination?.fields.some(
    (field) => field.name === name,
  );
  const canSave =
    isDefined(destination) &&
    isDefined(relation) &&
    isDefined(source) &&
    name.length > 0 &&
    !nameAlreadyExists &&
    !isSaving &&
    !isDDLLocked;

  const save = async () => {
    if (
      !canSave ||
      !isDefined(destination) ||
      !isDefined(relation) ||
      !isDefined(source)
    ) {
      return;
    }
    setIsSaving(true);
    try {
      const result = await createMetadataField({
        objectMetadataId: destination.id,
        type: source.type,
        name,
        label: label.trim(),
        description: '',
        icon: source.icon,
        defaultValue: null,
        isUnique: false,
        isLabelSyncedWithName: true,
        options:
          source.options?.map(
            ({ value, label: optionLabel, color, position }) => ({
              value,
              label: optionLabel,
              color,
              position,
            }),
          ) ?? null,
        settings: {
          ...source.settings,
          linkedField: {
            relationFieldMetadataUniversalIdentifier:
              relation.universalIdentifier,
            sourceFieldMetadataUniversalIdentifier: source.universalIdentifier,
          },
        },
      });
      if (result.status === 'successful') {
        navigate(SettingsPath.ObjectDetail, { objectNamePlural });
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SettingsPageLayout
      title={t`Linked field`}
      icon={<IconLink />}
      links={[
        { children: t`Objects`, href: getSettingsPath(SettingsPath.Objects) },
        {
          children: destination?.labelPlural ?? objectNamePlural,
          href: getSettingsPath(SettingsPath.ObjectDetail, {
            objectNamePlural,
          }),
        },
        { children: t`Linked field` },
      ]}
      secondaryBar={
        <SettingsWizardStepBar
          label={t`2. Configure linked field`}
          onBack={() =>
            navigate(SettingsPath.ObjectNewFieldSelect, { objectNamePlural })
          }
          trailing={
            <Button
              title={t`Save`}
              variant="primary"
              size="small"
              accent="blue"
              disabled={!canSave}
              onClick={save}
            />
          }
        />
      }
    >
      <SettingsPageContainer>
        <Section>
          <H2Title
            title={t`Source`}
            description={t`Show a field from the related Person. Values stay current and can only be edited on that Person record.`}
          />
          <Select
            dropdownId="linked-field-relation"
            label={t`Person relation`}
            fullWidth
            withSearchInput
            value={relation?.id}
            onChange={setRelationId}
            emptyOption={{ value: '', label: t`Choose a relation` }}
            options={relations.map((field) => ({
              value: field.id,
              label: field.label,
            }))}
          />
          <Select
            dropdownId="linked-field-source"
            label={t`Person field`}
            fullWidth
            withSearchInput
            value={sourceId}
            onChange={(value) => {
              setSourceId(value);
              const selected = sources.find((field) => field.id === value);
              if (isDefined(selected)) {
                setLabel(selected.label);
              }
            }}
            emptyOption={{ value: '', label: t`Choose a field` }}
            options={sources.map((field) => ({
              value: field.id,
              label: field.label,
            }))}
          />
          {relations.length === 0 && (
            <p>{t`Add a relation to one Person before creating a linked field.`}</p>
          )}
          {isDefined(relation) && isDefined(source) && (
            <p>
              {relation.label} → {source.label}
            </p>
          )}
        </Section>
        <Section>
          <H2Title
            title={t`Field name`}
            description={t`Available in this object's views and record pages. Supports sorting, filtering, and CSV export.`}
          />
          <SettingsTextInput
            instanceId="linked-field-label"
            label={t`Name`}
            value={label}
            onChange={setLabel}
            maxLength={FIELD_NAME_MAXIMUM_LENGTH}
          />
          {nameAlreadyExists && (
            <p role="alert">{t`A field with this name already exists. Choose another name.`}</p>
          )}
        </Section>
      </SettingsPageContainer>
    </SettingsPageLayout>
  );
};
