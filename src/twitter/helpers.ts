import { cache } from "./cache";
import { Mention, MentionsMeta, ParsedMention } from "./types";
import fs from "fs";

const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN || "";
const USER_ID = process.env.TWITTER_USER_ID || "";
const USERNAME = process.env.TWITTER_USERNAME || "";

const REQUIRED_ENV_VARS = [
  { name: "TWITTER_BEARER_TOKEN", value: BEARER_TOKEN },
  { name: "TWITTER_USER_ID", value: USER_ID },
  { name: "TWITTER_USERNAME", value: USERNAME },
];

export const defaultImageUrl = (() => {
  const loc = "./public/default.jpg";

  const file = fs.readFileSync(loc);
  const base64 = file.toString("base64");

  return `data:image/jpg;base64,${base64}`;
})();

export const getMentions: (
  pagination_token?: string
) => Promise<Mention[]> = async (pagination_token) => {
  let query = "?";

  const lastFetchedId = cache.get("last-fetched-id");
  if (lastFetchedId) {
    query += `&since_id=${lastFetchedId}`;
  } else {
    const now = new Date();
    const start_time = new Date(now.getTime() - 1000 * 60 * 60 * 24); // 1 day ago

    query += `&start_time=${start_time.toISOString()}`;
  }

  if (pagination_token) {
    query += `&pagination_token=${pagination_token}`;
  }

  const response = await fetch(
    `https://api.twitter.com/2/users/${USER_ID}/mentions${query}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${BEARER_TOKEN}`,
      },
    }
  ).catch((err) => {
    console.error(err);
    return null;
  });
  if (!response) {
    throw new Error("Failed to fetch mentions");
  }

  const data = await response.json().catch((err) => {
    console.error(err);
    return null;
  });

  if (!data) {
    throw new Error("Failed to parse mentions");
  }

  const mentions = data.data as Mention[];
  if (!mentions || !Array.isArray(mentions)) {
    throw new Error("Invalid mentions data");
  }

  const meta = data.meta as MentionsMeta;
  if (!meta) {
    throw new Error("Invalid meta data");
  }

  if (meta.next_token) {
    const next_mentions = await getMentions(meta.next_token);
    return [...mentions, ...next_mentions];
  } else {
    return mentions;
  }
};

export const parseAndGetRelevantMentions = (mentions: Mention[]) => {
  const parsedMentions = mentions.map((mention) => {
    const text = mention?.text;
    if (!text) {
      return null;
    }

    const regex = new RegExp(
      `@${USERNAME}` + // ? match @username
        "\\s+" + // ? match multiple spaces
        "([A-Z0-9]+)" + // ? match ticker_symbol
        "\\s+" + // ? match multiple spaces
        "([\\w\\s'.-]+)" + // ? match ticker_name
        "\\s+" + // ? match multiple spaces
        "(Pump[\\s.]?fun|let(?:'|’)?s[\\s]?bonk[\\s.]?fun)", // ? match platform name
      "i"
    );

    const match = text.match(regex);
    if (!match) {
      return null;
    }

    const tickerSymbol = match[1]?.trim();
    const tickerName = match[2]?.trim();
    const _platformName = match[3]?.trim();
    const imageUrl = mention.media?.[0]?.media_url_https || defaultImageUrl;

    if (!tickerSymbol || typeof tickerSymbol !== "string") {
      return null;
    }

    if (!tickerName || typeof tickerName !== "string") {
      return null;
    }

    if (!_platformName || typeof _platformName !== "string") {
      return null;
    }

    const platformName = /pump/i.test(_platformName)
      ? "pump.fun"
      : /bonk/i.test(_platformName)
      ? "bonk.fun"
      : null;

    if (!platformName) {
      return null;
    }

    const parsedMention: ParsedMention = {
      id: mention.id,
      text: mention.text,
      tickerSymbol,
      tickerName,
      platformName,
      imageUrl,
    };

    return parsedMention;
  });

  const filteredMentions = parsedMentions
    .filter((mention) => {
      if (!mention) {
        return false;
      }

      if (mention.tickerName.length < 2) {
        return false;
      }

      if (mention.tickerSymbol.length < 2) {
        return false;
      }

      return true;
    })
    .filter((mention) => mention !== null);

  return filteredMentions;
};

export const init = async () => {
  console.log("\n\nChecking environment variables...");

  for (let i = 0; i < REQUIRED_ENV_VARS.length; i++) {
    const { name, value } = REQUIRED_ENV_VARS[i];

    if (value === undefined || value === "" || value === null) {
      console.error(`${name} is not defined in env`);
      process.exit(1);
    }
  }
  console.log("All environment variables are defined");
};

export const shutdown = (signal: string, jobs: { stop: () => void }[]) => {
  console.log(`\nReceived ${signal}, shutting down...`);

  for (let i = 0; i < jobs.length; i++) jobs[i].stop();
  console.log(`All ${jobs.length} job(s) stopped. Exiting process...`);
  process.exit(0);
};
