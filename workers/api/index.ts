import type { Env } from "./env";
import { handleRequest } from "./handler";
import { sendQueuedEmails } from "./notify";

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },

  // Runs on the cron schedule in wrangler.toml: sends queued email notifications.
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(
      sendQueuedEmails(env).then((s) =>
        console.log(
          `emails: ${s.sent} sent, ${s.failed} failed, ${s.skipped} skipped`,
        ),
      ),
    );
  },
};
