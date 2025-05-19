import { cache } from "./cache";
import { MediaIncludes, Mention, MentionsMeta, ParsedMention } from "./types";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

export const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN || "";
export const USER_ID = process.env.TWITTER_USER_ID || "";
export const USERNAME = process.env.TWITTER_USERNAME || "";

const REQUIRED_ENV_VARS = [
  { name: "TWITTER_BEARER_TOKEN", value: BEARER_TOKEN },
  { name: "TWITTER_USER_ID", value: USER_ID },
  { name: "TWITTER_USERNAME", value: USERNAME },
];

export const defaultImageBlob = (() => {
  const loc = "./public/default.jpg";

  const file = fs.readFileSync(loc);
  const blob = new Blob([file], { type: "image/jpeg" });

  return blob;
})();

export const getMentions: (
  pagination_token?: string
) => Promise<(Mention & { twitterLink: string; imageBlob: Blob })[]> = async (
  pagination_token
) => {
  let query =
    "?media.fields=url&user.fields=username&expansions=attachments.media_keys,author_id";

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
  console.log("response data", data);

  if (!data) {
    throw new Error("Failed to parse mentions");
  }

  const _mentions = data.data as Mention[];
  if (!_mentions || !Array.isArray(_mentions)) {
    throw new Error("Invalid mentions data");
  }

  const meta = data.meta as MentionsMeta;
  if (!meta) {
    throw new Error("Invalid meta data");
  }

  const mediaIncludes = data.includes as MediaIncludes;
  if (!mediaIncludes) {
    throw new Error("Invalid media includes data");
  }

  const mentions: (Mention & { twitterLink: string; imageBlob: Blob })[] = [];

  for (let i = 0; i < _mentions.length; i++) {
    const mention = _mentions[i];

    let imageUrl;
    let twitterLink = `https://twitter.com/intent/user?user_id=${mention.author_id}`;

    const mediaKeys = mention?.attachments?.media_keys || [];
    for (let i = 0; i < mediaKeys.length; i++) {
      const mediaKey = mediaKeys[i];
      const media = mediaIncludes.media.find((m) => m.media_key === mediaKey);
      if (!media) continue;

      if (media.type === "photo" && media.url) {
        imageUrl = media.url;
        break;
      }
    }

    const imageBlob = imageUrl
      ? await fetch(imageUrl)
          .then((res) =>
            res.blob().catch((err) => {
              console.error(err);
              return null;
            })
          )
          .catch((err) => {
            console.error(err);
            return null;
          })
      : null;

    const user = mediaIncludes?.users?.find((u) => u.id === mention.author_id);
    if (user) {
      twitterLink = `https://twitter.com/${user.username}`;
    }

    mentions.push({
      ...mention,
      imageBlob: imageBlob || defaultImageBlob,
      twitterLink,
    });
  }

  return mentions;

  // if (meta.next_token) {
  //   const next_mentions = await getMentions(meta.next_token);
  //   if (next_mentions[0].id) cache.set("last-fetched-id", next_mentions[0].id);
  //   return [...mentions, ...next_mentions];
  // } else {
  //   return mentions;
  // }
};

export const parseAndGetRelevantMentions = (
  mentions: (Mention & { twitterLink: string; imageBlob: Blob })[]
) => {
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
        // "(Pump[\\s.]?fun|let(?:'|’)?s[\\s]?bonk[\\s.]?fun)", // ? match platform name
        "(pump\\s*fun|let(?:'|’)?s?\\s*bonk)", // ? match platform name
      "i"
    );

    const match = text.match(regex);
    if (!match) {
      return null;
    }

    const tickerSymbol = match[1]?.trim();
    const tickerName = match[2]?.trim();
    const _platformName = match[3]?.trim();

    // const imageUrl =  || defaultImageUrl;

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
      imageBlob: mention.imageBlob,
      twitterLink: mention.twitterLink,
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
      console.error(`%c${name} is not defined in env`, "color: red");
      process.exit(1);
    }
  }
  console.log("%cAll environment variables are defined", "color: green");
};

export const shutdown = (signal: string, jobs: { stop: () => void }[]) => {
  console.log(`\nReceived ${signal}, shutting down...`);

  for (let i = 0; i < jobs.length; i++) jobs[i].stop();
  console.log(`All ${jobs.length} job(s) stopped. Exiting process...`);
  process.exit(0);
};
