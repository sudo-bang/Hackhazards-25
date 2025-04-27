
// 1. Import Markdown rendering libraries
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'; // Handles GitHub Flavored Markdown (tables, etc.)
import rehypeRaw from 'rehype-raw'; // Handles potential raw HTML in markdown (use carefully)

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button'; // For copy button
import { ClipboardCopy } from 'lucide-react'; // Icon for copy button

// --- Optional: Syntax Highlighting Imports (choose one style) ---
// Option A: react-syntax-highlighter (more bundlesize, more languages/themes)
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { coldarkDark } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Example theme

// Option B: refractor + lowlight (lighter weight, fewer languages by default)
// Requires: npm install refractor lowlight hast-to-hyperscript
// import {createElement} from 'react'
// import {unified} from 'unified'
// import markdown from 'remark-parse'
// import remark2rehype from 'remark-rehype'
// import rehypeHighlight from 'rehype-highlight' // Or use lowlight directly
// import rehype2react from 'rehype-react'
// import 'highlight.js/styles/github-dark.css'; // Choose a highlight.js theme CSS
// --- End Optional Imports ---


interface SummaryDisplayProps {
    summary: string | null; // This is now expected to be Markdown content
    modelUsed: string | null;
}

export function SummaryDisplay({ summary, modelUsed }: SummaryDisplayProps) {
    if (!summary) {
        return null;
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(summary)
            .then(() => {
                console.log('Markdown copied to clipboard!');
                 // Optional: Add a visual indicator like changing button text temporarily
            })
            .catch(err => {
                console.error('Failed to copy markdown: ', err);
            });
    };


    return (
        <Card className="mt-6 bg-gray-800/80 border-gray-700 relative"> {/* Darker background for contrast */}
            <CardHeader className='pb-2'>
                <div className='flex justify-between items-start'>
                     <div>
                        <CardTitle className="text-xl text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-purple-400">Generated Documentation</CardTitle>
                        {modelUsed && <CardDescription className='text-xs text-gray-500 pt-1'>Synthesized using: {modelUsed}</CardDescription>}
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleCopy} title="Copy Markdown" className="text-white">
                        <ClipboardCopy className="h-4 w-4 mr-1" /> Copy
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {/* Apply Tailwind Typography prose classes for styling */}
                <div className="prose prose-sm text-white prose-invert max-w-none prose-pre:bg-gray-900/70 prose-pre:border prose-pre:border-gray-600 prose-pre:rounded-md prose-code:before:content-none prose-code:after:content-none prose-code:bg-gray-700 prose-code:text-emerald-300 prose-code:px-1 prose-code:py-0.5 prose-code:rounded">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]} // Enable GitHub Flavored Markdown
                        rehypePlugins={[rehypeRaw]} // Allow raw HTML (use with caution)
                        // --- Optional: Code Block Syntax Highlighting ---
                        // Choose ONE of the following component overrides if you installed a highlighter
                        // --- Option A: react-syntax-highlighter ---
                        
                        components={{
                            code({ node, inline, className, children, ...props }) {
                                const match = /language-(\w+)/.exec(className || '');
                                return !inline && match ? (
                                    <SyntaxHighlighter
                                        style={coldarkDark} // Choose your theme object
                                        language={match[1]}
                                        PreTag="div"
                                        {...props} // Remove default props pass-through if causing issues
                                    >
                                        {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                ) : (
                                    <code className={className} {...props}>
                                        {children}
                                    </code>
                                );
                            }
                        }}
                       
                        // --- Option B: Using rehype-highlight (needs setup outside this component usually) ---
                        // Requires importing 'highlight.js/styles/...' theme CSS in your main CSS/App
                        // Might need further setup with unified/rehype - see docs
                        // rehypePlugins={[rehypeRaw, rehypeHighlight]}
                        // --- End Optional Highlighting ---
                    >
                        {summary}
                    </ReactMarkdown>
                </div>
            </CardContent>
        </Card>
    );
}