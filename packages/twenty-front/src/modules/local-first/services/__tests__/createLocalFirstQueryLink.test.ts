import { ApolloLink, gql, Observable } from '@apollo/client';
import { firstValueFrom } from 'rxjs';

import { createLocalFirstQueryLink } from '@/local-first/services/createLocalFirstQueryLink';

const QUERY = gql`
  query FindManyPeople {
    people {
      totalCount
    }
  }
`;
const LOCAL_RESULT = { data: { people: { totalCount: 2 } } };
const SERVER_RESULT = { data: { people: { totalCount: 3 } } };

const createChain = (
  resolve: Parameters<typeof createLocalFirstQueryLink>[0]['resolve'],
) => {
  const network = jest.fn(
    () =>
      new Observable<ApolloLink.Result>((observer) => {
        observer.next(SERVER_RESULT);
        observer.complete();
      }),
  );
  const chain = ApolloLink.from([
    createLocalFirstQueryLink({ operationName: 'FindManyPeople', resolve }),
    new ApolloLink(network),
  ]);
  const execute = () =>
    ApolloLink.execute(
      chain,
      { query: QUERY },
      { client: {} as ApolloLink.ExecuteContext['client'] },
    );

  return { network, execute };
};

describe('local-first query routing', () => {
  it('should answer from local storage without contacting the server', async () => {
    const { network, execute } = createChain(async () => LOCAL_RESULT);
    expect(await firstValueFrom(execute())).toEqual(LOCAL_RESULT);
    expect(network).not.toHaveBeenCalled();
  });

  it('should fall back to the server when the replica cannot answer a query', async () => {
    const { network, execute } = createChain(async () => null);
    expect(await firstValueFrom(execute())).toEqual(SERVER_RESULT);
    expect(network).toHaveBeenCalledTimes(1);
  });

  it('should fall back to the server when local storage fails', async () => {
    const { network, execute } = createChain(async () => {
      throw new Error('Storage unavailable');
    });
    expect(await firstValueFrom(execute())).toEqual(SERVER_RESULT);
    expect(network).toHaveBeenCalledTimes(1);
  });

  it('should not make a delayed network request after a query is cancelled', async () => {
    let finish: (result: null) => void = () => {};
    const result = new Promise<null>((resolve) => {
      finish = resolve;
    });
    const { network, execute } = createChain(() => result);
    const observer = jest.fn();
    const subscription = execute().subscribe(observer);
    subscription.unsubscribe();
    finish(null);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(observer).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
  });
});
