import React from 'react';
import { RedditPost } from '../types';
import { ArrowBigUp, ArrowBigDown, MessageSquare, Share2, MoreHorizontal, ShieldAlert, ShieldCheck } from 'lucide-react';

interface Props {
  post: RedditPost;
  onInteract: (type: 'upvote' | 'downvote' | 'click', topicId: string, postId: string) => void;
  isGuardActive?: boolean;
}

const PostCard: React.FC<Props> = ({ post, onInteract, isGuardActive = false }) => {
  const isUpvoted = post.userVote === 'up';
  const isDownvoted = post.userVote === 'down';
  const isFlagged = post.guardResult?.isProvocative;

  return (
    <div className="relative group mb-4 px-2">
      {/* GUARD OVERLAY UI */}
      {isGuardActive && isFlagged && (
        <div className="absolute -inset-[2px] bg-red-600/20 border-2 border-red-500 rounded-lg pointer-events-none z-10 animate-pulse"></div>
      )}

      {isGuardActive && isFlagged && (
        <div className="bg-red-950/90 border border-red-800 text-red-200 text-xs p-3 rounded-t-md flex items-start space-x-2 relative z-20 mx-1 -mb-1 shadow-xl">
           <ShieldAlert className="shrink-0 text-red-500 mt-0.5" size={16} />
           <div className="flex-1">
             <div className="flex justify-between items-baseline mb-1">
                <span className="font-bold uppercase tracking-wider text-red-400 text-[10px]">AIsolation Guard Warning</span>
                <span className="text-[9px] bg-red-900/50 px-1 rounded text-red-300 font-mono border border-red-800/50">{post.guardResult?.manipulationType}</span>
             </div>
             <p className="leading-snug opacity-90 text-[11px]">{post.guardResult?.reasoning}</p>
           </div>
        </div>
      )}

      <div 
        className={`bg-neutral-900 border ${isGuardActive && isFlagged ? 'border-red-500/30' : 'border-neutral-800'} rounded-md hover:border-neutral-700 transition-colors cursor-pointer relative z-0`}
        onClick={() => onInteract('click', post.topicId, post.id)}
      >
        <div className="flex">
          {/* Vote Column */}
          <div className="w-10 bg-neutral-900/50 p-2 flex flex-col items-center rounded-l-md space-y-1">
            <button 
              onClick={(e) => { e.stopPropagation(); onInteract('upvote', post.topicId, post.id); }}
              className={`transition-colors ${isUpvoted ? 'text-orange-500' : 'text-neutral-400 hover:text-neutral-200'}`}
            >
              <ArrowBigUp size={24} fill={isUpvoted ? "currentColor" : "none"} />
            </button>
            
            <span className={`text-xs font-bold ${isUpvoted ? 'text-orange-500' : isDownvoted ? 'text-blue-500' : 'text-neutral-300'}`}>
              {((post.upvotes + (isUpvoted ? 1 : 0) - (isDownvoted ? 1 : 0)) / 1000).toFixed(1)}k
            </span>
            
            <button 
              onClick={(e) => { e.stopPropagation(); onInteract('downvote', post.topicId, post.id); }}
              className={`transition-colors ${isDownvoted ? 'text-blue-500' : 'text-neutral-400 hover:text-neutral-200'}`}
            >
              <ArrowBigDown size={24} fill={isDownvoted ? "currentColor" : "none"} />
            </button>
          </div>

          {/* Content Column */}
          <div className="p-3 flex-1">
            {/* Header */}
            <div className="flex items-center text-xs text-neutral-400 mb-2 space-x-1">
              {isGuardActive && !isFlagged && (
                  <ShieldCheck size={12} className="text-green-500/50 mr-1" />
              )}
              <span className="font-bold text-neutral-200 hover:underline">{post.subreddit}</span>
              <span>•</span>
              <span>Posted by u/{post.author}</span>
              <span>•</span>
              <span>{post.timestamp}</span>
            </div>

            {/* Title & Body */}
            <h3 className="text-lg font-medium text-neutral-100 mb-2 leading-snug">{post.title}</h3>
            <div className="text-sm text-neutral-300 leading-relaxed mb-4 line-clamp-4">
              {post.content}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center space-x-4 text-neutral-400 text-xs font-bold">
              <button className="flex items-center space-x-1 bg-neutral-800 hover:bg-neutral-700 px-2 py-1 rounded transition-colors">
                <MessageSquare size={16} />
                <span>{post.comments} Comments</span>
              </button>
              <button className="flex items-center space-x-1 hover:bg-neutral-800 px-2 py-1 rounded transition-colors">
                <Share2 size={16} />
                <span>Share</span>
              </button>
              <button className="flex items-center space-x-1 hover:bg-neutral-800 px-2 py-1 rounded transition-colors">
                <MoreHorizontal size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostCard;