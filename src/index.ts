import { Context } from "./types";
import { isPushEvent } from "./types/typeguards";
import { handlePushEvent } from "./handlers/push-handler";

export async function runPlugin(context: Context) {
  const { logger, eventName } = context;

  if (isPushEvent(context)) {
    return await handlePushEvent(context);
  }

  logger.error(`Unsupported event: ${eventName}`);
}
