/** Runs tasks one at a time and refuses any beyond `limit`: a game looping a request can't flood the platform. */
export function limitedQueue(limit: number) {
  let taken = 0;
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    if (taken >= limit) return Promise.reject(new Error('Limit reached'));
    taken += 1;
    const next = tail.then(task, task);
    tail = next.catch(() => {});
    return next;
  };
}
