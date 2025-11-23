import React, { useEffect, useState } from 'react';
import { Activity, Terminal } from 'lucide-react';

interface Props {
  username: string;
  onComplete: () => void;
}

const STEPS = [
  "Ping Reddit API...",
  "Scraping public comment history...",
  "Analyzing subreddit overlap...",
  "Parsing karma distribution...",
  "Constructing Interest Graph...",
  "Weighting semantic vectors...",
  "Finalizing simulation parameters..."
];

const LoadingScreen: React.FC<Props> = ({ username, onComplete }) => {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (stepIndex >= STEPS.length) {
      setTimeout(onComplete, 500);
      return;
    }

    const timeout = setTimeout(() => {
      setStepIndex(prev => prev + 1);
    }, 800 + Math.random() * 1000); // Random delay between steps

    return () => clearTimeout(timeout);
  }, [stepIndex, onComplete]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center animate-fade-in">
      <div className="mb-8 relative">
        <div className="absolute -inset-4 bg-orange-500/20 rounded-full blur-xl animate-pulse"></div>
        <Activity className="w-16 h-16 text-orange-500 relative z-10 animate-bounce" />
      </div>
      
      <h2 className="text-2xl font-bold mb-2">Analyzing u/{username}</h2>
      <p className="text-neutral-500 text-sm mb-6 max-w-xs">
        We are fetching your public Reddit footprint to build a personalized simulation.
      </p>
      
      <div className="h-2 w-64 bg-neutral-800 rounded-full overflow-hidden mb-4">
        <div 
          className="h-full bg-orange-500 transition-all duration-500 ease-out"
          style={{ width: `${(stepIndex / STEPS.length) * 100}%` }}
        />
      </div>
      
      <div className="flex items-center space-x-2 text-neutral-400 font-mono text-sm h-6">
        {stepIndex < STEPS.length && (
          <>
            <Terminal size={14} />
            <span key={stepIndex} className="animate-pulse">
              {STEPS[stepIndex]}
            </span>
          </>
        )}
        {stepIndex >= STEPS.length && <span className="text-green-500">Complete!</span>}
      </div>
    </div>
  );
};

export default LoadingScreen;