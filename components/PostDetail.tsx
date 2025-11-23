import React from 'react';
import { RedditPost } from '../types';
import { ArrowBigUp, ArrowBigDown, MessageSquare, Share2, ArrowLeft, ShieldAlert, ShieldCheck } from 'lucide-react';

interface Props {
  post: RedditPost;
  onBack: () => void;
  onInteract: (type: 'upvote' | 'downvote', topicId: string, postId: string) => void;
  isGuardActive?: boolean;
}

const PostDetail: React.FC<Props> = ({ post, onBack, onInteract, isGuardActive = false }) => {
  const isUpvoted = post.userVote === 'up';
  const isDownvoted = post.userVote === 'down';
  const isFlagged = post.guardResult?.isProvocative;

  return (
    <div className="flex flex-col h-full bg-neutral-950 animate-in slide-in-from-right duration-300 w-full relative">
       {/* GUARD OVERLAY */}
       {isGuardActive && isFlagged && (
        <div className="absolute inset-0 border-4 border-red-500 pointer-events-none z-50 animate-pulse opacity-50"></div>
      )}

      {/* Header */}
      <div className={`flex items-center p-4 border-b ${isGuardActive && isFlagged ? 'bg-red-950/30 border-red-900' : 'bg-neutral-950/95 border-neutral-800'} sticky top-0 backdrop-blur z-10 transition-colors duration-300`}>
        <button onClick={onBack} className="p-2 hover:bg-neutral-800 rounded-full mr-2 transition-colors group">
          <ArrowLeft size={24} className="text-neutral-400 group-hover:text-white" />
        </button>
        <div className="flex flex-col">
            <span className="font-bold text-lg truncate text-neutral-200">r/{post.subreddit}</span>
            {isGuardActive && isFlagged && (
                <span className="text-[10px] text-red-500 font-bold uppercase tracking-widest flex items-center">
                    <ShieldAlert size={10} className="mr-1" /> Potential Manipulation Detected
                </span>
            )}
        </div>
      </div>

      {/* Guard Warning Block */}
      {isGuardActive && isFlagged && (
         <div className="bg-red-900/20 p-5 border-b border-red-900/50 flex items-start space-x-4">
            <div className="bg-red-950 p-2 rounded-full border border-red-800/50">
               <ShieldAlert className="text-red-500 shrink-0" size={24} />
            </div>
            <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                   <h4 className="text-red-400 font-bold text-sm uppercase tracking-wide">Targeting Analysis</h4>
                   <span className="text-[10px] text-red-300 bg-red-900/60 px-2 py-0.5 rounded border border-red-800">{post.guardResult?.manipulationType}</span>
                </div>
                <p className="text-red-100 text-xs leading-relaxed font-medium">
                    {post.guardResult?.reasoning}
                </p>
                <div className="mt-3 text-[10px] text-red-400/60">
                    Confidence: High • Source: Interest Graph Cross-Reference
                </div>
            </div>
         </div>
      )}

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
        <div className="flex items-center text-xs text-neutral-400 mb-4">
            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${isGuardActive && isFlagged ? 'from-red-600 to-orange-700' : 'from-orange-500 to-pink-500'} mr-2 transition-colors`}></div>
            <div className="flex flex-col">
                <div className="flex items-center">
                    <span className="font-bold text-neutral-200">u/{post.author}</span>
                    {isGuardActive && !isFlagged && <ShieldCheck size={12} className="text-green-500 ml-1" />}
                </div>
                <span>{post.timestamp}</span>
            </div>
        </div>

        <h1 className="text-xl font-bold text-neutral-100 mb-4 leading-snug">{post.title}</h1>
        
        <div className="text-neutral-300 leading-relaxed whitespace-pre-wrap mb-8 text-base">
          {post.content}
        </div>

        <div className="flex items-center space-x-4 border-t border-neutral-800 pt-4">
           <button className="flex items-center space-x-2 bg-neutral-900 px-4 py-2 rounded-full hover:bg-neutral-800 transition-colors text-neutral-400">
              <MessageSquare size={20} />
              <span>{post.comments} Comments</span>
           </button>
           <button className="flex items-center space-x-2 bg-neutral-900 px-4 py-2 rounded-full hover:bg-neutral-800 transition-colors text-neutral-400">
              <Share2 size={20} />
              <span>Share</span>
           </button>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="p-4 border-t border-neutral-800 bg-neutral-900 flex justify-between items-center">
        <div className="flex items-center bg-neutral-800 rounded-full w-full justify-between px-2">
            <button 
                onClick={() => onInteract('upvote', post.topicId, post.id)}
                className={`p-3 hover:bg-neutral-700 rounded-full transition-colors flex-1 flex justify-center ${isUpvoted ? 'text-orange-500' : 'text-neutral-400'}`}
            >
                <ArrowBigUp size={28} fill={isUpvoted ? "currentColor" : "none"} />
            </button>
            <span className={`font-bold w-12 text-center ${isUpvoted ? 'text-orange-500' : isDownvoted ? 'text-blue-500' : 'text-neutral-200'}`}>
                {((post.upvotes + (isUpvoted ? 1 : 0) - (isDownvoted ? 1 : 0)) / 1000).toFixed(1)}k
            </span>
            <button 
                onClick={() => onInteract('downvote', post.topicId, post.id)}
                className={`p-3 hover:bg-neutral-700 rounded-full transition-colors flex-1 flex justify-center ${isDownvoted ? 'text-blue-500' : 'text-neutral-400'}`}
            >
                <ArrowBigDown size={28} fill={isDownvoted ? "currentColor" : "none"} />
            </button>
        </div>
      </div>
    </div>
  );
};

export default PostDetail;