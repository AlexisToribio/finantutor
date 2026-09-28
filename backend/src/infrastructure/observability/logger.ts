type LogFields = Record<string, unknown>;

function emit(level: "info" | "error", event: string, fields: LogFields): void {
  const line = JSON.stringify({
    service: "bff",
    level,
    event,
    ...fields,
  });
  if (level === "error") {
    console.error(line);
    return;
  }
  console.log(line);
}

export const logger = {
  info(event: string, fields: LogFields = {}): void {
    emit("info", event, fields);
  },
  error(event: string, fields: LogFields = {}): void {
    emit("error", event, fields);
  },
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "Error";
}
