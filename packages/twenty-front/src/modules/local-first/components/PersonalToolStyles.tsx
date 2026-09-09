import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

export const StyledPersonalWorkspaceLayout = styled.main`
  background: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.primary};
  display: grid;
  font:
    14px/1.5 Inter,
    system-ui,
    sans-serif;
  grid-template-columns: 230px minmax(0, 1fr);
  min-height: 100vh;
  * {
    box-sizing: border-box;
  }
  button,
  input,
  select {
    font: inherit;
  }
  button,
  select,
  input:not([type='checkbox']) {
    border: 1px solid ${themeCssVariables.border.color.medium};
    border-radius: 6px;
    padding: 7px 10px;
  }
  button {
    background: ${themeCssVariables.background.primary};
    color: inherit;
    cursor: pointer;
  }
  button:hover {
    background: ${themeCssVariables.background.tertiary};
  }
  button:disabled {
    cursor: default;
    opacity: 0.5;
  }
  input,
  select {
    background: ${themeCssVariables.background.primary};
    color: inherit;
    min-width: 0;
  }
  a {
    color: ${themeCssVariables.font.color.primary};
  }
  h1 {
    font-size: 28px;
    font-weight: 600;
    letter-spacing: -0.7px;
    margin: 8px 0;
  }
  h2 {
    font-size: 15px;
    margin: 12px 0;
  }
  p {
    margin: 8px 0 16px;
  }
  aside {
    background: ${themeCssVariables.background.secondary};
    border-right: 1px solid ${themeCssVariables.border.color.light};
    padding: 28px 18px;
  }
  aside button {
    margin-bottom: 8px;
    text-align: left;
    width: 100%;
  }
  aside button[aria-current='true'] {
    background: ${themeCssVariables.background.tertiary};
    border-color: ${themeCssVariables.border.color.strong};
  }
  aside label {
    align-items: stretch;
    display: flex;
    flex-direction: column;
    margin-bottom: 8px;
    width: 100%;
  }
  aside input {
    max-width: 100%;
    width: 100%;
  }
  article {
    padding: 28px;
  }
  section {
    margin-top: 24px;
  }
  fieldset {
    border: 0;
    margin: 0;
    min-width: 0;
    padding: 0;
  }
  small {
    color: ${themeCssVariables.font.color.secondary};
  }
  table {
    border-collapse: collapse;
    min-width: 100%;
  }
  th,
  td {
    border-bottom: 1px solid ${themeCssVariables.border.color.light};
    padding: 10px 8px;
    text-align: left;
  }
  th {
    color: ${themeCssVariables.font.color.secondary};
    font-size: 12px;
    font-weight: 500;
  }
  td input:not([type='checkbox']) {
    border-color: transparent;
    min-width: 140px;
    width: 100%;
  }
  td input:focus {
    border-color: ${themeCssVariables.border.color.strong};
  }
  details {
    background: ${themeCssVariables.background.secondary};
    border-radius: 8px;
    padding: 12px;
  }
  summary {
    cursor: pointer;
    font-weight: 500;
  }
  label {
    align-items: center;
    display: inline-flex;
    gap: 6px;
  }
  [role='alert'] {
    background: ${themeCssVariables.background.secondary};
    border: 1px solid ${themeCssVariables.border.color.medium};
    border-radius: 8px;
    padding: 12px;
  }
  @media (max-width: 760px) {
    grid-template-columns: 1fr;
    aside {
      border-bottom: 1px solid ${themeCssVariables.border.color.light};
      border-right: 0;
    }
    article {
      padding: 16px;
    }
  }
`;
export const StyledPersonalToolActions = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
`;
export const StyledPersonalToolTableContainer = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: 10px;
  margin-top: 16px;
  overflow: auto;
`;
