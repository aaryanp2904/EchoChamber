export interface GraphNode {
  id: string;
  type: 'subreddit' | 'topic';
  group: number;
  val: number; // Represents interest level (radius)
  desc?: string; // Description of why this node exists
  lastUpdated?: number; // Timestamp to trigger visual flash

  // d3 simulation properties
  index?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  value: number;

  // d3 simulation properties
  index?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface GuardAnalysis {
  isProvocative: boolean;
  reasoning: string;
  manipulationType?: string; // e.g. "Rage Bait", "Echo Chamber Reinforcement"
}

export interface RedditPost {
  id: string;
  title: string;
  subreddit: string;
  author: string;
  content: string;
  upvotes: number;
  comments: number;
  topicId: string; // Links back to a GraphNode.id
  timestamp: string;
  userVote?: 'up' | 'down' | null; // Track user interaction
  guardResult?: GuardAnalysis; // The result from the AIsolation Guard
}

export enum AppState {
  LOGIN,
  ANALYZING,
  GRAPH_VIEW,
  SIMULATOR
}