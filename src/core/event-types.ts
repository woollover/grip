// All GRIP events. APPEND-ONLY — never delete or modify past events.

export type GripEvent =
  // Articles
  | { type: 'ArticleCreated';     id: string; title: string; slug: string; body: string; tags: string[] }
  | { type: 'ArticleRevised';     id: string; title: string; body: string; tags: string[] }
  | { type: 'ArticlePublished';   id: string }
  | { type: 'ArticleUnpublished'; id: string }

  // Micro-posts
  | { type: 'MicroPostCreated';   id: string; body: string }
  | { type: 'MicroPostRetracted'; id: string }   // exists, hidden — NOT deleted
  | { type: 'MicroPostRestored';  id: string }   // un-retract — full history preserved

  // Static pages
  | { type: 'PageCreated';        id: string; title: string; slug: string; body: string }
  | { type: 'PageRevised';        id: string; title?: string; slug?: string; body?: string }
  | { type: 'PagePublished';      id: string }
  | { type: 'PageUnpublished';    id: string }

  // Media
  | { type: 'MediaUploaded';      id: string; filename: string; mimeType: string; path: string; altText?: string }
  | { type: 'MediaTagged';        id: string; tags: string[] }

  // Auth audit log — sovereign record of access
  | { type: 'AuthAttempt';        success: boolean; ip: string }

  // Site configuration — identity changes are meaningful acts, recorded as history
  | { type: 'SiteConfigUpdated'; title?: string; description?: string; domain?: string; homeIntro?: string }
