import app from "./app";
import { logger } from "./lib/logger";
import {seed} from "./lib/seed";
import {refreshDaily} from "./lib/tracker";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

seed().then(()=>refreshDaily()).then(()=>app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
})).catch(err=>{logger.error({err},"Initialization failed");process.exit(1);});
setInterval(()=>{refreshDaily().catch(err=>logger.error({err},"Daily checks failed"));},60000).unref();
