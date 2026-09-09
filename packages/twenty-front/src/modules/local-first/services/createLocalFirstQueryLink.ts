import { ApolloLink, Observable } from '@apollo/client';

// A local answer completes without sending a network request. Unsupported or
// unavailable local reads retain Apollo's normal network behavior.
export const createLocalFirstQueryLink = ({
  operationName,
  resolve,
}: {
  operationName: string;
  resolve: (
    operation: ApolloLink.Operation,
  ) => Promise<ApolloLink.Result | null>;
}) =>
  new ApolloLink((operation, forward) => {
    if (operation.operationName !== operationName) return forward(operation);

    return new Observable((observer) => {
      let isCancelled = false;
      let subscription:
        | ReturnType<ReturnType<ApolloLink.ForwardFunction>['subscribe']>
        | undefined;

      void resolve(operation)
        .catch(() => null)
        .then((result) => {
          if (isCancelled) return;
          if (result !== null) {
            observer.next(result);
            observer.complete();
          } else {
            subscription = forward(operation).subscribe(observer);
          }
        })
        .catch((error: unknown) => {
          if (!isCancelled) observer.error(error);
        });

      return () => {
        isCancelled = true;
        subscription?.unsubscribe();
      };
    });
  });
