export interface Mention {
  text: string;
  edit_history_tweet_ids: string[];
  id: string;
  author_id: string;
  attachments: {
    media_keys: string[];
  };
}

export interface MediaIncludes {
  media: {
    media_key: string;
    type: string;
    url: string;
  }[];
  users: {
    id: string;
    name: string;
    username: string;
  }[];
}

export interface MentionsMeta {
  next_token: string;
  result_count: number;
  newest_id: string;
  oldest_id: string;
}

export interface ParsedMention {
  id: string;
  text: string;
  tickerSymbol: string;
  tickerName: string;
  platformName: "pump.fun" | "bonk.fun";
  imageBlob: Blob;
  twitterLink: string;
}

export type CacheKeys = "last-fetched-id";
