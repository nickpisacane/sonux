export type ProxyGetterFunc<T extends object> = <K extends keyof T>(
  key: K,
) => T[K];

export default <T extends object>(
  source: T,
  getter: ProxyGetterFunc<T> = key => source[key],
): Readonly<T> =>
  Object.keys(source).reduce(
    (proxy: Readonly<T>, key: string) => {
      Object.defineProperty(proxy, key, {
        get: () => getter(key as keyof T),
      });

      return proxy;
    },
    {} as Readonly<T>,
  );
