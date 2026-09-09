import { ApolloLink, Observable } from '@apollo/client';
import { getOperationAST } from 'graphql';

import {
  assertLocalFirstScopeIsCurrent,
  getCurrentLocalFirstScope,
} from '@/local-first/services/getCurrentLocalFirstScope';
import { overlayLocalFirstChanges } from '@/local-first/utils/overlayLocalFirstChanges';

// Fresh server rows must not hide edits that are still waiting to reconcile.
export const createLocalFirstJournalLink = () =>
  new ApolloLink((operation, forward) => {
    const scope = getCurrentLocalFirstScope();
    if (!scope || getOperationAST(operation.query)?.operation !== 'query')
      return forward(operation);
    return new Observable((observer) => {
      let cancelled = false;
      let pending = Promise.resolve();
      const subscription = forward(operation).subscribe({
        next: (response) => {
          pending = pending
            .then(async () => {
              const [
                { getLocalFirstDatabase },
                { initializeLocalFirstJournal, readLocalFirstJournal },
              ] = await Promise.all([
                import('@/local-first/services/getLocalFirstDatabase'),
                import('@/local-first/services/localFirstJournal'),
              ]);
              const database = await getLocalFirstDatabase(scope);
              await initializeLocalFirstJournal(database);
              const entries = await readLocalFirstJournal(database);
              assertLocalFirstScopeIsCurrent(scope);
              if (!cancelled)
                observer.next({
                  ...response,
                  data: overlayLocalFirstChanges(
                    response.data,
                    entries,
                  ) as typeof response.data,
                });
            })
            .catch((error: unknown) => {
              if (!cancelled) observer.error(error);
            });
        },
        error: (error) => {
          if (!cancelled) observer.error(error);
        },
        complete: () => {
          void pending.then(() => {
            if (!cancelled) observer.complete();
          });
        },
      });
      return () => {
        cancelled = true;
        subscription.unsubscribe();
      };
    });
  });
