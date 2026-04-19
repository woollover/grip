import type { Database } from 'bun:sqlite';
import { ConfigRepo } from './config';
import { ArticleRepo } from './articles';
import { MicroRepo } from './micro';
import { MediaRepo } from './media';
import { PageRepo } from './pages';
import { ActivityRepo } from './activity';
import { DashboardRepo } from './dashboard';
import { TagRepo } from './tags';

export type { GripContext } from './types';
export type { PublicityConfig, SiteConfig } from './config';
export type { Article, ArticleAdmin, ArticleCounts } from './articles';
export type { MicroPost, MicroPostAdmin, MicroPostAp } from './micro';
export type { MediaFile } from './media';
export type { Page, PageAdmin } from './pages';
export type { Follower, Reply, NoteReply } from './activity';
export type { DashboardStats, EventRow } from './dashboard';

export class GripDb {
  readonly config: ConfigRepo;
  readonly articles: ArticleRepo;
  readonly micro: MicroRepo;
  readonly media: MediaRepo;
  readonly pages: PageRepo;
  readonly activity: ActivityRepo;
  readonly dashboard: DashboardRepo;
  readonly tags: TagRepo;

  constructor(readonly raw: Database) {
    this.config   = new ConfigRepo(raw);
    this.articles = new ArticleRepo(raw);
    this.micro    = new MicroRepo(raw);
    this.media    = new MediaRepo(raw);
    this.pages    = new PageRepo(raw);
    this.activity = new ActivityRepo(raw);
    this.dashboard = new DashboardRepo(raw);
    this.tags     = new TagRepo(raw);
  }
}
