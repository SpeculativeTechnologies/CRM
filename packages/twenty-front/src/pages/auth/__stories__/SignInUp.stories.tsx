import { getOperationName } from '~/utils/getOperationName';
import { type Meta, type StoryObj } from '@storybook/react-vite';
import { HttpResponse, graphql } from 'msw';
import { useEffect } from 'react';
import { fireEvent, within } from 'storybook/test';

import { captchaTokenState } from '@/captcha/states/captchaTokenState';
import { clientConfigApiStatusState } from '@/client-config/states/clientConfigApiStatusState';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { GET_CURRENT_USER } from '@/users/graphql/queries/getCurrentUser';
import {
  PageDecorator,
  type PageDecoratorArgs,
} from '~/testing/decorators/PageDecorator';
import { graphqlMocks } from '~/testing/graphqlMocks';

import { AppPath } from 'twenty-shared/types';
import { SignInUp } from '~/pages/auth/SignInUp';

const SignInUpStoryStateSetterEffect = () => {
  const setCaptchaToken = useSetAtomState(captchaTokenState);
  const setClientConfigApiStatus = useSetAtomState(clientConfigApiStatusState);

  useEffect(() => {
    setCaptchaToken('MOCKED_CAPTCHA_TOKEN');
    setClientConfigApiStatus((currentStatus) => ({
      ...currentStatus,
      isLoadedOnce: true,
    }));
  }, [setCaptchaToken, setClientConfigApiStatus]);

  return null;
};

const SignInUpWithCaptcha = () => {
  return (
    <>
      <SignInUpStoryStateSetterEffect />
      <SignInUp />
    </>
  );
};

const meta: Meta<PageDecoratorArgs> = {
  title: 'Pages/Auth/SignInUp',
  component: SignInUpWithCaptcha,
  decorators: [PageDecorator],
  args: { routePath: AppPath.SignInUp },
  parameters: {
    msw: {
      handlers: [
        graphql.query(getOperationName(GET_CURRENT_USER) ?? '', () => {
          return HttpResponse.json({
            data: null,
            errors: [
              {
                message: 'Unauthorized',
                extensions: {
                  code: 'UNAUTHENTICATED',
                  response: {
                    statusCode: 401,
                    message: 'Unauthorized',
                  },
                },
              },
            ],
          });
        }),
        graphqlMocks.handlers,
      ],
    },
    cookie: '',
  },
};

export default meta;

export type Story = StoryObj<typeof SignInUpWithCaptcha>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await canvas.findByRole('heading', {
      name: 'Welcome, Twenty Eng._TEST',
    });
    const continueWithEmailButton = await canvas.findByText(
      'Continue with Email',
      {},
      { timeout: 3000 },
    );

    await fireEvent.click(continueWithEmailButton);
  },
};
