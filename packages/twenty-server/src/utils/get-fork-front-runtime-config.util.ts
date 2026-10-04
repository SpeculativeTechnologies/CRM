import { isNonEmptyString } from '@sniptt/guards';

export const getForkFrontRuntimeConfig = (
  environment: NodeJS.ProcessEnv,
): Record<string, string> => ({
  ...(environment.FRONT_AUTO_BASE_URL === 'true' || !environment.SERVER_URL
    ? {}
    : { REACT_APP_SERVER_BASE_URL: environment.SERVER_URL }),
  ...(isNonEmptyString(environment.ENVIRONMENT_LABEL)
    ? { REACT_APP_ENVIRONMENT_LABEL: environment.ENVIRONMENT_LABEL }
    : {}),
});
