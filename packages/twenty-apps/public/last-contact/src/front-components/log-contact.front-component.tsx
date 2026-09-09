import {
  type CSSProperties,
  type SyntheticEvent,
  useRef,
  useState,
} from 'react';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineFrontComponent } from 'twenty-sdk/define';
import {
  closeSidePanel,
  enqueueSnackbar,
  unmountFrontComponent,
  useSelectedRecordIds,
} from 'twenty-sdk/front-component';

import {
  CONTACT_LOG_CHANNELS,
  CONTACT_LOG_DIRECTIONS,
} from 'src/constants/contact-log-options';
import { LOG_CONTACT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  buildContactLogInput,
  toLocalDateTimeInput,
} from 'src/utils/build-contact-log-input';

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    padding: 24,
    fontFamily: 'var(--t-font-family)',
    color: 'var(--t-font-color-primary)',
  },
  heading: { margin: 0, fontSize: 20, fontWeight: 600 },
  description: {
    margin: 0,
    fontSize: 13,
    color: 'var(--t-font-color-secondary)',
    lineHeight: 1.5,
  },
  field: { display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 },
  input: {
    boxSizing: 'border-box',
    width: '100%',
    padding: '10px 12px',
    border: '1px solid var(--t-border-color-medium)',
    borderRadius: 6,
    background: 'var(--t-background-primary)',
    color: 'var(--t-font-color-primary)',
    font: 'inherit',
  },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 8 },
  button: {
    padding: '9px 14px',
    borderRadius: 6,
    border: '1px solid var(--t-border-color-medium)',
    background: 'var(--t-background-secondary)',
    color: 'var(--t-font-color-primary)',
    font: 'inherit',
    cursor: 'pointer',
  },
  primary: {
    background: 'var(--t-color-blue)',
    color: 'white',
    borderColor: 'var(--t-color-blue)',
  },
  error: { margin: 0, color: 'var(--t-color-red)', fontSize: 13 },
};

// Remote front components forward form values in event.detail.
const readValue = (event: SyntheticEvent<HTMLElement>): string => {
  const forwarded = event as {
    detail?: { value?: string };
    target?: { value?: string };
  };
  return forwarded.detail?.value ?? forwarded.target?.value ?? '';
};

export const LogContact = () => {
  const selectedRecordIds = useSelectedRecordIds();
  const personId = selectedRecordIds.length === 1 ? selectedRecordIds[0] : '';
  const [channel, setChannel] = useState('LINKEDIN');
  const [direction, setDirection] = useState('OUTBOUND');
  const [occurredAt, setOccurredAt] = useState(() =>
    toLocalDateTimeInput(new Date()),
  );
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveInProgress = useRef(false);

  const handleClose = async () => {
    await unmountFrontComponent();
    await closeSidePanel();
  };

  const handleSave = async () => {
    if (saveInProgress.current) {
      return;
    }
    saveInProgress.current = true;
    setSaving(true);
    setError(null);
    try {
      const data = buildContactLogInput({
        personId,
        channel,
        direction,
        occurredAt,
        notes,
      });
      const { createContactLog } = await new CoreApiClient().mutation({
        createContactLog: { __args: { data }, id: true },
      });
      if (!createContactLog?.id) {
        throw new Error('Contact could not be saved. Please try again.');
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Contact could not be saved. Please try again.',
      );
      saveInProgress.current = false;
      setSaving(false);
      return;
    }
    // Once saved, leave Save disabled even if closing the panel fails.
    await enqueueSnackbar({
      message: 'Contact logged. Last contact will update shortly.',
      variant: 'success',
    });
    await handleClose();
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Log contact</h2>
      <p style={styles.description}>
        Record a LinkedIn message, text, call, or other contact with this
        person. It counts toward last contact.
      </p>
      <label style={styles.field}>
        Channel
        <select
          value={channel}
          onChange={(event) => setChannel(readValue(event))}
          style={styles.input}
          disabled={saving}
        >
          {CONTACT_LOG_CHANNELS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label style={styles.field}>
        Contact date
        <input
          type="datetime-local"
          value={occurredAt}
          max={toLocalDateTimeInput(new Date())}
          onChange={(event) => setOccurredAt(readValue(event))}
          style={styles.input}
          disabled={saving}
        />
      </label>
      <label style={styles.field}>
        Direction
        <select
          value={direction}
          onChange={(event) => setDirection(readValue(event))}
          style={styles.input}
          disabled={saving}
        >
          {CONTACT_LOG_DIRECTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label style={styles.field}>
        Notes (optional)
        <textarea
          value={notes}
          onChange={(event) => setNotes(readValue(event))}
          placeholder="What did you discuss?"
          rows={4}
          style={{ ...styles.input, resize: 'vertical' }}
          disabled={saving}
        />
      </label>
      {!personId && (
        <p role="alert" style={styles.error}>
          Select one person to log contact.
        </p>
      )}
      {error && (
        <p role="alert" style={styles.error}>
          {error}
        </p>
      )}
      <div style={styles.footer}>
        <button
          type="button"
          onClick={handleClose}
          style={styles.button}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          style={{
            ...styles.button,
            ...styles.primary,
            opacity: saving || !personId ? 0.5 : 1,
          }}
          disabled={saving || !personId}
        >
          {saving ? 'Saving…' : 'Save contact'}
        </button>
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: LOG_CONTACT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'log-contact',
  description:
    'Log contact with a person through LinkedIn, text, phone, or another channel.',
  component: LogContact,
});
