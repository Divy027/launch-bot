import pLimit from "p-limit";
import * as h from "./twitter/helpers";
import { LoopJob } from "./twitter/LoopJob";
import { ParsedMention } from "./twitter/types";
import { getBonkUri, getPumpURI } from "./web3/utils";
import { launchPumpToken } from "./web3/pumpFun";
import { launchBonkToken } from "./web3/letsBonk";

h.init().then(() => {
  const job = new LoopJob("Mentions Job", jobFunction, 60 * 1000);
  job.start();

  process.on("SIGINT", () => h.shutdown("SIGINT", [job]));
  process.on("SIGTERM", () => h.shutdown("SIGTERM", [job]));
});

const jobFunction = async () => {
  const limit = pLimit(10);

  const mentions = await h.getMentions();
  const parsedMentions = h.parseAndGetRelevantMentions(mentions);
  console.log("parsedMentions", parsedMentions);

  await limit(() => parsedMentions.forEach(processMention));
};

const processMention = async (mention: ParsedMention) => {
  const { tickerSymbol, tickerName, platformName, imageBlob, twitterLink } =
    mention;

  if (platformName === "pump.fun") {
    console.log("Pump Mention", mention);
    const uri = await getPumpURI(
      tickerName,
      tickerSymbol,
      twitterLink,
      imageBlob
    );
    if (uri) {
      const sig = await launchPumpToken(tickerName, tickerSymbol, uri );
      console.log(`TX (${tickerName} + ${tickerSymbol} + PumpFun): ${sig}`);
    } else {
      console.log(`Skipped (${tickerName} + ${tickerSymbol}) PumpFun: NO URI`)
    }
 

    // ? Process pump mentions here
  } else if (platformName === "bonk.fun") {
    console.log("Bonk Mention", mention);
    const uri = await getBonkUri(
      tickerName,
      tickerSymbol,
      twitterLink,
      imageBlob
    );
    if (uri) {
      const sig = await launchBonkToken(tickerName, tickerSymbol, uri as string)
      console.log(`TX (${tickerName} + ${tickerSymbol} + LetsBonk): ${sig}`);
    }else {
      console.log(`Skipped (${tickerName} + ${tickerSymbol}) LetsBonk: NO URI}`);
    }


    // ? Process bonk mentions here
  }
};
