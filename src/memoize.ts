export default <T extends (...args: any[]) => ReturnType<T>>(fn: T): T => {
  const cache = new WeakMap<any, ReturnType<T>>();

  return ((...args: any[]): ReturnType<T> => {
    if (cache.has(args[0])) {
      return cache.get(args[0]) as ReturnType<T>;
    }

    const value: ReturnType<T> = fn(...args);
    cache.set(args[0], value);

    return value;
  }) as T;
};
