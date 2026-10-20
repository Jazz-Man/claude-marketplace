const POLL_INTERVAL_MS = 25;

const poll = async (
  condition: () => boolean,
  deadline: number,
): Promise<boolean> => {
  if (condition()) {
    return true;
  }
  if (Date.now() >= deadline) {
    return false;
  }
  await new Promise((resolve) => {
    setTimeout(resolve, POLL_INTERVAL_MS);
  });
  return poll(condition, deadline);
};

export async function waitFor(
  condition: () => boolean,
  timeoutMs = 10_000,
): Promise<void> {
  const satisfied = await poll(condition, Date.now() + timeoutMs);
  if (!satisfied) {
    throw new Error(`waitFor: condition not met within ${String(timeoutMs)}ms`);
  }
}
