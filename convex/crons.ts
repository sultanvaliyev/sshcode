import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "health-check",
  { minutes: 5 },
  internal.health.checkAllServers
);

export default crons;
