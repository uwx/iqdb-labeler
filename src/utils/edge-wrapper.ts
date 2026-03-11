import edge from 'edge-js';

export function edgeFuncAsync<TIn, TOut>(
    funcCode:
        | string
        | {
              assemblyFile: string;
              typeName?: string;
              methodName?: string;
          },
) {
    const handler = edge.func<TIn, TOut>(funcCode);
    return (payload: TIn): Promise<TOut> =>
        new Promise((resolve, reject) => {
            handler(payload, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
}
