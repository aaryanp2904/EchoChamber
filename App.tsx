import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, GraphData, RedditPost, GraphNode } from './types';
import { generateUserGraph, generateNextPost, searchGraphContext, analyzePostRisk } from './services/geminiService';
import InterestGraph from './components/InterestGraph';
import PostCard from './components/PostCard';
import PostDetail from './components/PostDetail';
import LoadingScreen from './components/LoadingScreen';
import { BrainCircuit, Play, Search, TrendingUp, Battery, Wifi, Signal, MessageCircleQuestion, X, Shield, ShieldAlert } from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.LOGIN);
  const [username, setUsername] = useState('');
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isLoadingPost, setIsLoadingPost] = useState(false);
  const [activePost, setActivePost] = useState<RedditPost | null>(null);
  const [isGuardEnabled, setIsGuardEnabled] = useState(false);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<string | null>(null);
  
  // Used for infinite scroll
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // --- Login Handler ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      setState(AppState.ANALYZING);
    }
  };

  // --- Analysis Completion ---
  const handleAnalysisComplete = async () => {
    try {
      const data = await generateUserGraph(username);
      setGraphData(data);
      setState(AppState.GRAPH_VIEW);
    } catch (error) {
      console.error("Failed to generate graph", error);
      alert("AI Generation failed. Try again.");
      setState(AppState.LOGIN);
    }
  };

  // --- Simulator Start ---
  const startSimulator = async () => {
    setState(AppState.SIMULATOR);
    // Generate first post immediately
    fetchNewPost();
  };

  // --- Fetch Post Logic (Lazy) ---
  const fetchNewPost = useCallback(async () => {
    if (isLoadingPost) return;
    setIsLoadingPost(true);
    try {
      // 1. Generate the post content (Lazy Generator)
      const newPost = await generateNextPost(graphData.nodes);
      
      // 2. Add to feed immediately for responsiveness
      setPosts(prev => [...prev, newPost]);
      
      // 3. Run Guard Analysis in "Background" (Parallel separate agent)
      // This happens whether the guard is visible or not, simulating the separate system layer
      analyzePostRisk(newPost, graphData.nodes).then(riskResult => {
          setPosts(currentPosts => 
              currentPosts.map(p => 
                  p.id === newPost.id ? { ...p, guardResult: riskResult } : p
              )
          );
          
          // Also update active post if it's the one we're looking at
          setActivePost(currentActive => {
              if (currentActive && currentActive.id === newPost.id) {
                  return { ...currentActive, guardResult: riskResult };
              }
              return currentActive;
          });
      });

    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingPost(false);
    }
  }, [graphData.nodes, isLoadingPost]);

  // --- Infinite Scroll Observer ---
  useEffect(() => {
    if (state !== AppState.SIMULATOR) return;
    // Don't fetch more if viewing details to avoid background updates being distracting
    if (activePost) return; 

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isLoadingPost) {
        fetchNewPost();
      }
    }, { threshold: 0.5 });

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [state, isLoadingPost, fetchNewPost, activePost]);

  // --- Interaction Logic (Realtime Graph & Vote Updates) ---
  const handleInteraction = (type: 'upvote' | 'downvote' | 'click', topicId: string, postId: string) => {
    // 1. Calculate logic based on current state (posts) rather than inside the setter to avoid closure issues
    const currentPost = posts.find(p => p.id === postId);
    if (!currentPost) return;

    let weightChange = 0;
    let newVote: 'up' | 'down' | null = currentPost.userVote || null;

    if (type === 'click') {
        weightChange = 5;
    } else if (type === 'upvote') {
        if (currentPost.userVote === 'up') {
          newVote = null; // Toggle off
          weightChange = -25;
        } else {
          newVote = 'up';
          // If it was down (-20), we go to neutral (+20) then to up (+25) = +45 total
          weightChange = currentPost.userVote === 'down' ? 45 : 25;
        }
    } else if (type === 'downvote') {
        if (currentPost.userVote === 'down') {
          newVote = null; // Toggle off
          weightChange = 20;
        } else {
          newVote = 'down';
          // If it was up (+25), we go to neutral (-25) then to down (-20) = -45 total
          weightChange = currentPost.userVote === 'up' ? -45 : -20;
        }
    }

    // 2. Update Post State
    setPosts(prevPosts => prevPosts.map(p => {
      if (p.id !== postId) return p;
      if (type === 'click') return p; // Click doesn't change post object visual state unless we track views
      return { ...p, userVote: newVote };
    }));

    // 3. Sync Active Post State if Open
    if (activePost && activePost.id === postId) {
       setActivePost(prev => {
          if (!prev) return null;
          if (type === 'click') return prev;
          return { ...prev, userVote: newVote };
       });
    }

    // 4. Update Graph Data with FLASH effect
    if (weightChange !== 0) {
      setGraphData(prevData => {
        // We create a new array to trigger React re-render
        const newNodes = prevData.nodes.map(node => {
          // Check for exact ID match
          if (node.id === topicId) {
            // Clamp value between 10 and 180
            const newVal = Math.max(10, Math.min(180, node.val + weightChange));
            return { 
                ...node, 
                val: newVal,
                lastUpdated: Date.now() // Timestamp triggers the D3 flash transition in InterestGraph
            };
          }
          return node;
        });
        return { ...prevData, nodes: newNodes };
      });
    }
  };

  // --- Graph Search Handler ---
  const handleGraphSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchResult(null);
    try {
        const answer = await searchGraphContext(searchQuery, graphData.nodes);
        setSearchResult(answer);
    } catch (error) {
        setSearchResult("Neural network unavailable.");
    } finally {
        setIsSearching(false);
    }
  };

  // --- Render Methods ---

  if (state === AppState.LOGIN) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-grid-pattern">
        <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 p-8 rounded-2xl shadow-2xl">
          <div className="flex items-center justify-center mb-6">
            <BrainCircuit className="w-12 h-12 text-orange-500 mr-3" />
            <h1 className="text-3xl font-bold tracking-tight">EchoChamber</h1>
          </div>
          <p className="text-neutral-400 text-center mb-8">
            Enter your Reddit username to analyze your digital footprint and enter a personalized simulation.
          </p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-neutral-500" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-neutral-700 rounded-lg leading-5 bg-neutral-950 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-white transition sm:text-sm"
                placeholder="reddit_username"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
            >
              Analyze Profile
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (state === AppState.ANALYZING) {
    return <LoadingScreen username={username} onComplete={handleAnalysisComplete} />;
  }

  if (state === AppState.GRAPH_VIEW) {
    return (
      <div className="min-h-screen flex flex-col items-center p-8 animate-fade-in">
        <header className="w-full max-w-5xl flex justify-between items-center mb-8">
          <div className="flex items-center space-x-3">
            <BrainCircuit className="w-8 h-8 text-orange-500" />
            <h2 className="text-2xl font-bold">Your Interest Graph</h2>
          </div>
          <button 
            onClick={startSimulator}
            className="flex items-center space-x-2 bg-white text-black px-6 py-2 rounded-full font-bold hover:bg-gray-200 transition-colors"
          >
            <Play size={18} fill="currentColor" />
            <span>Enter Simulator</span>
          </button>
        </header>

        <div className="flex flex-col md:flex-row gap-8 w-full max-w-6xl flex-1">
          <div className="flex-1 h-[500px] md:h-auto relative">
             <InterestGraph 
                data={graphData} 
                width={800} 
                height={600} 
                className="w-full h-full shadow-2xl"
                onNodeClick={setSelectedNode}
             />
             <div className="absolute top-4 left-4 bg-black/50 backdrop-blur px-3 py-1 rounded text-xs text-neutral-400 pointer-events-none">
               <span className="inline-block w-2 h-2 rounded-full bg-orange-500 mr-2"></span> Subreddits
               <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 ml-3 mr-2"></span> Topics
             </div>
          </div>
          
          <div className="w-full md:w-80 bg-neutral-900 border border-neutral-800 rounded-xl p-6">
            <h3 className="text-lg font-bold mb-4 border-b border-neutral-800 pb-2">Node Details</h3>
            {selectedNode ? (
              <div className="animate-fade-in">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xl font-bold ${selectedNode.type === 'subreddit' ? 'text-orange-500' : 'text-indigo-400'}`}>
                    {selectedNode.type === 'subreddit' ? `r/${selectedNode.id.replace('r/', '')}` : selectedNode.id}
                  </span>
                  <span className="bg-neutral-800 text-xs px-2 py-1 rounded text-neutral-400 uppercase font-bold tracking-wider">
                    {selectedNode.type}
                  </span>
                </div>
                <div className="mb-4">
                   <div className="text-xs text-neutral-500 mb-1">Interest Level</div>
                   <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-white h-full transition-all duration-500" style={{ width: `${Math.min(100, (selectedNode.val / 150) * 100)}%` }}></div>
                   </div>
                </div>
                <p className="text-sm text-neutral-300 leading-relaxed">
                  {selectedNode.desc}
                </p>
                <div className="mt-4 p-3 bg-neutral-950 rounded border border-neutral-800 text-xs text-neutral-500 italic">
                  "Interaction with this node updates global simulation weights in real-time."
                </div>
              </div>
            ) : (
              <div className="text-neutral-500 text-sm italic flex flex-col items-center justify-center h-40">
                <TrendingUp className="mb-2 opacity-20" size={32} />
                Select a node on the graph to see AI analysis.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // AppState.SIMULATOR
  return (
    <div className="h-screen w-screen flex flex-row bg-black overflow-hidden relative">
      
      {/* LEFT SIDE: SIMULATOR (Mobile App Style) */}
      <div className="w-1/2 flex items-center justify-center bg-neutral-900/30 p-4 border-r border-neutral-800 shrink-0">
        
        {/* Mobile Frame */}
        <div className={`relative w-full max-w-[380px] h-[750px] max-h-[90vh] bg-black border-[8px] ${isGuardEnabled ? 'border-red-900/50' : 'border-neutral-800'} rounded-[3rem] shadow-2xl overflow-hidden flex flex-col ring-1 ${isGuardEnabled ? 'ring-red-500' : 'ring-neutral-700'} transition-colors duration-500`}>
          
          {/* Status Bar */}
          <div className="bg-neutral-950 h-12 flex justify-between items-end px-6 pb-2 text-white/80 select-none shrink-0 z-20">
            <span className="text-xs font-bold">9:41</span>
            <div className="flex space-x-1.5">
                <Signal size={14} />
                <Wifi size={14} />
                <Battery size={14} />
            </div>
          </div>

          {/* Screen Content */}
          <div className="flex-1 bg-neutral-950 overflow-hidden relative flex flex-col">
            
            {activePost ? (
               /* DETAILED VIEW */
               <PostDetail 
                 post={activePost} 
                 onBack={() => setActivePost(null)}
                 onInteract={(type, topicId, postId) => handleInteraction(type, topicId, postId)}
                 isGuardActive={isGuardEnabled}
               />
            ) : (
               /* FEED VIEW */
               <>
                <header className="h-14 border-b border-neutral-800 flex items-center justify-between px-4 bg-neutral-950/95 backdrop-blur sticky top-0 z-10 shrink-0">
                  <div className="flex items-center space-x-2">
                     {/* GUARD TOGGLE */}
                     <button 
                        onClick={() => setIsGuardEnabled(!isGuardEnabled)}
                        className={`flex items-center space-x-1 px-2 py-1 rounded-full border transition-all duration-300 ${isGuardEnabled ? 'bg-red-900/50 border-red-500 text-red-100' : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-white'}`}
                        title="Toggle AIsolation Guard"
                     >
                        {isGuardEnabled ? <ShieldAlert size={14} className="animate-pulse" /> : <Shield size={14} />}
                        <span className="text-[10px] font-bold uppercase">{isGuardEnabled ? 'Guard ON' : 'Off'}</span>
                     </button>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-400">
                    u/
                  </div>
                </header>
                
                {/* GUARD BANNER */}
                {isGuardEnabled && (
                    <div className="bg-red-600/10 border-b border-red-900/50 p-2 flex items-center justify-center text-[10px] text-red-400 font-mono tracking-wider animate-in slide-in-from-top">
                        <ShieldAlert size={12} className="mr-2" />
                        AI SAFETY LAYER ACTIVE
                    </div>
                )}
                
                <div className="flex-1 overflow-y-auto no-scrollbar p-0 w-full relative">
                  {/* Scan Line Effect for Guard */}
                  {isGuardEnabled && (
                      <div className="absolute inset-0 pointer-events-none z-0 opacity-10 bg-[linear-gradient(transparent_0%,rgba(255,0,0,0.1)_50%,transparent_100%)] bg-[length:100%_4px]"></div>
                  )}

                  {posts.map(post => (
                    <PostCard 
                      key={post.id} 
                      post={post} 
                      isGuardActive={isGuardEnabled}
                      onInteract={(type, topicId, postId) => {
                        if (type === 'click') {
                            setActivePost(post);
                        }
                        handleInteraction(type, topicId, postId);
                      }} 
                    />
                  ))}
                  
                  <div ref={loadMoreRef} className="h-24 flex flex-col items-center justify-center text-neutral-500 space-y-2 p-4">
                    {isLoadingPost && (
                      <>
                        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs font-mono animate-pulse">Simulating content...</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Fake Bottom Nav */}
                <div className="h-14 border-t border-neutral-800 bg-neutral-950 flex items-center justify-around text-neutral-500 shrink-0">
                    <div className="flex flex-col items-center text-orange-500">
                        <div className="w-6 h-6 bg-orange-500/20 rounded flex items-center justify-center">
                            <div className="w-4 h-4 bg-orange-500 rounded-sm"></div>
                        </div>
                    </div>
                    <div className="w-6 h-6 rounded bg-neutral-800"></div>
                    <div className="w-6 h-6 rounded bg-neutral-800"></div>
                    <div className="w-6 h-6 rounded bg-neutral-800"></div>
                </div>
               </>
            )}
          </div>

          {/* Home Indicator */}
          <div className="h-6 bg-neutral-950 w-full flex justify-center items-center shrink-0">
              <div className="w-32 h-1 bg-neutral-800 rounded-full"></div>
          </div>

        </div>
      </div>

      {/* RIGHT SIDE: REAL-TIME GRAPH */}
      <div className="w-1/2 flex flex-col h-full bg-neutral-950 relative border-l border-neutral-800 shrink-0">
        
        {/* Legend */}
        <div className="absolute top-8 left-8 z-10 bg-black/80 backdrop-blur p-4 rounded-xl border border-neutral-800 max-w-sm pointer-events-none select-none">
             <h3 className="text-lg font-bold text-white flex items-center">
                <TrendingUp className="mr-2 text-green-500" size={20} />
                Live Neural Weights
             </h3>
             <p className="text-sm text-neutral-400 mt-2">
                Upvoting increases topic interest. Downvoting reduces it. Drag to explore.
             </p>
        </div>

        {/* Neural Search Bar */}
        <div className="absolute top-8 right-8 z-20 w-80">
           <form onSubmit={handleGraphSearch} className="relative">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ask your echo chamber..."
                className="w-full bg-black/80 backdrop-blur border border-neutral-700 text-white pl-10 pr-4 py-2 rounded-full focus:outline-none focus:border-orange-500 transition-all shadow-lg"
              />
              <div className="absolute left-3 top-2.5 text-neutral-500">
                  {isSearching ? <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div> : <MessageCircleQuestion size={18} />}
              </div>
           </form>

           {/* Search Result Popup */}
           {searchResult && (
             <div className="mt-4 bg-black/90 backdrop-blur border border-orange-500/50 p-4 rounded-xl shadow-2xl animate-in slide-in-from-top duration-300 relative">
                <button onClick={() => setSearchResult(null)} className="absolute top-2 right-2 text-neutral-500 hover:text-white">
                    <X size={14} />
                </button>
                <div className="text-xs text-orange-500 font-bold mb-1 uppercase tracking-wider">Neural Answer</div>
                <p className="text-sm text-neutral-200 leading-relaxed">{searchResult}</p>
             </div>
           )}
        </div>
        
        <InterestGraph 
            data={graphData} 
            width={800} 
            height={800} 
            className="w-full h-full"
            interactive={true}
            onNodeClick={setSelectedNode}
          />
          
        {/* Helper popup for clicked nodes in Simulator View */}
        {selectedNode && (
            <div className="absolute bottom-8 right-8 max-w-xs bg-neutral-900 border border-neutral-700 p-4 rounded-lg shadow-xl animate-fade-in z-20">
                <div className="flex items-center justify-between mb-2">
                    <h4 className={`font-bold ${selectedNode.type === 'subreddit' ? 'text-orange-500' : 'text-indigo-400'}`}>
                        {selectedNode.id}
                    </h4>
                    <button onClick={() => setSelectedNode(null)} className="text-neutral-500 hover:text-white">✕</button>
                </div>
                <p className="text-xs text-neutral-300">{selectedNode.desc}</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default App;