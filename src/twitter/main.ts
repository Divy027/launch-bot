import pLimit from "p-limit";
import * as h from "./helpers";
import { LoopJob } from "./LoopJob";
import { ParsedMention } from "./types";

h.init().then(() => {
  const job = new LoopJob("Mentions Job", jobFunction, 60 * 1000);
  // job.start();
  console.log("default image url", h.defaultImageUrl);

  process.on("SIGINT", () => h.shutdown("SIGINT", [job]));
  process.on("SIGTERM", () => h.shutdown("SIGTERM", [job]));
});

const jobFunction = async () => {
  const limit = pLimit(10);

  const mentions = await h.getMentions();
  const parsedMentions = h.parseAndGetRelevantMentions(mentions);
  await limit(() => parsedMentions.forEach(processMention));
};

const processMention = (mention: ParsedMention) => {
  const { id, text, tickerSymbol, tickerName, platformName, imageUrl } =
    mention;

  if (platformName === "pump.fun") {
    console.log("Pump Mention", mention);

    // ? Process pump mentions here
  } else if (platformName === "bonk.fun") {
    console.log("Bonk Mention", mention);

    // ? Process bonk mentions here
  }
};
