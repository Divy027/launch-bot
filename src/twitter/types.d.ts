export interface Mention {
  text: string;
  edit_history_tweet_ids: string[];
  id: string;
  media: {
    media_url_https: string;
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
  imageUrl: string;
}

export type CacheKeys = "last-fetched-id";
