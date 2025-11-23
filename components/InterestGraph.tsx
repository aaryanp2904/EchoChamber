import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { GraphData, GraphNode, GraphLink } from '../types';

interface Props {
  data: GraphData;
  onNodeClick?: (node: GraphNode) => void;
  width?: number;
  height?: number;
  className?: string;
  interactive?: boolean; // If false, nodes don't drag, just float
}

const InterestGraph: React.FC<Props> = ({ 
  data, 
  onNodeClick, 
  width = 600, 
  height = 400, 
  className = "",
  interactive = true 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);

  // 1. Initialize Simulation (Topology Only)
  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous

    // Add a container group for Zoom/Pan
    const container = svg.append("g");

    // Deep copy to prevent d3 mutation issues with React state
    const nodes: GraphNode[] = data.nodes.map(d => ({ ...d })); 
    const links: GraphLink[] = data.links.map(d => ({ ...d }));

    // Zoom Behavior
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            container.attr("transform", event.transform);
        });

    // Apply zoom to SVG
    if (interactive) {
        svg.call(zoom as any);
    }

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius((d: any) => d.val + 8).iterations(2));

    simulationRef.current = simulation;

    // Draw Links
    const link = container.append("g")
      .attr("stroke", "#475569")
      .attr("stroke-opacity", 0.4)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", d => Math.sqrt(d.value) * 1.5);

    // Draw Nodes Group
    const nodeGroup = container.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .call(drag(simulation) as any);

    // Circles
    nodeGroup.append("circle")
      .attr("r", d => d.val)
      .attr("fill", d => d.type === 'subreddit' ? '#f97316' : '#6366f1') // Orange for Subreddit, Indigo for Topic
      .attr("stroke", d => d.type === 'subreddit' ? '#c2410c' : '#4338ca')
      .attr("stroke-width", 2)
      .attr("class", "cursor-pointer")
      .on("click", (event, d) => {
        // Prevent zoom/drag when simply clicking
        event.stopPropagation();
        if (onNodeClick) onNodeClick(d);
      });

    // Icons/Labels
    nodeGroup.append("text")
      .text(d => d.type === 'subreddit' ? `r/${d.id.replace('r/', '')}` : d.id)
      .attr("text-anchor", "middle")
      .attr("dy", d => -d.val - 5) // Position above circle
      .attr("fill", "#e2e8f0")
      .attr("font-size", d => Math.max(10, d.val / 2.5) + "px") // Scale font slightly
      .attr("font-weight", "bold")
      .style("pointer-events", "none")
      .style("text-shadow", "0px 2px 4px #000");

    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as GraphNode).x!)
        .attr("y1", d => (d.source as GraphNode).y!)
        .attr("x2", d => (d.target as GraphNode).x!)
        .attr("y2", d => (d.target as GraphNode).y!);

      nodeGroup
        .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function drag(sim: any) {
      if (!interactive) return d3.drag().on("start", null);
      
      function dragstarted(event: any) {
        event.sourceEvent.stopPropagation(); // Stop zoom when dragging node
        if (!event.active) sim.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      
      function dragged(event: any) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      
      function dragended(event: any) {
        if (!event.active) sim.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }
      
      return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }

    return () => {
      simulation.stop();
    };
  }, [data.nodes.length, data.links.length, width, height]); // Re-run fully if topology changes (count of nodes/links)

  // 2. Handle Live Updates (Size & Flash)
  useEffect(() => {
    if (!svgRef.current || !simulationRef.current) return;
    
    const svg = d3.select(svgRef.current);
    const now = Date.now();
    const simulationNodes = simulationRef.current.nodes();
    let hasUpdates = false;

    // Iterate over D3 simulation nodes and match them to React data props
    simulationNodes.forEach((d: any) => {
        const newData = data.nodes.find(n => n.id === d.id);
        if (newData) {
            const oldVal = d.val;
            d.val = newData.val; // Update physics value

            // Find specific DOM element for this node inside the container
            // We select ALL circles, then filter by bound data ID
            const circle = svg.selectAll("circle").filter((nodeData: any) => nodeData.id === d.id);

            // Trigger Flash if update is recent (<1000ms)
            if (newData.lastUpdated && (now - newData.lastUpdated) < 1000) {
                 hasUpdates = true;
                 circle
                   .transition()
                   .duration(150)
                   .attr("fill", "#ffffff") // White Flash
                   .attr("stroke", "#ffffff")
                   .attr("stroke-width", 6) // Bold outline
                   .attr("r", (d.val * 1.5) + 10) // BIG POP
                   .transition()
                   .duration(800)
                   .ease(d3.easeElastic)
                   .attr("fill", d.type === 'subreddit' ? '#f97316' : '#6366f1') // Restore Color
                   .attr("stroke", d.type === 'subreddit' ? '#c2410c' : '#4338ca')
                   .attr("stroke-width", 2)
                   .attr("r", d.val); // Restore Size
            } else if (Math.abs(oldVal - newData.val) > 0.1) {
                // Passive size update if changed elsewhere but not triggered as an "event"
                hasUpdates = true;
                circle
                  .transition()
                  .duration(300)
                  .attr("r", d.val);
            }
        }
    });

    // If sizes changed, restart simulation gently to accommodate new boundaries
    if (hasUpdates) {
        simulationRef.current.force("collide", d3.forceCollide().radius((d: any) => d.val + 8).iterations(2));
        simulationRef.current.alpha(0.3).restart();
    }

  }, [data]);

  return (
    <div className={`relative overflow-hidden rounded-xl bg-neutral-950 border border-neutral-800 ${className}`}>
      <svg 
        ref={svgRef} 
        viewBox={`0 0 ${width} ${height}`} 
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />
    </div>
  );
};

export default InterestGraph;