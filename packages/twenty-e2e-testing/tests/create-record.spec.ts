import { expect, test } from '../lib/fixtures/screenshot';
import { backendGraphQLUrl } from '../lib/requests/backend';
import { getAccessAuthToken } from '../lib/utils/getAccessAuthToken';

const query = `query FindOnePerson($objectRecordId: UUID!) {
  person(
    filter: {or: [{deletedAt: {is: NULL}}, {deletedAt: {is: NOT_NULL}}], id: {eq: $objectRecordId}}
  ) {
    previousCompanies {
      edges {
        node {
          company {
            name
          }
        }
      }
    }
    emails {
      primaryEmail
      additionalEmails
      __typename
    }
    id
    intro
    jobTitle
    linkedinLink {
      primaryLinkUrl
      primaryLinkLabel
      secondaryLinks
      __typename
    }
    name {
      firstName
      lastName
      __typename
    }
    performanceRating
    phones {
      primaryPhoneNumber
      primaryPhoneCountryCode
      primaryPhoneCallingCode
      additionalPhones
      __typename
    }
    position
    workPreference
    updatedAt
  }
}`;

test('Create and update record', async ({ page }) => {
  await page.goto('/objects/people');
  await page.getByRole('button', { name: 'Create new Person' }).click();

  // Generate a random email for testing
  const randomEmail = `testuser_${Math.random().toString(36).substring(2, 10)}@example.com`;
  // Fill first name and last name
  const firstNameInput = page.getByRole('textbox', { name: 'F‌‌irst name' });
  await expect(firstNameInput).toBeFocused();
  await firstNameInput.fill('John');
  const lastNameInput = page.getByPlaceholder('L‌‌ast name');
  await expect(lastNameInput).toBeVisible();
  await lastNameInput.fill('Doe');
  await lastNameInput.press('Enter');

  // Focus on recordFieldList
  const recordFieldList = page.getByTestId('record-fields-widget');
  await expect(recordFieldList).toBeVisible();
  await recordFieldList.getByText('Emails').first().click();

  // Fill email
  const emailInput = recordFieldList.getByText('Emails').nth(1);
  await expect(emailInput).toBeVisible();
  await emailInput.click({ force: true });
  await page.getByPlaceholder('Email').fill(randomEmail);
  await page.keyboard.press('Enter');
  await recordFieldList.getByText('Emails').first().click();

  // Fill URL
  await recordFieldList.getByText('Linkedin').first().click();
  const urlInput = recordFieldList.getByText('Linkedin').nth(1);
  await expect(urlInput).toBeVisible();
  await urlInput.click({ force: true });
  await page.getByPlaceholder('URL').fill('linkedin.com/johndoe');
  await page.getByPlaceholder('URL').press('Enter');

  // Fill phone field
  await recordFieldList.getByText('Phones').first().click();
  const phoneInput = recordFieldList.getByText('Phones').nth(1);
  await expect(phoneInput).toBeVisible();
  await phoneInput.click({ force: true });
  await page.getByPlaceholder('Phone').fill('+336 1 122 3344');
  await page.getByPlaceholder('Phone').press('Enter');

  // Open full record page to get person ID
  await page.getByRole('button', { name: /^Open/ }).click();
  await page.waitForURL(/\/object\/person\//);
  const newPersonId = page.url().match(/\/object\/person\/([a-f0-9-]+)/)?.[1];

  // Check data was saved
  const { authToken } = await getAccessAuthToken(page);
  const findOnePersonResponse = await page.request.post(backendGraphQLUrl, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
    data: {
      operationName: 'FindOnePerson',
      query,
      variables: {
        objectRecordId: newPersonId,
      },
    },
  });

  const findOnePersonReponseBody = await findOnePersonResponse.json();

  expect(findOnePersonReponseBody.data.person.name.firstName).toBe('John');
  expect(findOnePersonReponseBody.data.person.name.lastName).toBe('Doe');
  expect(findOnePersonReponseBody.data.person.emails.primaryEmail).toBe(
    randomEmail,
  );
  expect(findOnePersonReponseBody.data.person.linkedinLink.primaryLinkUrl).toBe(
    'linkedin.com/johndoe',
  );
  expect(findOnePersonReponseBody.data.person.phones.primaryPhoneNumber).toBe(
    '611223344',
  );
});
