import { GoogleGenAI, Type } from "@google/genai";
import { GraphData, RedditPost, GraphNode, GuardAnalysis } from "../types";

// NOTE: Process.env.API_KEY is injected by the runtime environment.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = "gemini-2.5-flash";

interface RedditActivity {
  subreddit: string;
  title?: string;
  body?: string;
  score: number;
  kind: string;
}

/**
 * Fetches public activity from Reddit for a given username.
 * Implements a multi-proxy strategy to reliably bypass CORS.
 */
async function fetchRedditUserActivity(username: string): Promise<RedditActivity[] | null> {
  const targetUrl = `https://www.reddit.com/user/${username}.json?limit=50`;

  // Strategy 1: api.allorigins.win (JSON Wrapper)
  try {
    console.log(`Attempting to fetch Reddit data via AllOrigins for ${username}...`);
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
    
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error(`AllOrigins returned ${response.status}`);
    
    const wrapper = await response.json();
    if (!wrapper.contents) throw new Error("AllOrigins returned empty contents");

    const redditJson = JSON.parse(wrapper.contents);
    return parseRedditResponse(redditJson);
  } catch (error) {
    console.warn("AllOrigins proxy failed, attempting fallback...", error);
  }

  // Strategy 2: corsproxy.io (Direct Proxy)
  try {
    console.log(`Attempting to fetch Reddit data via CorsProxy for ${username}...`);
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
    
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error(`CorsProxy returned ${response.status}`);
    
    const redditJson = await response.json();
    return parseRedditResponse(redditJson);

  } catch (error) {
    console.warn("All proxies failed. Falling back to AI simulation.", error);
    return null;
  }
}

function parseRedditResponse(json: any): RedditActivity[] {
    if (json.error) throw new Error(`Reddit API Error: ${json.error}`);
    if (!json.data || !json.data.children) throw new Error("Invalid Reddit JSON structure");

    const children = json.data.children;
    if (children.length === 0) return [];

    return children.map((child: any) => ({
      kind: child.kind, // t1 = comment, t3 = post
      subreddit: child.data.subreddit,
      title: child.data.title, // Only for posts
      body: child.data.body || child.data.selftext, // body for comments, selftext for posts
      score: child.data.score,
    }));
}

/**
 * Generates an interest graph based on a username, using real data if available.
 */
export const generateUserGraph = async (username: string): Promise<GraphData> => {
  // 1. Attempt to get real data via proxy
  const activity = await fetchRedditUserActivity(username);
  
  let systemContext = "";

  if (activity && activity.length > 0) {
    // Summarize activity for the context window to stay within token limits
    const activitySummary = activity.slice(0, 40).map(a => {
      const type = a.kind === 't1' ? 'Comment' : 'Post';
      const cleanBody = (a.body || "").replace(/\s+/g, ' ').substring(0, 120);
      const title = a.title ? `Title: "${a.title}"` : '';
      return `- [r/${a.subreddit}] ${type} (Score: ${a.score}) ${title} "${cleanBody}"`;
    }).join('\n');

    systemContext = `
      You are analyzing the REAL Reddit activity history for user "u/${username}".
      
      ACTIVITY LOG (Recent Interactions):
      ${activitySummary}

      Task:
      1. Identify the specific SUBREDDITS the user engages with most (e.g., 'r/gaming', 'r/technology'). Create 'subreddit' nodes for these.
      2. Identify abstract TOPICS or concepts based on the content of their comments (e.g., 'Competitive FPS', 'Ethical AI', 'NBA Playoffs'). Create 'topic' nodes for these.
      3. Link 'subreddit' nodes to related 'topic' nodes.
      4. Link 'subreddit' nodes to other related 'subreddit' nodes if they share themes.
      5. The 'val' (value) should represent the intensity of interest (Range 15-50).
    `;
  } else {
    systemContext = `
      Could not fetch real Reddit data for "u/${username}" (Profile is private, empty, or API failed).
      
      Task:
      1. Infer likely SUBREDDITS and TOPICS based on the username archetype "${username}".
      2. Create a network of 8-15 nodes.
      3. Mix 'subreddit' nodes (e.g. 'r/pics') and 'topic' nodes (e.g. 'Photography').
    `;
  }

  const systemInstruction = `
    ${systemContext}
    
    Return a JSON object with 'nodes' and 'links'.
    
    Nodes Schema:
    - id: Name (e.g., "r/gaming" or "PC Building")
    - type: "subreddit" OR "topic"
    - group: integer 1-5 (Cluster ID)
    - val: integer 15-50 (Size)
    - desc: Brief explanation of this interest.

    Links Schema:
    - source: Node ID
    - target: Node ID
    - value: integer 1-5
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Generate interest graph for u/${username}`,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          nodes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                type: { type: Type.STRING, enum: ["subreddit", "topic"] },
                group: { type: Type.INTEGER },
                val: { type: Type.INTEGER },
                desc: { type: Type.STRING },
              },
              required: ["id", "type", "group", "val", "desc"],
            },
          },
          links: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                source: { type: Type.STRING },
                target: { type: Type.STRING },
                value: { type: Type.INTEGER },
              },
              required: ["source", "target", "value"],
            },
          },
        },
        required: ["nodes", "links"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  return JSON.parse(text) as GraphData;
};

/**
 * Generates a single new Reddit post based on the current interest graph weights.
 */
export const generateNextPost = async (nodes: GraphNode[]): Promise<RedditPost> => {
  // Flatten nodes into a weighted list string for the prompt
  const interestProfile = nodes
    .map(n => `[${n.type.toUpperCase()}] ID: "${n.id}" (Weight: ${n.val})`)
    .join("\n");

  const isProvocative = Math.random() < 0.33; // 1 in 3 chance

  let toneInstruction = "";
  if (isProvocative) {
    toneInstruction = `
    4. **MODE: UNHINGED / EXTREME / IRRATIONAL**
       - The post content MUST be provocative, irrational, or borderline conspiracy theory related to the topic.
       - Make it an extreme "hot take", an angry rant, or visibly delusional.
       - It should be polarized and designed to trigger reactions.
       - Example: If the topic is "Gaming", claim that "60fps is actually bad for your eyes".
       - Example: If "Politics", make a wild, nonsensical claim.
       - The title should be aggressive or clickbaity.
    `;
  } else {
    toneInstruction = `
    4. **MODE: NORMAL / ENGAGING**
       - Generate a typical, reasonable, and engaging post for the subreddit.
       - Can be a question, a cool image description, news, or a funny observation.
       - It should be a standard quality post that fits the community vibes.
    `;
  }

  const systemInstruction = `
    You are a Reddit Simulator Engine.
    
    Input: A list of User Interests (Subreddits and Topics) with Weights.
    
    Task: 
    1. Select ONE node from the list to base the post on. Probability matches Weight.
    2. If a 'subreddit' node is selected, the post MUST be for that subreddit.
    3. If a 'topic' node is selected, CHOOSE a relevant subreddit for that topic.
    ${toneInstruction}
    5. 'topicId' in response MUST match the ID of the selected node.
    
    Output JSON structure matches the schema.
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Available Nodes:\n${interestProfile}\n\nGenerate one new post.`,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          subreddit: { type: Type.STRING },
          author: { type: Type.STRING },
          content: { type: Type.STRING },
          topicId: { type: Type.STRING },
        },
        required: ["title", "subreddit", "author", "content", "topicId"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  const data = JSON.parse(text);
  
  // Sanitize subreddit name (remove r/ prefix if AI added it doubly)
  const cleanSubreddit = data.subreddit.replace(/^r\//, '');

  const isViral = Math.random() > 0.92;
  // Provocative posts have a higher chance of high comment counts (arguments)
  const isVolatile = isProvocative && Math.random() > 0.4;

  const baseUpvotes = Math.floor(Math.random() * 800) + 20;
  
  const comments = (isViral || isVolatile) 
    ? Math.floor(Math.random() * 3000) + 500
    : Math.floor(Math.random() * 100);

  return {
    id: crypto.randomUUID(),
    upvotes: isViral ? baseUpvotes * 40 : baseUpvotes,
    comments: comments,
    timestamp: "Just now",
    ...data,
    subreddit: cleanSubreddit
  };
};

/**
 * THE AISOLATION GUARD
 * A separate system that analyzes posts for manipulative content.
 */
export const analyzePostRisk = async (post: RedditPost, nodes: GraphNode[]): Promise<GuardAnalysis> => {
  // Find the node this post is based on to provide "Target" context
  const relatedNode = nodes.find(n => n.id === post.topicId);
  
  // Construct a highly specific user context for the Guard to analyze personalization
  const userContext = relatedNode 
    ? `
      TARGETED INTEREST NODE:
      - ID: "${relatedNode.id}"
      - Type: ${relatedNode.type}
      - Interest Level (Weight): ${relatedNode.val} (Scale 10-180)
      - Description: "${relatedNode.desc || 'No description available.'}"
      ` 
    : "TARGET: General / Broad Appeal (No specific graph node linked).";

  const systemInstruction = `
    You are "AIsolation Guard", a Safety Sentinel AI layer.
    
    OBJECTIVE:
    Detect if the provided Reddit post is "Provocative AI Content" designed to manipulate the specific user based on their interest graph.
    
    USER CONTEXT (The specific psychological lever available to the AI):
    ${userContext}
    
    CRITERIA FOR FLAGGING:
    1. **Rage Bait**: Intentionally infuriating takes on the specific topic.
    2. **Echo Chamber Reinforcement**: Extreme validation of the specific interest to radicalize.
    3. **Fear Mongering**: Irrational threats related to the specific interest.
    4. **Polarization**: Forcing a "us vs them" mentality regarding the interest.
    5. **Identity Attack**: Challenging the validity of the user's interest group.

    RESPONSE FORMAT:
    If the post is clearly manipulative/irrational/extreme:
    - isProvocative: true
    - reasoning: A specific explanation linking the USER CONTEXT to the CONTENT.
      * Template: "Targets user's [High/Low] interest in [Topic] by using [Tactic] to [Intended Effect]."
      * Example: "Targets user's high interest in 'Stock Market' by using fear-mongering about a total crash to induce panic."
      * Example: "Exploits user's dedication to 'PC Gaming' by validating elitist viewpoints to reinforce echo chamber behavior."
    - manipulationType: Short tag (e.g. "Rage Bait", "Identity Attack", "Echo Chamber").

    If the post is normal/reasonable/neutral:
    - isProvocative: false
    - reasoning: "Content appears within normal discourse parameters."
    - manipulationType: null
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `
      Title: ${post.title}
      Subreddit: r/${post.subreddit}
      Body: ${post.content}
    `,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isProvocative: { type: Type.BOOLEAN },
          reasoning: { type: Type.STRING },
          manipulationType: { type: Type.STRING },
        },
        required: ["isProvocative", "reasoning", "manipulationType"],
      },
    },
  });

  const text = response.text;
  if (!text) return { isProvocative: false, reasoning: "Analysis failed." };
  
  return JSON.parse(text) as GuardAnalysis;
};


/**
 * Searches the context of the graph to answer user queries about their own data.
 */
export const searchGraphContext = async (query: string, nodes: GraphNode[]): Promise<string> => {
  const context = nodes.map(n => `${n.type === 'subreddit' ? 'r/' : 'Topic: '}${n.id} (Interest Level: ${n.val}) - ${n.desc}`).join('\n');
  
  const systemInstruction = `
    You are the "Echo Chamber" AI. You are analyzing a knowledge graph built from a user's Reddit history.
    
    Context (The User's Interests):
    ${context}
    
    User Query: "${query}"
    
    Task:
    Answer the query strictly based on the provided context. 
    - If they ask what they like, summarize the high-value nodes.
    - If they ask about a specific topic, explain why it's in their graph based on the descriptions.
    - Keep the tone analytical but conversational. 
    - Keep it under 50 words.
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: query,
    config: {
      systemInstruction,
    }
  });

  return response.text || "I couldn't find a clear answer in your interest graph.";
};