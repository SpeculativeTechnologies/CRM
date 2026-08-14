import { selectLogicFunctionApiBaseUrl } from 'src/engine/core-modules/logic-function/logic-function-executor/utils/select-logic-function-api-base-url.util';

describe('selectLogicFunctionApiBaseUrl', () => {
  it('should fall back to the server url when no override is set', () => {
    expect(
      selectLogicFunctionApiBaseUrl({
        logicFunctionApiUrl: undefined,
        serverUrl: 'https://crm.example.com',
      }),
    ).toBe('https://crm.example.com');
  });

  it('should prefer the logic function api url when set', () => {
    expect(
      selectLogicFunctionApiBaseUrl({
        logicFunctionApiUrl: 'http://server:3000',
        serverUrl: 'https://crm.example.com',
      }),
    ).toBe('http://server:3000');
  });

  it('should fall back to the server url when the override is empty', () => {
    expect(
      selectLogicFunctionApiBaseUrl({
        logicFunctionApiUrl: '',
        serverUrl: 'https://crm.example.com',
      }),
    ).toBe('https://crm.example.com');
  });

  it('should strip a trailing slash from the selected url', () => {
    expect(
      selectLogicFunctionApiBaseUrl({
        logicFunctionApiUrl: 'http://server:3000/',
        serverUrl: 'https://crm.example.com',
      }),
    ).toBe('http://server:3000');
  });

  it('should return undefined when neither url is set', () => {
    expect(
      selectLogicFunctionApiBaseUrl({
        logicFunctionApiUrl: undefined,
        serverUrl: undefined,
      }),
    ).toBeUndefined();
  });
});
