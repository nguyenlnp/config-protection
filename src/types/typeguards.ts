import { Context } from "./context";

export function isPushEvent(context: Context): context is Context<"push"> {
  return context.eventName === "push";
}
