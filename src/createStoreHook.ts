import {useState, useEffect} from 'react';
import {Subject, Observable} from 'rxjs';
import {scan, filter, map} from 'rxjs/operators';

import memoize from './memoize';
import createProxy from './createProxy';

type Update<T extends object, K extends keyof T> = {key: K; value: T[K]};

type Changes<T extends object> = {
  [K in keyof T]: {key: K; previousValue: T[K]; value: T[K]}
};

export type StoreSet<T extends object> = <K extends keyof T>(
  key: K,
) => (value: T[K]) => void;

export type StoreOn<T extends object> = <K extends keyof T>(
  key: K,
) => Observable<T[K]>;

export type StoreOnAll<T extends object> = () => Observable<
  Changes<T>[keyof T]
>;

export interface Store<T extends object> {
  readonly set: StoreSet<T>;
  readonly on: StoreOn<T>;
  readonly onAll: StoreOnAll<T>;
}

export type StorePlugin<T extends object> = (
  stateProxy: Readonly<T>,
  store: Store<T>,
) => Store<T>;

export type StoreHook<T extends object> = () => [T, Store<T>];

const applyPlugins = <T extends object>(
  stateProxy: Readonly<T>,
  store: Store<T>,
  ...plugins: StorePlugin<T>[]
) => plugins.forEach(plugin => plugin(stateProxy, store));

export default <T extends object>(
  initialState: T,
  ...plugins: StorePlugin<T>[]
): StoreHook<T> => {
  let state: T = {...initialState};
  const updateSubject = new Subject<Update<T, keyof T>>();
  const allSubject = new Subject<Changes<T>[keyof T]>();
  const stateObservable = updateSubject.pipe(
    scan(
      (state: T, {key, value}: Update<T, keyof T>): T => ({
        ...state,
        [key]: value,
      }),
      initialState,
    ),
  );

  stateObservable.subscribe(newState => {
    state = {...newState};
  });

  const set = memoize(<K extends keyof T>(key: K) => (value: T[K]) => {
    const change: Changes<T>[K] = {
      key,
      value,
      previousValue: state[key],
    };

    // TODO: Figure out why TypeScript doesn't like this.
    allSubject.next(change as any);

    updateSubject.next({key, value});
  }) as StoreSet<T>;

  const on = memoize(
    <K extends keyof T>(key: K) =>
      updateSubject.pipe(
        filter(u => u.key === key),
        map(u => u.value),
      ) as Observable<T[K]>,
  ) as StoreOn<T>;

  const onAll: StoreOnAll<T> = () => allSubject.asObservable();

  const createStoreInstance = () => ({set, on, onAll});

  applyPlugins(
    createProxy(state, key => state[key]),
    createStoreInstance(),
    ...plugins,
  );

  return () => {
    const [localState, setLocalState] = useState({...state});

    useEffect(() => {
      const sub = stateObservable.subscribe(setLocalState);

      return () => sub.unsubscribe();
    }, [setLocalState]);

    return [localState, createStoreInstance()];
  };
};
