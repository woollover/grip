export interface ApConfig {
  enabled: true;
  username: string;
  acceptReplies: boolean;
  actorUrl: string;
  baseUrl: string;
  domain: string;
}

export function loadApConfig(toml: any, domain: string): ApConfig | null {
  const ap = toml?.activitypub;
  if (!ap?.enabled || !ap?.username) return null;
  return {
    enabled: true,
    username: ap.username,
    acceptReplies: ap.accept_replies === true,
    domain,
    baseUrl: `https://${domain}`,
    actorUrl: `https://${domain}/activitypub/actor`,
  };
}
